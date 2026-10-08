require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PORT } = require('./config');

const app = express();
app.set('trust proxy', 1);

// ═══════════════════════════════════════════════════════════════════
// CORS — whitelist frontend origins
// ═══════════════════════════════════════════════════════════════════
const ALLOWED_ORIGINS = [
  'https://rokush1x.github.io',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  /^https:\/\/.*\.vercel\.app$/,
  /^https:\/\/.*\.up\.railway\.app$/,
  /^https:\/\/.*\.github\.io$/
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests tanpa origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    const allowed = ALLOWED_ORIGINS.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );

    if (allowed) return callback(null, true);

    console.log('[CORS BLOCKED]', origin);
    return callback(new Error('CORS not allowed: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight OPTIONS request
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));

// ═══════════════════════════════════════════════════════════════════
// Health check
// ═══════════════════════════════════════════════════════════════════
app.get('/', (_req, res) => res.json({ ok: true, service: 'roxuverse-backend' }));
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ═══════════════════════════════════════════════════════════════════
// Admin Panel (static)
// ═══════════════════════════════════════════════════════════════════
app.use('/admin', express.static(path.join(__dirname, '..', 'public')));
app.get('/admin', (_req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

// ═══════════════════════════════════════════════════════════════════
// API Routes
// ═══════════════════════════════════════════════════════════════════
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/user',          require('./routes/user'));
app.use('/api',               require('./routes/catalog'));
app.use('/api/badges',        require('./routes/badges'));
app.use('/api/payment',       require('./routes/payment'));
app.use('/api/chat',          require('./routes/chat'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin',         require('./routes/admin'));

// ═══════════════════════════════════════════════════════════════════
// 404 + Error handler
// ═══════════════════════════════════════════════════════════════════
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, _req, res, _next) => {
  console.error('uncaught error:', err.message);
  // Kalau error karena CORS, return status 403 dengan pesan jelas
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ error: 'CORS blocked: origin not allowed' });
  }
  res.status(500).json({ error: 'Server error' });
});

// ═══════════════════════════════════════════════════════════════════
// Start server
// ═══════════════════════════════════════════════════════════════════
app.listen(PORT, () => console.log(`✓ ROXUVERSE API listening on :${PORT}`));

module.exports = app;
