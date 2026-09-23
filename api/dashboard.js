const { isAdmin } = require('./_session');
const dashboardHtml = require('./_protected/admin-dashboard-html');

module.exports = async (req, res) => {
  if (!isAdmin(req)) {
    res.writeHead(302, { Location: '/admin.html' });
    return res.end();
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(dashboardHtml);
};