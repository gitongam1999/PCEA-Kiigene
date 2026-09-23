const supabase = require('./_db');
const { isAdmin } = require('./_session');

const ALLOWED = ['events', 'videos', 'albums', 'sermons', 'leaders'];

module.exports = async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'Not signed in.' });

  if (req.method === 'POST') {
    let body = req.body;
    if (!body || typeof body === 'string') {
      try { body = JSON.parse(body || '{}'); } catch { body = {}; }
    }
    const { table, data } = body;
    if (!ALLOWED.includes(table)) return res.status(400).json({ ok: false, error: 'Unknown table.' });

    const { data: row, error } = await supabase.from(table).insert(data).select().single();
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, row });
  }

  if (req.method === 'DELETE') {
    const { table, id } = req.query;
    if (!ALLOWED.includes(table)) return res.status(400).json({ ok: false, error: 'Unknown table.' });

    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
};