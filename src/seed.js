require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

(async () => {
  try {
    const adminUser = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(adminPass, 10);

    console.log('[seed] Admin user:', adminUser);
    console.log('[seed] Admin pass length:', adminPass.length);

    // Admin — DO UPDATE biar password selalu ke-reset
    await pool.query(
      `INSERT INTO users (username, password_hash, is_admin, token_limit, token_remaining, badge)
       VALUES ($1, $2, TRUE, -1, 0, 'basic')
       ON CONFLICT (username) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         is_admin = TRUE,
         token_limit = -1,
         token_remaining = 0`,
      [adminUser, hash]
    );

    await pool.query(
      `INSERT INTO user_badges (user_id, badge)
       SELECT id, 'basic' FROM users WHERE username = $1
       ON CONFLICT DO NOTHING`,
      [adminUser]
    );

    // Verify password
    const { rows: verify } = await pool.query(
      'SELECT password_hash FROM users WHERE username = $1',
      [adminUser]
    );
    if (verify[0]) {
      const match = await bcrypt.compare(adminPass, verify[0].password_hash);
      console.log('[seed] ✓ Password match:', match);
    }

    // Products
    const products = [
      { name: 'Premium VIP',   icon: 'fa-crown',   color: '#ffd31a', desc: 'Akses fitur VIP 30 hari', price: 50000, tag: 'HOT' },
      { name: 'Token Pack 10', icon: 'fa-coins',   color: '#18d8f3', desc: '10 token tool',           price: 25000, tag: null  },
      { name: 'Theme Pack',    icon: 'fa-palette', color: '#875cff', desc: 'Tema eksklusif',          price: 15000, tag: null  },
      { name: 'Boost XP x2',   icon: 'fa-bolt',    color: '#ed1c24', desc: 'Double XP 24 jam',        price: 30000, tag: 'NEW' }
    ];
    for (const p of products) {
      const { rows: ex } = await pool.query('SELECT id FROM products WHERE name = $1', [p.name]);
      if (!ex.length) {
        await pool.query(
          `INSERT INTO products (name, icon, color, description, price, tag)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [p.name, p.icon, p.color, p.desc, p.price, p.tag]
        );
      }
    }

    // Tools
    const tools = [
      { name: 'Checker',    icon: 'fa-magnifying-glass',    color: '#18d8f3', desc: 'Cek akun',        cost: 1, lvl: 1  },
      { name: 'Generator',  icon: 'fa-wand-magic-sparkles', color: '#875cff', desc: 'Auto generator',  cost: 2, lvl: 10 },
      { name: 'Downloader', icon: 'fa-download',            color: '#18e36b', desc: 'Bulk downloader', cost: 1, lvl: 1  }
    ];
    for (const t of tools) {
      const { rows: ex } = await pool.query('SELECT id FROM tools WHERE name = $1', [t.name]);
      if (!ex.length) {
        await pool.query(
          `INSERT INTO tools (name, icon, color, description, token_cost, required_level)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [t.name, t.icon, t.color, t.desc, t.cost, t.lvl]
        );
      }
    }

    // Payment methods
    const methods = [
      { code: 'qris', name: 'QRIS', icon: 'fa-qrcode', type: 'qris',
        config: { qris_url: 'https://placehold.co/400x400?text=QRIS', merchant: 'ROXUVERSE', nmid: 'ID123456' } },
      { code: 'bca',  name: 'BCA',  icon: 'fa-building-columns', type: 'bank',
        config: { bank_name: 'BCA', account_number: '1234567890', account_name: 'ROKUSHI' } },
      { code: 'dana', name: 'DANA', icon: 'fa-wallet', type: 'ewallet',
        config: { wallet_name: 'DANA', phone: '081234567890', account_name: 'ROKUSHI' } }
    ];
    for (const m of methods) {
      await pool.query(
        `INSERT INTO payment_methods (code, name, icon, type, config)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           icon = EXCLUDED.icon,
           type = EXCLUDED.type,
           config = EXCLUDED.config`,
        [m.code, m.name, m.icon, m.type, JSON.stringify(m.config)]
      );
    }

    console.log('✓ Seed OK');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('✗ Seed failed:', err.message);
    console.error(err.stack);
    await pool.end().catch(() => {});
    process.exit(1);
  }
})();
