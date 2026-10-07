require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PORT } = require('./config');

const app = express();
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (_req, res) => res.json({ ok: true, service: 'roxuverse-backend' }));
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ─── Static Admin Panel ─────────────────────────────────
app.use('/admin', express.static(path.join(__dirname, '..', 'public')));
app.get('/admin', (_req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

// ─── Public API ─────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/user',          require('./routes/user'));
app.use('/api',               require('./routes/catalog'));
app.use('/api/badges',        require('./routes/badges'));
app.use('/api/payment',       require('./routes/payment'));
app.use('/api/chat',          require('./routes/chat'));
app.use('/api/notifications', require('./routes/notifications'));

// ─── Admin API ──────────────────────────────────────────
app.use('/api/admin',         require('./routes/admin'));

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error('uncaught', err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => console.log(`✓ ROXUVERSE API listening on :${PORT}`));

module.exports = app;
