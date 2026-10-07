// Runs migrations → seed → server. Used on Railway.
require('dotenv').config();

(async () => {
  try {
    await new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const p = spawn(process.execPath, [require('path').join(__dirname, 'migrate.js')], { stdio: 'inherit' });
      p.on('exit', (c) => c === 0 ? resolve() : reject(new Error('migrate failed')));
    });

    await new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const p = spawn(process.execPath, [require('path').join(__dirname, 'seed.js')], { stdio: 'inherit' });
      p.on('exit', (c) => c === 0 ? resolve() : reject(new Error('seed failed')));
    });

    require('./index');
  } catch (err) {
    console.error('Bootstrap error:', err.message);
    process.exit(1);
  }
})();
