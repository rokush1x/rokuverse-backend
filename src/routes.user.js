const router = require('express').Router();
const { pool } = require('../db');
const { auth } = require('../middleware/auth');
const { stripUser } = require('../utils/helpers');

// GET /api/user/me
router.get('/me', auth, async (req, res) => {
  const u = req.user;

  const [{ rows: badgeRows }, { rows: statRows }] = await Promise.all([
    pool.query('SELECT badge FROM user_badges WHERE user_id = $1', [u.id]),
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status='pending')  AS pending,
         COUNT(*) FILTER (WHERE status='approved') AS success
       FROM deposits WHERE user_id = $1`, [u.id]
    )
  ]);

  const owned_badges = badgeRows.map((r) => r.badge);
  if (!owned_badges.includes('basic')) owned_badges.push('basic');

  res.json({
    ...stripUser(u),
    owned_badges,
    stats: {
      active: u.is_banned ? 0 : 1,
      success: Number(statRows[0]?.success || 0),
      pending: Number(statRows[0]?.pending || 0)
    }
  });
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
    console.error('avatar err', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
