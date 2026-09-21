const crypto = require('crypto');

function sign(value) {
  const h = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('hex');
  return `${value}.${h}`;
}
function verify(signed) {
  if (!signed) return false;
  const idx = signed.lastIndexOf('.');
  if (idx === -1) return false;
  const value = signed.slice(0, idx);
  const expected = sign(value);
  return crypto.timingSafeEqual(Buffer.from(signed), Buffer.from(expected)) ? value : false;
}

function setSessionCookie(res) {
  const token = sign('admin:' + Date.now());
  res.setHeader('Set-Cookie',
    `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${60 * 60 * 8}`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}
function isAdmin(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('admin_session='));
  if (!match) return false;
  const token = match.split('=')[1];
  return !!verify(token);
}

module.exports = { setSessionCookie, clearSessionCookie, isAdmin };