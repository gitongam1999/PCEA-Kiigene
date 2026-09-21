const { setSessionCookie, clearSessionCookie } = require('./_session');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    let body = req.body;
    if (!body || typeof body === 'string') {
      try { body = JSON.parse(body || '{}'); } catch { body = {}; }
    }
    const { email, password } = body;

    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      setSessionCookie(res);
      return res.status(200).json({ ok: true });
    }
    return res.status(401).json({ ok: false, error: 'Invalid email or password' });
  }

  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
};