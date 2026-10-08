require('dotenv').config();
const express = require('express');
const path = require('path');
const { PORT } = require('./config');

const app = express();
app.set('trust proxy', 1);

// ═══════════════════════════════════════════════════════════════════
// CORS — paling permissive (allow all origins)
// ═══════════════════════════════════════════════════════════════════
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/', (_req, res) => res.json({ ok: true, service: 'roxuverse-backend' }));
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Admin Panel
app.use('/admin', express.static(path.join(__dirname, '..', 'public')));
app.get('/admin', (_req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

// API Routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/user',          require('./routes/user'));
app.use('/api',               require('./routes/catalog'));
app.use('/api/badges',        require('./routes/badges'));
app.use('/api/payment',       require('./routes/payment'));
app.use('/api/chat',          require('./routes/chat'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin',         require('./routes/admin'));

// 404 + Error
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error('uncaught error:', err.message);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => console.log(`✓ ROXUVERSE API listening on :${PORT}`));

module.exports = app;
