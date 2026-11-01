const supabase = require('./_db');
const { isAdmin } = require('./_session');
const { s3, BUCKET, presignPut } = require('./_storage');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');

const ALLOWED = ['events', 'videos', 'albums', 'sermons', 'leaders'];
const STORAGE_CAP_BYTES = 9.5 * 1024 * 1024 * 1024;
const IMAGE_MAX_BYTES = 30 * 1024 * 1024;

// Which columns on each table hold a stored file's key.
// When a row is deleted, its files are deleted too.
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
  for (const key of keys) {
    if (!key) continue;
    try { await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })); } catch (e) {}
    await supabase.from('media_files').delete().eq('b2_key', key);
  }
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

    if (!ALLOWED.includes(table)) return res.status(400).json({ ok: false, error: 'Unknown table.' });

    const cols = FILE_COLUMNS[table] || [];
    let keys = [];
    if (cols.length) {
      const { data: old } = await supabase.from(table).select(cols.join(',')).eq('id', id).single();
      if (old) keys = cols.map(c => old[c]).filter(Boolean);
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
      if (!['image', 'cover', 'thumbnail'].includes(kind)) {
        return res.status(400).json({ ok: false, error: 'This upload type is not supported yet.' });
      }
      if (sizeBytes > IMAGE_MAX_BYTES) {
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