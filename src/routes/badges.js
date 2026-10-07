const router = require('express').Router();
const { pool, tx } = require('../db');
const { auth } = require('../middleware/auth');
const { BADGES } = require('../config');
const { levelFromXP } = require('../utils/helpers');

async function getOwned(userId, client = pool) {
  const { rows } = await client.query(
    'SELECT badge, expires_at FROM user_badges WHERE user_id = $1', [userId]
  );
  const list = rows
    .filter((r) => !r.expires_at || new Date(r.expires_at) > new Date())
    .map((r) => r.badge);
  if (!list.includes('basic')) list.push('basic');
  return list;
}

function respFrom(user, owned) {
  return {
    balance: Number(user.balance),
    badge: user.badge,
    owned_badges: owned,
    token_limit: user.token_limit,
    token_remaining: user.token_remaining,
    special_expiry: user.special_expiry,
    xp: user.xp
  };
}

// POST /api/badges/buy
router.post('/buy', auth, async (req, res) => {
  const { badge } = req.body || {};
  const cfg = BADGES[badge];
  if (!cfg) return res.status(400).json({ error: 'Badge tidak dikenal' });
  if (cfg.price <= 0) return res.status(400).json({ error: 'Badge ini gratis' });

  try {
    const result = await tx(async (client) => {
      const { rows } = await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [req.user.id]);
      const user = rows[0];

      const owned = await getOwned(user.id, client);
      if (owned.includes(badge)) throw Object.assign(new Error('Sudah dimiliki'), { code: 400 });

      const lvl = levelFromXP(user.xp);
      if (lvl < cfg.level) throw Object.assign(new Error(`Butuh Level ${cfg.level}`), { code: 400 });

      if (Number(user.balance) < cfg.price) throw Object.assign(new Error('Saldo kurang'), { code: 400 });

      const expiresAt = cfg.expiresDays
        ? new Date(Date.now() + cfg.expiresDays * 86400000)
        : null;

      const { rows: updated } = await client.query(
        `UPDATE users
         SET balance = balance - $1,
             badge = $2,
             special_expiry = COALESCE($3, special_expiry),
             token_limit = GREATEST(token_limit, 0),
             updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [cfg.price, badge, expiresAt, user.id]
      );

      await client.query(
        'INSERT INTO user_badges (user_id, badge, expires_at) VALUES ($1, $2, $3)',
        [user.id, badge, expiresAt]
      );
      await client.query(
        'INSERT INTO transactions (user_id, type, amount, note) VALUES ($1,$2,$3,$4)',
        [user.id, 'badge', -cfg.price, `Purchase badge ${badge}`]
      );

      return { user: updated[0], owned: await getOwned(user.id, client) };
    });

    res.json(respFrom(result.user, result.owned));
  } catch (err) {
    console.error('badge buy', err);
    res.status(err.code || 500).json({ error: err.message || 'Server error' });
  }
});

// POST /api/badges/equip
router.post('/equip', auth, async (req, res) => {
  const { badge } = req.body || {};
  if (!BADGES[badge]) return res.status(400).json({ error: 'Badge tidak dikenal' });

  try {
    const owned = await getOwned(req.user.id);
    if (!owned.includes(badge)) return res.status(400).json({ error: 'Belum dimiliki' });

    const { rows } = await pool.query(
      'UPDATE users SET badge=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [badge, req.user.id]
    );
    res.json(respFrom(rows[0], owned));
  } catch (err) {
    console.error('badge equip', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
