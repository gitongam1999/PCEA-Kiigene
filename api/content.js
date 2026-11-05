const supabase = require('./_db');
const { BUCKET, presignGet } = require('./_storage');

// Private-bucket files are stored as keys; turn a key into a temporary viewing link.
// downloadName makes the link save the file instead of playing it. expires is in seconds.
async function sign(key, downloadName, expires) {
  if (!key) return null;
  try { return await presignGet(BUCKET, key, expires || 3600, downloadName); } catch (e) { return null; }
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

    // One video's playing and download links, made fresh at the moment a visitor taps Watch or Download
    // (so a page left open for hours never has an expired link).
    if (req.query && req.query.video) {
      const { data: v, error } = await supabase.from('videos')
        .select('id, title, file_url, thumbnail_url').eq('id', req.query.video).single();
      if (error || !v || !v.file_url) return res.status(404).json({ ok: false, error: 'Video not found.' });
      const SIX_HOURS = 6 * 60 * 60;
      return res.status(200).json({
        ok: true,
        video: {
          id: v.id,
          title: v.title,
          src: await sign(v.file_url, undefined, SIX_HOURS),
          download: await sign(v.file_url, niceName(v.file_url), SIX_HOURS),
          poster: await sign(v.thumbnail_url)
        }
      });
    }

    // One sermon's playing and download links (audio and/or video), made fresh when a visitor taps.
    if (req.query && req.query.sermon) {
      const { data: s, error } = await supabase.from('sermons')
        .select('id, title, preacher, audio_url, video_url').eq('id', req.query.sermon).single();
      if (error || !s || (!s.audio_url && !s.video_url)) return res.status(404).json({ ok: false, error: 'Sermon not found.' });
      const SIX_HOURS = 6 * 60 * 60;
      const pack = async key => key ? {
        src: await sign(key, undefined, SIX_HOURS),
        download: await sign(key, niceName(key), SIX_HOURS)
      } : null;
      return res.status(200).json({
        ok: true,
        sermon: { id: s.id, title: s.title, preacher: s.preacher, audio: await pack(s.audio_url), video: await pack(s.video_url) }
      });
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

    // Videos: only the thumbnail is signed here. The video itself is signed when someone taps Watch.
    const videoCards = await Promise.all((videos.data || []).map(async v => ({
      id: v.id,
      ministry_id: v.ministry_id,
      title: v.title,
      description: v.description,
      length_seconds: v.length_seconds,
      created_at: v.created_at,
      thumb: await sign(v.thumbnail_url),
      has_file: !!v.file_url
    })));

    // Sermons: the files themselves are signed when someone taps Listen or Watch.
    const sermonCards = (sermons.data || []).map(s => ({
      id: s.id,
      title: s.title,
      preacher: s.preacher,
      sermon_date: s.sermon_date,
      length_seconds: s.length_seconds,
      created_at: s.created_at,
      has_audio: !!s.audio_url,
      has_video: !!s.video_url
    }));

    res.status(200).json({
      ok: true,
      church: church.data || null,
      ministries: ministries.data || [],
      events: events.data || [],
      videos: videoCards,
      albums: albums.data || [],
      photos: (photos.data || []).map(p => ({ id: p.id, album_id: p.album_id })),
      sermons: sermonCards,
      leaders: leaders.data || []
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};