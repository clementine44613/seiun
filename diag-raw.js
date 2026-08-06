// Use raw ssh2 SFTP to inspect what the Shockbyte gateway exposes.
// Run with: node diag-raw.js
require('dotenv').config();
const { Client } = require('ssh2');

(async () => {
  const config = {
    host: process.env.SFTP_HOST,
    port: parseInt(process.env.SFTP_PORT, 10),
    username: process.env.SFTP_USERNAME,
    password: process.env.SFTP_PASSWORD,
  };

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect(config);
  });
  console.log('✅ SSH connected\n');

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => (err ? reject(err) : resolve(sftp)));
  });
  console.log('✅ SFTP subsystem ready\n');

  // Read the raw OPEN/READ behavior and try to list the root.
  const paths = ['', '.', './', '/', '//', '~', 'whitelist.json', '/whitelist.json'];

  for (const p of paths) {
    try {
      const opts = { readStreamOptions: undefined };
      const res = await sftp.realpath(p, (err, result) => {
        console.log(`realpath(${JSON.stringify(p)}) =>`, err ? `ERR:${err.message}` : result);
      });
    } catch (e) {
      console.log(`realpath(${JSON.stringify(p)}) THREW:`, e.message);
    }
  }

  // Try to open a directory handle to list
  console.log('\n--- opendir/readdir ---');
  for (const p of ['', '.', '/', 'files', 'server', 'minecraft']) {
    try {
      const handle = await new Promise((resolve, reject) => {
        sftp.opendir(p, (err, h) => (err ? reject(err) : resolve(h)));
      });
      console.log(`opendir(${JSON.stringify(p)}) OK, handle=${handle.length}`);
      const entries = await new Promise((resolve, reject) => {
        sftp.readdir(handle, (err, list) => (err ? reject(err) : resolve(list)));
      });
      console.log(`  entries:`, entries.map((e) => `${e.longname}`).join('\n  '));
    } catch (e) {
      console.log(`opendir(${JSON.stringify(p)}) ERR:`, e.message.slice(0, 70));
    }
  }

  conn.end();
})().catch((e) => {
  console.error('FATAL:', e.message);
});
