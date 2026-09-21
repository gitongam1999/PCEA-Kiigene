const supabase = require('./_db');

module.exports = async (req, res) => {
  try {
    const [church, ministries, events, videos, albums, sermons, leaders] = await Promise.all([
      supabase.from('church_info').select('*').eq('id', 1).single(),
      supabase.from('ministries').select('*').order('sort_order'),
      supabase.from('events').select('*').order('event_date', { ascending: true }),
      supabase.from('videos').select('*').order('created_at', { ascending: false }),
      supabase.from('albums').select('*').order('created_at', { ascending: false }),
      supabase.from('sermons').select('*').order('sermon_date', { ascending: false }),
      supabase.from('leaders').select('*').order('sort_order'),
    ]);

    const firstError = [ministries, events, videos, albums, sermons, leaders]
      .find(r => r.error);
    if (firstError) return res.status(500).json({ ok: false, error: firstError.error.message });

    res.status(200).json({
      ok: true,
      church: church.data || null,
      ministries: ministries.data || [],
      events: events.data || [],
      videos: videos.data || [],
      albums: albums.data || [],
      sermons: sermons.data || [],
      leaders: leaders.data || []
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};