const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');
const { auth } = require('../middleware/auth');
const { sanitize } = require('../utils/helpers');

const chatLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 8,
  message: { error: 'Slow down, kirim pesan terlalu cepat' }
});

const ALLOWED_TYPES = ['text', 'image', 'sticker', 'file'];
const MAX_CONTENT = 3 * 1024 * 1024; // 3MB base64 max

// GET /api/chat/messages
router.get('/messages', auth, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT m.id, m.content, m.type, m.file_name, m.file_size, m.file_type, m.created_at,
            u.username, u.badge, u.avatar_url
     FROM messages m
     JOIN users u ON u.id = m.user_id
     ORDER BY m.created_at DESC LIMIT 100`
  );

  const { rows: online } = await pool.query(
    `SELECT COUNT(DISTINCT user_id)::int AS c FROM messages
     WHERE created_at > NOW() - INTERVAL '5 minutes'`
  );

  res.json({
    messages: rows.reverse().map((m) => ({
      id: m.id,
      username: m.username,
      badge: m.badge,
      avatar_url: m.avatar_url,
      type: m.type,
      content: m.content,
      fileName: m.file_name,
      fileSize: m.file_size ? Number(m.file_size) : null,
      fileType: m.file_type,
      created_at: m.created_at
    })),
    online: online[0].c
  });
});

// POST /api/chat/messages
router.post('/messages', auth, chatLimiter, async (req, res) => {
  try {
    const { content, type = 'text', fileName, fileSize, fileType } = req.body || {};
    if (!content) return res.status(400).json({ error: 'Konten kosong' });
    if (!ALLOWED_TYPES.includes(type)) return res.status(400).json({ error: 'Tipe tidak valid' });
    if (typeof content !== 'string' || content.length > MAX_CONTENT)
      return res.status(400).json({ error: 'Konten terlalu besar' });

    const cleanContent = type === 'text' ? sanitize(content, 500) : content;

    const { rows } = await pool.query(
      `INSERT INTO messages (user_id, content, type, file_name, file_size, file_type)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [req.user.id, cleanContent, type,
       fileName ? sanitize(fileName, 255) : null,
       fileSize ? Number(fileSize) : null,
       fileType ? sanitize(fileType, 100) : null]
    );

    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error('chat send', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
