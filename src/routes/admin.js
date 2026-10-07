const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { pool, tx } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const { BADGES } = require('../config');
const { sanitize, stripUser, levelFromXP } = require('../utils/helpers');

router.use(auth, adminOnly);

/* ═══════════════════════ DASHBOARD ═══════════════════════ */
router.get('/stats', async (_req, res) => {
  try {
    const [u, d, m, b] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE is_banned)::int AS banned,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS new_24h
        FROM users`),
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE status='pending')::int AS pending,
        COUNT(*) FILTER (WHERE status='approved')::int AS approved,
        COUNT(*) FILTER (WHERE status='rejected')::int AS rejected,
        COALESCE(SUM(amount) FILTER (WHERE status='approved'),0)::bigint AS revenue
        FROM deposits`),
      pool.query(`SELECT COUNT(*)::int AS total FROM messages`),
      pool.query(`SELECT COALESCE(SUM(balance),0)::bigint AS total FROM users`)
    ]);
    res.json({
      users: u.rows[0],
      deposits: { ...d.rows[0], revenue: Number(d.rows[0].revenue) },
      messages: m.rows[0].total,
      total_balance: Number(b.rows[0].total)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ USERS ═══════════════════════ */
router.get('/users', async (req, res) => {
  try {
    const search = sanitize(req.query.search || '', 50);
    const limit  = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    let sql = `SELECT id, username, balance, xp, badge, avatar_url, special_expiry,
                      token_remaining, token_limit, is_admin, is_banned, created_at
               FROM users`;
    const params = [];
    if (search) { sql += ` WHERE username ILIKE $1`; params.push(`%${search}%`); }
    sql += ` ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await pool.query(sql, params);
    res.json({ users: rows.map(r => ({ ...r, balance: Number(r.balance) })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User tidak ditemukan' });
    const { rows: badges } = await pool.query(
      'SELECT badge, expires_at, purchased_at FROM user_badges WHERE user_id=$1', [req.params.id]);
    const { rows: txs } = await pool.query(
      'SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.params.id]);
    res.json({
      user: {
        ...stripUser(rows[0]),
        is_admin: rows[0].is_admin,
        is_banned: rows[0].is_banned,
        created_at: rows[0].created_at
      },
      badges,
      transactions: txs.map(t => ({ ...t, amount: Number(t.amount) }))
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users', async (req, res) => {
  try {
    const { username, password, balance = 0, xp = 0, is_admin = false,
            token_limit = 0, token_remaining = 0 } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username & password wajib' });

    const uname = sanitize(username, 50).toLowerCase();
    const hash  = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash, balance, xp, is_admin, token_limit, token_remaining)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [uname, hash, balance, xp, is_admin, token_limit, token_remaining]
    );
    await pool.query(
      `INSERT INTO user_badges (user_id, badge) VALUES ($1,'basic') ON CONFLICT DO NOTHING`,
      [rows[0].id]
    );
    res.json({ user: stripUser(rows[0]) });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Username sudah dipakai' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const allowed = ['balance', 'xp', 'badge', 'token_remaining', 'token_limit',
                     'is_banned', 'is_admin', 'avatar_url', 'special_expiry'];
    const fields = [];
    const values = [];
    let i = 1;
    for (const k of allowed) {
      if (k in (req.body || {})) {
        fields.push(`${k} = $${i++}`);
        values.push(req.body[k]);
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'Tidak ada field' });
    values.push(req.params.id);

    const { rows } = await pool.query(
      `UPDATE users SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${i} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'User tidak ditemukan' });
    res.json({ user: stripUser(rows[0]) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || password.length < 4)
      return res.status(400).json({ error: 'Password minimal 4 karakter' });
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id)
      return res.status(400).json({ error: 'Tidak bisa hapus akun sendiri' });
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ BADGES ═══════════════════════ */
router.post('/users/:id/grant-badge', async (req, res) => {
  try {
    const { badge, days } = req.body || {};
    if (!BADGES[badge]) return res.status(400).json({ error: 'Badge tidak valid' });
    const expiresAt = days ? new Date(Date.now() + days * 86400000) : null;

    await pool.query(
      `INSERT INTO user_badges (user_id, badge, expires_at) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, badge) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
      [req.params.id, badge, expiresAt]
    );
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message) VALUES ($1,'ok','Badge Diberikan',$2)`,
      [req.params.id, `Admin memberi kamu badge ${badge}`]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users/:id/revoke-badge', async (req, res) => {
  try {
    const { badge } = req.body || {};
    if (badge === 'basic') return res.status(400).json({ error: 'Tidak bisa revoke basic' });

    await pool.query('DELETE FROM user_badges WHERE user_id=$1 AND badge=$2', [req.params.id, badge]);
    await pool.query(`UPDATE users SET badge='basic' WHERE id=$1 AND badge=$2`,
      [req.params.id, badge]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ DEPOSITS ═══════════════════════ */
router.get('/deposits', async (req, res) => {
  try {
    const status = req.query.status;
    const where = status ? 'WHERE d.status=$1' : '';
    const params = status ? [status] : [];
    const { rows } = await pool.query(
      `SELECT d.*, u.username FROM deposits d
       JOIN users u ON u.id = d.user_id
       ${where} ORDER BY d.created_at DESC LIMIT 200`, params);
    res.json({ deposits: rows.map(r => ({ ...r, amount: Number(r.amount) })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/deposits/:id/approve', async (req, res) => {
  try {
    const result = await tx(async (client) => {
      const { rows: dRows } = await client.query(
        'SELECT * FROM deposits WHERE id=$1 FOR UPDATE', [req.params.id]);
      const dep = dRows[0];
      if (!dep) throw Object.assign(new Error('Deposit tidak ditemukan'), { code: 404 });
      if (dep.status !== 'pending') throw Object.assign(new Error('Sudah diproses'), { code: 400 });

      await client.query(
        `UPDATE deposits SET status='approved', approved_at=NOW(), approved_by=$1 WHERE id=$2`,
        [req.user.id, dep.id]);
      const { rows: uRows } = await client.query(
        'UPDATE users SET balance = balance + $1, updated_at=NOW() WHERE id=$2 RETURNING *',
        [dep.amount, dep.user_id]);
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, note, ref_id)
         VALUES ($1,'deposit',$2,$3,$4)`,
        [dep.user_id, dep.amount, `Deposit #${dep.id} approved`, dep.id]);
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES ($1,'ok','Deposit Disetujui',$2)`,
        [dep.user_id, `Saldo Rp ${Number(dep.amount).toLocaleString('id-ID')} telah ditambahkan`]);
      return uRows[0];
    });
    res.json({ ok: true, user: stripUser(result) });
  } catch (err) {
    res.status(err.code || 500).json({ error: err.message || 'Server error' });
  }
});

router.post('/deposits/:id/reject', async (req, res) => {
  try {
    const result = await tx(async (client) => {
      const { rows } = await client.query(
        'SELECT * FROM deposits WHERE id=$1 FOR UPDATE', [req.params.id]);
      const dep = rows[0];
      if (!dep) throw Object.assign(new Error('Deposit tidak ditemukan'), { code: 404 });
      if (dep.status !== 'pending') throw Object.assign(new Error('Sudah diproses'), { code: 400 });

      await client.query(
        `UPDATE deposits SET status='rejected', approved_at=NOW(), approved_by=$1 WHERE id=$2`,
        [req.user.id, dep.id]);
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES ($1,'warn','Deposit Ditolak',$2)`,
        [dep.user_id, `Deposit Rp ${Number(dep.amount).toLocaleString('id-ID')} ditolak`]);
      return dep;
    });
    res.json({ ok: true, deposit_id: result.id });
  } catch (err) {
    res.status(err.code || 500).json({ error: err.message || 'Server error' });
  }
});

/* ═══════════════════════ PRODUCTS CRUD ═══════════════════════ */
router.get('/products', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM products ORDER BY id DESC');
  res.json({ products: rows.map(r => ({ ...r, price: Number(r.price) })) });
});

router.post('/products', async (req, res) => {
  try {
    const { name, icon, color, description, price, tag, enabled = true } = req.body || {};
    if (!name || !price) return res.status(400).json({ error: 'Name & price wajib' });
    const { rows } = await pool.query(
      `INSERT INTO products (name, icon, color, description, price, tag, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [sanitize(name, 100), icon || 'fa-box', color || '#fff',
       sanitize(description || '', 500), Number(price), tag || null, enabled]);
    res.json({ product: { ...rows[0], price: Number(rows[0].price) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/products/:id', async (req, res) => {
  try {
    const allowed = ['name', 'icon', 'color', 'description', 'price', 'tag', 'enabled'];
    const fields = [], values = [];
    let i = 1;
    for (const k of allowed) {
      if (k in (req.body || {})) {
        fields.push(`${k} = $${i++}`);
        values.push(k === 'description' ? sanitize(req.body[k], 500) : req.body[k]);
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'Tidak ada field' });
    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE products SET ${fields.join(', ')} WHERE id=$${i} RETURNING *`, values);
    if (!rows[0]) return res.status(404).json({ error: 'Produk tidak ditemukan' });
    res.json({ product: { ...rows[0], price: Number(rows[0].price) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ TOOLS CRUD ═══════════════════════ */
router.get('/tools', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM tools ORDER BY id DESC');
  res.json({ tools: rows });
});

router.post('/tools', async (req, res) => {
  try {
    const { name, icon, color, description, token_cost = 1,
            required_level = 0, required_badge, enabled = true } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Name wajib' });
    const { rows } = await pool.query(
      `INSERT INTO tools (name, icon, color, description, token_cost, required_level, required_badge, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [sanitize(name, 100), icon || 'fa-wrench', color || '#fff',
       sanitize(description || '', 500), token_cost, required_level,
       required_badge || null, enabled]);
    res.json({ tool: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/tools/:id', async (req, res) => {
  try {
    const allowed = ['name', 'icon', 'color', 'description', 'token_cost',
                     'required_level', 'required_badge', 'enabled'];
    const fields = [], values = [];
    let i = 1;
    for (const k of allowed) {
      if (k in (req.body || {})) {
        fields.push(`${k} = $${i++}`);
        values.push(k === 'description' ? sanitize(req.body[k], 500) : req.body[k]);
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'Tidak ada field' });
    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE tools SET ${fields.join(', ')} WHERE id=$${i} RETURNING *`, values);
    if (!rows[0]) return res.status(404).json({ error: 'Tool tidak ditemukan' });
    res.json({ tool: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/tools/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tools WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ PAYMENT METHODS CRUD ═══════════════════════ */
router.get('/payment-methods', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM payment_methods ORDER BY id');
  res.json({ methods: rows });
});

router.post('/payment-methods', async (req, res) => {
  try {
    const { code, name, icon, type, config = {}, enabled = true } = req.body || {};
    if (!code || !name || !type) return res.status(400).json({ error: 'code, name, type wajib' });
    const { rows } = await pool.query(
      `INSERT INTO payment_methods (code, name, icon, type, config, enabled)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [sanitize(code, 30), sanitize(name, 100), icon || 'fa-wallet',
       type, JSON.stringify(config), enabled]);
    res.json({ method: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Code sudah dipakai' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/payment-methods/:id', async (req, res) => {
  try {
    const allowed = ['name', 'icon', 'type', 'config', 'enabled'];
    const fields = [], values = [];
    let i = 1;
    for (const k of allowed) {
      if (k in (req.body || {})) {
        fields.push(`${k} = $${i++}`);
        values.push(k === 'config' ? JSON.stringify(req.body[k]) : req.body[k]);
      }
    }
    if (!fields.length) return res.status(400).json({ error: 'Tidak ada field' });
    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE payment_methods SET ${fields.join(', ')} WHERE id=$${i} RETURNING *`, values);
    if (!rows[0]) return res.status(404).json({ error: 'Metode tidak ditemukan' });
    res.json({ method: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/payment-methods/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM payment_methods WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ NOTIFICATIONS ═══════════════════════ */
router.post('/notifications/broadcast', async (req, res) => {
  try {
    const { title, message, type = 'info' } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Title wajib' });
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       SELECT id, $1, $2, $3 FROM users WHERE is_banned=FALSE`,
      [type, sanitize(title, 200), sanitize(message || '', 1000)]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/notifications/send', async (req, res) => {
  try {
    const { user_id, title, message, type = 'info' } = req.body || {};
    if (!user_id || !title) return res.status(400).json({ error: 'user_id & title wajib' });
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message) VALUES ($1,$2,$3,$4)`,
      [user_id, type, sanitize(title, 200), sanitize(message || '', 1000)]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ CHAT MODERATION ═══════════════════════ */
router.get('/chat/messages', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.content, m.type, m.created_at, u.id AS user_id, u.username
       FROM messages m JOIN users u ON u.id = m.user_id
       ORDER BY m.created_at DESC LIMIT 200`);
    res.json({ messages: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/chat/messages/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM messages WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/chat/users/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM messages WHERE user_id=$1', [req.params.id]);
    res.json({ ok: true, deleted: rowCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/chat/purge', async (req, res) => {
  try {
    const { before } = req.body || {};
    const cutoff = before ? new Date(before) : new Date(Date.now() - 7 * 86400000);
    const { rowCount } = await pool.query('DELETE FROM messages WHERE created_at < $1', [cutoff]);
    res.json({ ok: true, deleted: rowCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ TRANSACTIONS LOG ═══════════════════════ */
router.get('/transactions', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const { rows } = await pool.query(
      `SELECT t.*, u.username FROM transactions t
       JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC LIMIT $1`, [limit]);
    res.json({ transactions: rows.map(r => ({ ...r, amount: Number(r.amount) })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
