const router = require('express').Router();
const { pool } = require('../db');
const { auth } = require('../middleware/auth');
const { levelFromXP } = require('../utils/helpers');

// GET /api/products
router.get('/products', auth, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, icon, color, description AS desc, price, tag
     FROM products WHERE enabled = TRUE ORDER BY id`
  );
  res.json({ products: rows.map((r) => ({ ...r, price: Number(r.price) })) });
});

// GET /api/tools
router.get('/tools', auth, async (req, res) => {
  const lvl = levelFromXP(req.user.xp);
  const { rows } = await pool.query(
    `SELECT id, name, icon, color, description AS desc,
            required_level, required_badge, token_cost
     FROM tools WHERE enabled = TRUE ORDER BY id`
  );

  const tools = rows.map((t) => {
    const levelOk = lvl >= (t.required_level || 0);
    const badgeOk = !t.required_badge || req.user.badge === t.required_badge;
    const tokenOk = req.user.token_limit === -1 || req.user.token_remaining >= t.token_cost;
    return {
      id: String(t.id),
      name: t.name,
      icon: t.icon,
      color: t.color,
      desc: t.desc,
      locked: !(levelOk && badgeOk && tokenOk)
    };
  });

  res.json({ tools });
});

// GET /api/payment/methods
router.get('/payment/methods', auth, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT code, name, icon, type, config
     FROM payment_methods WHERE enabled = TRUE ORDER BY id`
  );
  const methods = rows.map((r) => ({ ...r, ...r.config, config: undefined }));
  res.json({ methods });
});

module.exports = router;
