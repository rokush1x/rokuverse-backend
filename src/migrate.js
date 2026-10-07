require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

(async () => {
  console.log('\n========== MIGRATE START ==========');
  console.log('DATABASE_URL set?', !!process.env.DATABASE_URL);

  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      console.log('DB host :', u.host);
      console.log('DB name :', u.pathname.slice(1));
      console.log('DB user :', u.username);
      console.log('DB ssl  :', u.searchParams.get('sslmode') || '(not set)');
    } catch (e) {
      console.log('URL parse error:', e.message);
    }
  } else {
    console.error('❌ DATABASE_URL is empty!');
    process.exit(1);
  }

  // Test koneksi dulu sebelum run SQL
  try {
    console.log('\n[1/2] Testing connection...');
    const r = await pool.query('SELECT NOW() AS now, current_database() AS db');
    console.log('  ✓ Connected. Server time:', r.rows[0].now);
    console.log('  ✓ Current DB:', r.rows[0].db);
  } catch (err) {
    console.error('\n❌ CONNECTION FAILED!');
    console.error('  Name    :', err.name);
    console.error('  Code    :', err.code);
    console.error('  Message :', err.message);
    console.error('  Stack   :', err.stack);
    await pool.end().catch(() => {});
    process.exit(1);
  }

  // Run migration SQL
  try {
    console.log('\n[2/2] Running migration SQL...');
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'migrations', '001_init.sql'), 'utf8'
    );
    console.log('  SQL file size:', sql.length, 'chars');
    await pool.query(sql);
    console.log('  ✓ Migration SQL OK');
  } catch (err) {
    console.error('\n❌ MIGRATION SQL FAILED!');
    console.error('  Name    :', err.name);
    console.error('  Code    :', err.code);
    console.error('  Message :', err.message);
    console.error('  Detail  :', err.detail);
    console.error('  Hint    :', err.hint);
    console.error('  Position:', err.position);
    console.error('  Stack   :', err.stack);
    await pool.end().catch(() => {});
    process.exit(1);
  }

  console.log('\n✓ MIGRATION COMPLETE\n');
  await pool.end();
  process.exit(0);
})();
