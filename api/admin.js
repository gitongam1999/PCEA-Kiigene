const supabase = require('./_db');
const { isAdmin } = require('./_session');
const { s3, BUCKET, presignPut } = require('./_storage');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');

const ALLOWED = ['events', 'videos', 'albums', 'sermons', 'leaders'];
const STORAGE_CAP_BYTES = 9.5 * 1024 * 1024 * 1024;
const IMAGE_MAX_BYTES = 30 * 1024 * 1024;

async function storageUsed() {
  const { data, error } = await supabase.from('media_files').select('size_bytes');
  if (error) throw new Error(error.message);
  return (data || []).reduce((sum, r) => sum + (r.size_bytes || 0), 0);
}
function safeKey(prefix, filename) {
  const clean = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
  return `${prefix}/${Date.now()}-${clean}`;
}

module.exports = async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'Not signed in.' });

  if (req.method === 'DELETE') {
    const { table, id, action, ministryId } = req.query;

    if (action === 'remove-cover') {
      if (!ministryId) return res.status(400).json({ ok: false, error: 'Missing ministryId.' });
      const { data: m, error: mErr } = await supabase.from('ministries')
        .select('cover_url').eq('id', ministryId).single();
      if (mErr) return res.status(500).json({ ok: false, error: mErr.message });
      if (m && m.cover_url) {
        try { await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: m.cover_url })); } catch (e) {}
        await supabase.from('media_files').delete().eq('b2_key', m.cover_url);
      }
      const { error } = await supabase.from('ministries').update({ cover_url: null }).eq('id', ministryId);
      if (error) return res.status(500).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (!ALLOWED.includes(table)) return res.status(400).json({ ok: false, error: 'Unknown table.' });
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return res.status(500).json({ ok: false, error: error.message });
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

      const { data: m } = await supabase.from('ministries').select('cover_url').eq('id', ministryId).single();
      if (m && m.cover_url && m.cover_url !== key) {
        try { await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: m.cover_url })); } catch (e) {}
        await supabase.from('media_files').delete().eq('b2_key', m.cover_url);
      }

      const { error: e1 } = await supabase.from('media_files').insert({
        b2_key: key, kind: 'cover', content_type: contentType, original_name: originalName, size_bytes: sizeBytes || 0
      });
      if (e1) return res.status(500).json({ ok: false, error: e1.message });

      const { error: e2 } = await supabase.from('ministries').update({ cover_url: key }).eq('id', ministryId);
      if (e2) return res.status(500).json({ ok: false, error: e2.message });

      return res.status(200).json({ ok: true });
    }

    const { table, data } = body;
    if (!ALLOWED.includes(table)) return res.status(400).json({ ok: false, error: 'Unknown table.' });
    const { data: row, error } = await supabase.from(table).insert(data).select().single();
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, row });
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
};