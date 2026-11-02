const supabase = require('./_db');
const { BUCKET, presignGet } = require('./_storage');

// Private-bucket files are stored as keys; turn a key into a temporary viewing link.
async function sign(key, downloadName) {
  if (!key) return null;
  try { return await presignGet(BUCKET, key, 3600, downloadName); } catch (e) { return null; }
}

// "image/1730000000000-IMG-123.jpg" -> "IMG-123.jpg" (the name a visitor's download gets)
function niceName(key) {
  return String(key).split('/').pop().replace(/^[0-9]+-/, '');
}

module.exports = async (req, res) => {
  try {
    // One album's photos, only fetched when a visitor opens that album.
    if (req.query && req.query.album) {
      const [alb, ph] = await Promise.all([
        supabase.from('albums').select('id, title, ministry_id').eq('id', req.query.album).single(),
        supabase.from('photos').select('id, file_url, sort_order').eq('album_id', req.query.album).order('sort_order')
      ]);
      if (alb.error || !alb.data) return res.status(404).json({ ok: false, error: 'Album not found.' });
      const photos = await Promise.all((ph.data || []).map(async p => ({
        id: p.id,
        url: await sign(p.file_url),
        download: await sign(p.file_url, niceName(p.file_url))
      })));
      return res.status(200).json({ ok: true, album: alb.data, photos });
    }

    const [church, ministries, events, videos, albums, photos, sermons, leaders] = await Promise.all([
      supabase.from('church_info').select('*').eq('id', 1).single(),
      supabase.from('ministries').select('*').order('sort_order'),
      supabase.from('events').select('*').order('event_date', { ascending: true }),
      supabase.from('videos').select('*').order('created_at', { ascending: false }),
      supabase.from('albums').select('*').order('created_at', { ascending: false }),
      supabase.from('photos').select('id, album_id, file_url, sort_order').order('sort_order'),
      supabase.from('sermons').select('*').order('sermon_date', { ascending: false }),
      supabase.from('leaders').select('*').order('sort_order'),
    ]);

    const firstError = [ministries, events, videos, albums, photos, sermons, leaders]
      .find(r => r.error);
    if (firstError) return res.status(500).json({ ok: false, error: firstError.error.message });

    await Promise.all((ministries.data || []).map(async m => { m.cover_url = await sign(m.cover_url); }));
    if (church.data) church.data.cover_url = await sign(church.data.cover_url);
    await Promise.all((events.data || []).map(async e => { e.image_url = await sign(e.image_url); }));
    await Promise.all((leaders.data || []).map(async l => { l.photo_url = await sign(l.photo_url); }));

    // Each album's thumbnail is its first photo.
    const firstPhoto = {};
    (photos.data || []).forEach(p => { if (!firstPhoto[p.album_id]) firstPhoto[p.album_id] = p.file_url; });
    await Promise.all((albums.data || []).map(async a => { a.cover_url = await sign(firstPhoto[a.id]); }));

    res.status(200).json({
      ok: true,
      church: church.data || null,
      ministries: ministries.data || [],
      events: events.data || [],
      videos: videos.data || [],
      albums: albums.data || [],
      photos: (photos.data || []).map(p => ({ id: p.id, album_id: p.album_id })),
      sermons: sermons.data || [],
      leaders: leaders.data || []
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};