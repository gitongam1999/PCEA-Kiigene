require('dotenv').config();
const express = require('express');
const app = express();

app.get('/api/ping', require('./api/ping'));
app.get('/api/content', require('./api/content'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Local server on http://localhost:${PORT}`));