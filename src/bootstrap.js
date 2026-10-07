// Runs migrations → seed → server. Used on Railway.
require('dotenv').config();
const path = require('path');
const { spawn } = require('child_process');

function runNode(script) {
  return new Promise((resolve, reject) => {
    console.log(`\n[bootstrap] ▶ Running ${script}...`);
    const p = spawn(process.execPath, [path.join(__dirname, script)], {
      stdio: 'inherit',
      env: process.env
    });
    p.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code}`));
    });
    p.on('error', reject);
  });
}

(async () => {
  console.log('\n========== BOOTSTRAP START ==========');
  console.log('Node version :', process.version);
  console.log('CWD          :', process.cwd());
  console.log('PORT         :', process.env.PORT || '(not set, default 3000)');

  console.log('\n--- ENV CHECK ---');
  console.log('DATABASE_URL set? :', !!process.env.DATABASE_URL);
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      console.log('  DB host  :', url.host);
      console.log('  DB name  :', url.pathname.slice(1));
      console.log('  DB user  :', url.username);
      console.log('  DB has pw:', !!url.password);
    } catch (e) {
      console.log('  ⚠️  DATABASE_URL format invalid:', e.message);
    }
  } else {
    console.log('  ⚠️  DATABASE_URL is MISSING!');
  }
  console.log('JWT_SECRET set?   :', !!process.env.JWT_SECRET);
  console.log('ADMIN_USERNAME    :', process.env.ADMIN_USERNAME || '(not set)');
  console.log('ADMIN_PASSWORD set:', !!process.env.ADMIN_PASSWORD);
  console.log('NODE_ENV          :', process.env.NODE_ENV || '(not set)');
  console.log('-------------------------------------\n');

  // HARD GUARD: tanpa DB, gak bisa lanjut
  if (!process.env.DATABASE_URL) {
    console.error('❌ FATAL: DATABASE_URL tidak ada.');
    console.error('   → Railway → service backend → Variables → + New → Add Reference');
    console.error('   → Pilih PostgreSQL → pilih DATABASE_URL');
    process.exit(1);
  }

  // STEP 1: MIGRATE
  try {
    await runNode('migrate.js');
    console.log('[bootstrap] ✓ Migration selesai');
  } catch (err) {
    console.error('[bootstrap] ✗ MIGRATION GAGAL:', err.message);
    console.error('   → Cek DATABASE_URL reference-nya benar.');
    process.exit(1);
  }

  // STEP 2: SEED (gagal seed tidak fatal)
  try {
    await runNode('seed.js');
    console.log('[bootstrap] ✓ Seed selesai');
  } catch (err) {
    console.error('[bootstrap] ⚠️  SEED GAGAL (lanjut start server):', err.message);
  }

  // STEP 3: SERVER
  try {
    console.log('[bootstrap] ▶ Starting Express server...');
    require('./index');
  } catch (err) {
    console.error('[bootstrap] ✗ SERVER GAGAL START:', err);
    process.exit(1);
  }
})().catch((err) => {
  console.error('❌ BOOTSTRAP FATAL:', err);
  process.exit(1);
});
