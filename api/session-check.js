const { isAdmin } = require('./_session');

module.exports = async (req, res) => {
  res.status(200).json({ ok: true, loggedIn: isAdmin(req) });
};