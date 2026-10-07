const router = require('express').Router();
const { pool } = require('../db');
const { auth } = require('../middleware/auth');

// POST /api/payment/deposit
router.post('/deposit', auth, async (req, res) => {
  try {
    const { amount, method } = req.body || {};
    const amt = Number(amount);
    if (!amt || amt < 10000) return res.status(400).json({ error: 'Minimal Rp 10.000' });
    if (amt > 10000000) return res.status(400).json({ error: 'Maksimal Rp 10.000.000' });

    const { rows: pm } = await pool.query(
      'SELECT code FROM payment_methods WHERE code=$1 AND enabled=TRUE', [method]
    );
    if (!pm[0]) return res.status(400).json({ error: 'Metode tidak valid' });

    const { rows } = await pool.query(
      'INSERT INTO deposits (user_id, amount, method) VALUES ($1,$2,$3) RETURNING id, status',
      [req.user.id, amt, method]
    );

    res.json({ deposit_id: rows[0].id, status: rows[0].status });
  } catch (err) {
    console.error('deposit', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
