const router = require('express').Router();
const { pool } = require('../db');
const { auth } = require('../middleware/auth');

function ago(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s lalu`;
  if (s < 3600) return `${Math.floor(s / 60)}m lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)}j lalu`;
  return `${Math.floor(s / 86400)}h lalu`;
}

// GET /api/notifications
router.get('/', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, type, title, message, read, created_at
     FROM notifications
     WHERE user_id = $1 OR user_id IS NULL
     ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json({
    notifications: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      message: r.message,
      read: r.read,
      time_ago: ago(r.created_at)
    }))
  });
});

// POST /api/notifications/read-all
router.post('/read-all', auth, async (req, res) => {
  await pool.query(
    'UPDATE notifications SET read=TRUE WHERE user_id=$1',
    [req.user.id]
  );
  res.json({ ok: true });
});

module.exports = router;
