require('dotenv').config();
const express = require('express');
const path = require('path');
const { PORT } = require('./config');

const app = express();
app.set('trust proxy', 1);

// ===== CORS MANUAL =====
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, Origin'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// ===== BODY PARSER =====
app.use(express.json({ limit: '10mb' }));

// ===== HEALTH CHECK =====
app.get('/', (_req, res) => res.json({ ok: true, service: 'roxuverse-backend' }));
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ===== ADMIN PANEL =====
app.use('/admin', express.static(path.join(__dirname, '..', 'public')));
app.get('/admin', (_req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

// ===== API ROUTES =====
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/user',          require('./routes/user'));
app.use('/api',               require('./routes/catalog'));
app.use('/api/badges',        require('./routes/badges'));
app.use('/api/payment',       require('./routes/payment'));
app.use('/api/chat',          require('./routes/chat'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin',         require('./routes/admin'));

// ===== 404 & ERROR =====
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error('uncaught error:', err.message);
  res.status(500).json({ error: 'Server error' });
});

// ===== START =====
app.listen(PORT, () => console.log(`✓ ROXUVERSE API listening on :${PORT}`));

module.exports = app;
