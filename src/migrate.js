require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

(async () => {
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'migrations', '001_init.sql'), 'utf8'
    );
    await pool.query(sql);
    console.log('✓ Migration OK');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('✗ Migration failed:', err.message);
    process.exit(1);
  }
})();
