const supabase = require('./_db');
const { isAdmin } = require('./_session');
const { s3, BUCKET, presignPut, presignUploadPart } = require('./_storage');
const {
  DeleteObjectCommand, CreateMultipartUploadCommand, CompleteMultipartUploadCommand,
  ListPartsCommand, AbortMultipartUploadCommand, ListMultipartUploadsCommand, HeadObjectCommand
} = require('@aws-sdk/client-s3');

const ALLOWED = ['events', 'videos', 'albums', 'sermons', 'leaders'];
const STORAGE_CAP_BYTES = 9.5 * 1024 * 1024 * 1024;
const IMAGE_MAX_BYTES = 30 * 1024 * 1024;
const VIDEO_SINGLE_MAX = 500 * 1024 * 1024;   // bigger videos must be uploaded in chunks
const VIDEO_MAX_PARTS = 40;
const AUDIO_MAX = 500 * 1024 * 1024;           // audio is always uploaded in one piece

// Which columns on each table hold a stored file's key.
// When a row is deleted, its files are deleted too.
// (Album photos live in their own table and are handled separately below.)
const FILE_COLUMNS = {
  events: ['image_url'],
  videos: ['file_url', 'thumbnail_url'],
  albums: [],
  sermons: ['audio_url', 'video_url'],
  leaders: ['photo_url']
};

async function storageUsed() {
  const { data, error } = await supabase.from('media_files').select('size_bytes');
  if (error) throw new Error(error.message);
  return (data || []).reduce((sum, r) => sum + (r.size_bytes || 0), 0);
}
function safeKey(prefix, filename) {
  const clean = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
  return `${prefix}/${Date.now()}-${clean}`;
}

// Delete files from the bucket and stop counting them toward the storage limit.
async function removeFiles(keys) {
  keys = (keys || []).filter(Boolean);
  if (!keys.length) return;
  for (let i = 0; i < keys.length; i += 10) {
    await Promise.allSettled(keys.slice(i, i + 10).map(key =>
      s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))));
  }
  await supabase.from('media_files').delete().in('b2_key', keys);
}

// An upload is done: join the chunks (if it was chunked) and read the file's real size from the bucket.
async function finishFile(key, uploadId) {
  if (uploadId) {
    const parts = [];
    let marker;
    do {
      const out = await s3.send(new ListPartsCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId, PartNumberMarker: marker }));
      (out.Parts || []).forEach(p => parts.push({ ETag: p.ETag, PartNumber: p.PartNumber }));
      marker = out.IsTruncated ? out.NextPartNumberMarker : undefined;
    } while (marker);
    parts.sort((x, y) => x.PartNumber - y.PartNumber);
    if (parts.length < 2) throw new Error('the upload is incomplete');
    await s3.send(new CompleteMultipartUploadCommand({
      Bucket: BUCKET, Key: key, UploadId: uploadId, MultipartUpload: { Parts: parts }
    }));
  }
  const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  return head.ContentLength || 0;
}

// Big uploads that were started but never finished still use up storage.
// Whenever a new big upload starts, clear out any that are more than a day old.
async function abortStaleUploads() {
  try {
    const out = await s3.send(new ListMultipartUploadsCommand({ Bucket: BUCKET }));
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const u of (out.Uploads || [])) {
      if (u.Initiated && new Date(u.Initiated).getTime() < cutoff) {
        try { await s3.send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: u.Key, UploadId: u.UploadId })); } catch (e) {}
      }
    }
  } catch (e) {}
}

// The Home page's cover photo lives on the church_info row.
// Every other ministry keeps its cover on its own ministries row.
function coverTarget(ministryId) {
  return ministryId === 'home'
    ? { table: 'church_info', id: 1 }
    : { table: 'ministries', id: ministryId };
}

module.exports = async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'Not signed in.' });

  if (req.method === 'DELETE') {
    const { table, id, action, ministryId } = req.query;

    if (action === 'remove-cover') {
      if (!ministryId) return res.status(400).json({ ok: false, error: 'Missing ministryId.' });
      const t = coverTarget(ministryId);
      const { data: m, error: mErr } = await supabase.from(t.table)
        .select('cover_url').eq('id', t.id).single();
      if (mErr) return res.status(500).json({ ok: false, error: mErr.message });
      if (m && m.cover_url) await removeFiles([m.cover_url]);
      const { error } = await supabase.from(t.table).update({ cover_url: null }).eq('id', t.id);
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete-photo') {
      if (!id) return res.status(400).json({ ok: false, error: 'Missing photo id.' });
      const { data: ph } = await supabase.from('photos').select('file_url').eq('id', id).single();
      const { error } = await supabase.from('photos').delete().eq('id', id);
      if (error) return res.status(500).json({ ok: false, error: error.message });
      if (ph && ph.file_url) await removeFiles([ph.file_url]);
      return res.status(200).json({ ok: true });
    }

    if (!ALLOWED.includes(table)) return res.status(400).json({ ok: false, error: 'Unknown table.' });

    let keys = [];
    if (table === 'albums') {
      const { data: ph } = await supabase.from('photos').select('file_url').eq('album_id', id);
      keys = (ph || []).map(p => p.file_url).filter(Boolean);
    } else {
      const cols = FILE_COLUMNS[table] || [];
      if (cols.length) {
        const { data: old } = await supabase.from(table).select(cols.join(',')).eq('id', id).single();
        if (old) keys = cols.map(c => old[c]).filter(Boolean);
      }
    }
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    await removeFiles(keys);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (!body || typeof body === 'string') {
      try { body = JSON.parse(body || '{}'); } catch { body = {}; }
    }

    if (body.action === 'get-upload-url') {
      const { kind, filename, contentType, sizeBytes } = body;
      if (!['image', 'cover', 'thumbnail', 'video', 'audio'].includes(kind)) {
        return res.status(400).json({ ok: false, error: 'This upload type is not supported yet.' });
      }
      if (!(sizeBytes > 0)) return res.status(400).json({ ok: false, error: 'Missing file size.' });
      if (kind === 'video') {
        if (sizeBytes > VIDEO_SINGLE_MAX) {
          return res.status(400).json({ ok: false, error: 'Videos over 500MB must be uploaded in chunks.' });
        }
      } else if (kind === 'audio') {
        if (sizeBytes > AUDIO_MAX) {
          return res.status(400).json({ ok: false, error: 'failed: audio file above 500mbs' });
        }
      } else if (sizeBytes > IMAGE_MAX_BYTES) {
        return res.status(400).json({ ok: false, error: 'failed: image file above 30mbs' });
      }
      let used;
      try { used = await storageUsed(); } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
      if (used + sizeBytes > STORAGE_CAP_BYTES) {
        return res.status(400).json({ ok: false, error: 'Storage limit reached. Delete something before uploading more.' });
      }
      const key = safeKey(kind, filename);
      let uploadUrl;
      try { uploadUrl = await presignPut(BUCKET, key, contentType || 'application/octet-stream'); }
      catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
      return res.status(200).json({ ok: true, uploadUrl, key });
    }

    if (body.action === 'attach-cover') {
      const { ministryId, key, contentType, sizeBytes, originalName } = body;
      if (!ministryId || !key) return res.status(400).json({ ok: false, error: 'Missing ministryId or key.' });
      const t = coverTarget(ministryId);

      const { data: m } = await supabase.from(t.table).select('cover_url').eq('id', t.id).single();
      if (m && m.cover_url && m.cover_url !== key) await removeFiles([m.cover_url]);

      const { error: e1 } = await supabase.from('media_files').insert({
        b2_key: key, kind: 'cover', content_type: contentType, original_name: originalName, size_bytes: sizeBytes || 0
      });
      if (e1) return res.status(500).json({ ok: false, error: e1.message });

      const { error: e2 } = await supabase.from(t.table).update({ cover_url: key }).eq('id', t.id);
      if (e2) return res.status(500).json({ ok: false, error: e2.message });

      return res.status(200).json({ ok: true });
    }

    // Start a big (chunked) video upload. Returns one signed link per chunk.
    if (body.action === 'video-start') {
      const { filename, contentType, sizeBytes, partCount } = body;
      if (!(sizeBytes > VIDEO_SINGLE_MAX)) {
        return res.status(400).json({ ok: false, error: 'Videos up to 500MB use the normal upload.' });
      }
      if (!(partCount >= 2 && partCount <= VIDEO_MAX_PARTS)) {
        return res.status(400).json({ ok: false, error: 'Bad number of chunks.' });
      }
      let used;
      try { used = await storageUsed(); } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
      if (used + sizeBytes > STORAGE_CAP_BYTES) {
        return res.status(400).json({ ok: false, error: 'Storage limit reached. Delete something before uploading more.' });
      }
      await abortStaleUploads();
      const key = safeKey('video', filename);
      try {
        const created = await s3.send(new CreateMultipartUploadCommand({
          Bucket: BUCKET, Key: key, ContentType: contentType || 'video/mp4'
        }));
        const uploadId = created.UploadId;
        const partUrls = [];
        for (let i = 1; i <= partCount; i++) partUrls.push(await presignUploadPart(BUCKET, key, uploadId, i));
        return res.status(200).json({ ok: true, key, uploadId, partUrls });
      } catch (e) {
        return res.status(500).json({ ok: false, error: 'Could not start the upload: ' + e.message });
      }
    }

    // Give up on a chunked upload (so its pieces don't use up storage).
    if (body.action === 'video-abort') {
      const { key, uploadId } = body;
      if (!key || !String(key).startsWith('video/') || !uploadId) {
        return res.status(400).json({ ok: false, error: 'Missing upload details.' });
      }
      try { await s3.send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId })); } catch (e) {}
      return res.status(200).json({ ok: true });
    }

    // The video is fully uploaded: join the chunks (if any), check it, save it, and count its size.
    if (body.action === 'finish-video') {
      const { key, uploadId, contentType, originalName, thumbnail } = body;
      const d = body.data || {};
      if (!key || !String(key).startsWith('video/')) return res.status(400).json({ ok: false, error: 'Missing video.' });
      if (!d.title) return res.status(400).json({ ok: false, error: 'Please give the video a title.' });
      if (thumbnail && thumbnail.key && !String(thumbnail.key).startsWith('thumbnail/')) {
        return res.status(400).json({ ok: false, error: 'Bad thumbnail.' });
      }
      const thumbKey = thumbnail && thumbnail.key ? thumbnail.key : null;

      let size = 0;
      try { size = await finishFile(key, uploadId); }
      catch (e) { return res.status(500).json({ ok: false, error: 'Could not finish the upload: ' + e.message }); }

      const keys = [key].concat(thumbKey ? [thumbKey] : []);
      let used;
      try { used = await storageUsed(); } catch (e) { await removeFiles(keys); return res.status(500).json({ ok: false, error: e.message }); }
      if (used + size > STORAGE_CAP_BYTES) {
        await removeFiles(keys);
        return res.status(400).json({ ok: false, error: 'Storage limit reached. Delete something before uploading more.' });
      }

      const mediaRows = [{ b2_key: key, kind: 'video', content_type: contentType, original_name: originalName, size_bytes: size }];
      if (thumbKey) {
        mediaRows.push({ b2_key: thumbKey, kind: 'thumbnail', content_type: thumbnail.contentType,
          original_name: thumbnail.originalName, size_bytes: thumbnail.sizeBytes || 0 });
      }
      const { error: me } = await supabase.from('media_files').insert(mediaRows);
      if (me) { await removeFiles(keys); return res.status(500).json({ ok: false, error: me.message }); }

      const secs = Number(d.length_seconds);
      const { data: created, error } = await supabase.from('videos').insert({
        ministry_id: d.ministry_id || null,
        title: d.title,
        description: d.description || null,
        length_seconds: d.length_seconds != null && d.length_seconds !== '' && isFinite(secs) ? Math.round(secs) : null,
        file_url: key,
        thumbnail_url: thumbKey
      }).select().single();
      if (error) { await removeFiles(keys); return res.status(500).json({ ok: false, error: error.message }); }
      return res.status(200).json({ ok: true, row: created });
    }

    // A sermon is fully uploaded (audio, video, or both): join chunks, check, save, and count the sizes.
    if (body.action === 'finish-sermon') {
      const d = body.data || {};
      const audio = body.audio || null;
      const video = body.video || null;
      if (!d.title) return res.status(400).json({ ok: false, error: 'Please give the sermon a title.' });
      if (!audio && !video) return res.status(400).json({ ok: false, error: 'Add an audio file, a video, or both.' });
      if (audio && !String(audio.key || '').startsWith('audio/')) return res.status(400).json({ ok: false, error: 'Bad audio file.' });
      if (video && !String(video.key || '').startsWith('video/')) return res.status(400).json({ ok: false, error: 'Bad video file.' });
      const keys = [audio && audio.key, video && video.key].filter(Boolean);

      let audioSize = 0, videoSize = 0;
      try {
        if (audio) audioSize = await finishFile(audio.key, null);
        if (video) videoSize = await finishFile(video.key, video.uploadId || null);
      } catch (e) {
        await removeFiles(keys);
        return res.status(500).json({ ok: false, error: 'Could not finish the upload: ' + e.message });
      }

      let used;
      try { used = await storageUsed(); } catch (e) { await removeFiles(keys); return res.status(500).json({ ok: false, error: e.message }); }
      if (used + audioSize + videoSize > STORAGE_CAP_BYTES) {
        await removeFiles(keys);
        return res.status(400).json({ ok: false, error: 'Storage limit reached. Delete something before uploading more.' });
      }

      const mediaRows = [];
      if (audio) mediaRows.push({ b2_key: audio.key, kind: 'audio', content_type: audio.contentType, original_name: audio.originalName, size_bytes: audioSize });
      if (video) mediaRows.push({ b2_key: video.key, kind: 'video', content_type: video.contentType, original_name: video.originalName, size_bytes: videoSize });
      const { error: me } = await supabase.from('media_files').insert(mediaRows);
      if (me) { await removeFiles(keys); return res.status(500).json({ ok: false, error: me.message }); }

      const secs = Number(d.length_seconds);
      const { data: created, error } = await supabase.from('sermons').insert({
        title: d.title,
        preacher: d.preacher || null,
        sermon_date: d.sermon_date || null,
        length_seconds: d.length_seconds != null && d.length_seconds !== '' && isFinite(secs) ? Math.round(secs) : null,
        audio_url: audio ? audio.key : null,
        video_url: video ? video.key : null
      }).select().single();
      if (error) { await removeFiles(keys); return res.status(500).json({ ok: false, error: error.message }); }
      return res.status(200).json({ ok: true, row: created });
    }

    // Clean up files that were uploaded but never became part of anything.
    // Files that ARE in use (counted in media_files) are never touched.
    if (body.action === 'discard-upload') {
      const keys = (Array.isArray(body.keys) ? body.keys : [])
        .filter(k => typeof k === 'string' && /^(audio|video|thumbnail|image)\//.test(k)).slice(0, 10);
      if (!keys.length) return res.status(200).json({ ok: true, removed: 0 });
      const { data: tracked } = await supabase.from('media_files').select('b2_key').in('b2_key', keys);
      const inUse = new Set((tracked || []).map(t => t.b2_key));
      const orphans = keys.filter(k => !inUse.has(k));
      await removeFiles(orphans);
      return res.status(200).json({ ok: true, removed: orphans.length });
    }

    // Put already-uploaded photos into an album.
    if (body.action === 'add-photos') {
      const { albumId, photos } = body;
      if (!albumId || !Array.isArray(photos) || !photos.length) {
        return res.status(400).json({ ok: false, error: 'Missing album or photos.' });
      }
      if (photos.length > 50) return res.status(400).json({ ok: false, error: 'Too many photos at once.' });
      const keys = photos.map(p => p && p.key).filter(Boolean);
      if (keys.length !== photos.length) return res.status(400).json({ ok: false, error: 'A photo is missing its key.' });

      const { data: last } = await supabase.from('photos').select('sort_order')
        .eq('album_id', albumId).order('sort_order', { ascending: false }).limit(1);
      const next = ((last && last[0] && last[0].sort_order) || 0) + 1;

      const { error: me } = await supabase.from('media_files').insert(photos.map(p => ({
        b2_key: p.key, kind: 'image', content_type: p.contentType,
        original_name: p.originalName, size_bytes: p.sizeBytes || 0
      })));
      if (me) { await removeFiles(keys); return res.status(500).json({ ok: false, error: me.message }); }

      const { error: pe } = await supabase.from('photos').insert(photos.map((p, i) => ({
        album_id: albumId, file_url: p.key, sort_order: next + i
      })));
      if (pe) { await removeFiles(keys); return res.status(500).json({ ok: false, error: pe.message }); }

      return res.status(200).json({ ok: true, added: photos.length });
    }

    // Create a row (event, video, album, sermon, leader), optionally with one uploaded file.
    const { table, media } = body;
    const data = body.data || {};
    if (!ALLOWED.includes(table)) return res.status(400).json({ ok: false, error: 'Unknown table.' });

    // Empty form boxes should be saved as "nothing", not as empty text.
    Object.keys(data).forEach(k => { if (data[k] === '') data[k] = null; });

    if (media && media.key) {
      const { error: me } = await supabase.from('media_files').insert({
        b2_key: media.key, kind: media.kind || 'image', content_type: media.contentType,
        original_name: media.originalName, size_bytes: media.sizeBytes || 0
      });
      if (me) return res.status(500).json({ ok: false, error: me.message });
    }

    const { data: row, error } = await supabase.from(table).insert(data).select().single();
    if (error) {
      if (media && media.key) await removeFiles([media.key]);
      return res.status(500).json({ ok: false, error: error.message });
    }
    return res.status(200).json({ ok: true, row });
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
};