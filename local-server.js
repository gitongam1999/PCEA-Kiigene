require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());
app.get('/api/ping', require('./api/ping'));
app.get('/api/content', require('./api/content'));
app.get('/api/session-check', require('./api/session-check'));
app.all('/api/auth', require('./api/auth'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Local server on http://localhost:${PORT}`));