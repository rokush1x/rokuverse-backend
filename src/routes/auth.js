const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');
const { signToken, stripUser } = require('../utils/helpers');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Terlalu banyak percobaan, coba lagi nanti' }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password)
      return res.status(400).json({ error: 'Username & password wajib' });

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [String(username).trim().toLowerCase()]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Username / password salah' });
    if (user.is_banned) return res.status(403).json({ error: 'Account banned' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Username / password salah' });

    const { rows: badgeRows } = await pool.query(
      'SELECT badge FROM user_badges WHERE user_id = $1',
      [user.id]
    );
    const owned_badges = badgeRows.map((r) => r.badge);
    if (!owned_badges.includes('basic')) owned_badges.push('basic');

    res.json({
      token: signToken(user),
      user: {
        ...stripUser(user),
        is_admin: user.is_admin === true,
        owned_badges
      }
    });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
