const router = require('express').Router();
const { pool } = require('../db');
const { auth } = require('../middleware/auth');
const { stripUser } = require('../utils/helpers');

// GET /api/user/me
router.get('/me', auth, async (req, res) => {
  try {
    const u = req.user;

    // Query badges (safe)
    let owned_badges = ['basic'];
    try {
      const { rows: badgeRows } = await pool.query(
        'SELECT badge FROM user_badges WHERE user_id = $1',
        [u.id]
      );
      owned_badges = badgeRows.map((r) => r.badge);
      if (!owned_badges.includes('basic')) owned_badges.push('basic');
    } catch (e) {
      console.error('[user/me] badges query failed:', e.message);
    }

    // Query deposit stats (safe)
    let pending = 0, success = 0;
    try {
      const { rows: statRows } = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status='pending')::int  AS pending,
           COUNT(*) FILTER (WHERE status='approved')::int AS success
         FROM deposits WHERE user_id = $1`,
        [u.id]
      );
      if (statRows[0]) {
        pending = Number(statRows[0].pending) || 0;
        success = Number(statRows[0].success) || 0;
      }
    } catch (e) {
      console.error('[user/me] deposits query failed:', e.message);
    }

    // Query total XP dari table users (fallback kalau column xp gak ada)
    let totalXp = 0;
    try {
      totalXp = Number(u.xp) || 0;
    } catch (_) {}

    res.json({
      ...stripUser(u),
      is_admin: u.is_admin === true,
      owned_badges,
      xp: totalXp,
      stats: {
        active: u.is_banned ? 0 : 1,
        success,
        pending
      }
    });
  } catch (err) {
    console.error('[user/me] fatal:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/user/avatar
router.post('/avatar', auth, async (req, res) => {
  try {
    const { avatar_base64 } = req.body || {};
    if (typeof avatar_base64 !== 'string' || !avatar_base64.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Format avatar tidak valid' });
    }
    if (avatar_base64.length > 3 * 1024 * 1024) {
      return res.status(400).json({ error: 'Avatar terlalu besar (max 2MB)' });
    }
    await pool.query(
      'UPDATE users SET avatar_url=$1, updated_at=NOW() WHERE id=$2',
      [avatar_base64, req.user.id]
    );
    res.json({ avatar_url: avatar_base64 });
  } catch (err) {
    console.error('[user/avatar] failed:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
