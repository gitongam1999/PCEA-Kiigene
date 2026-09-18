const supabase = require('./_db');

module.exports = async (req, res) => {
  const { data, error } = await supabase.from('ministries').select('id').limit(1);
  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.status(200).json({ ok: true, ministries_table_reachable: true, sample: data });
};