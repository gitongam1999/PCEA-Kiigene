require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());
app.get('/api/ping', require('./api/ping'));
app.get('/api/content', require('./api/content'));
app.get('/api/session-check', require('./api/session-check'));
app.all('/api/auth', require('./api/auth'));
app.get('/admin.html', (req, res) => res.sendFile(require('path').join(__dirname, 'admin.html')));
app.get('/admin-dashboard', require('./api/dashboard'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Local server on http://localhost:${PORT}`));