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

// ⚠️ TEMPORARY — reset admin password. Buka /fix-admin sekali, terus HAPUS.
app.get('/fix-admin', async (_req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const { pool } = require('./db');
    const hash = await bcrypt.hash('admin123', 10);

    const { rows } = await pool.query(
      `UPDATE users SET password_hash=$1, is_admin=TRUE, token_limit=-1
       WHERE username='admin' RETURNING id, username, is_admin`,
      [hash]
    );

    if (!rows.length) {
      const ins = await pool.query(
        `INSERT INTO users (username, password_hash, is_admin, token_limit, token_remaining, badge)
         VALUES ('admin', $1, TRUE, -1, 0, 'basic') RETURNING id, username, is_admin`,
        [hash]
      );
      return res.json({ ok: true, created: ins.rows[0], password: 'admin123' });
    }

    res.json({ ok: true, updated: rows[0], password: 'admin123' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Static Admin Panel
app.use('/admin', express.static(path.join(__dirname, '..', 'public')));
app.get('/admin', (_req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

// Public API
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/user',          require('./routes/user'));
app.use('/api',               require('./routes/catalog'));
app.use('/api/badges',        require('./routes/badges'));
app.use('/api/payment',       require('./routes/payment'));
app.use('/api/chat',          require('./routes/chat'));
app.use('/api/notifications', require('./routes/notifications'));

// Admin API
app.use('/api/admin',         require('./routes/admin'));

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error('uncaught', err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => console.log(`✓ ROXUVERSE API listening on :${PORT}`));

module.exports = app;
