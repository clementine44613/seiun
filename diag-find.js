// Probe common Shockbyte file locations to find whitelist.json.
// Run with: node diag-find.js
require('dotenv').config();
const SftpClient = require('ssh2-sftp-client');

// Shockbyte Discord panel often nests server files in subfolders.
const candidates = [
  '/whitelist.json',
  '/server/whitelist.json',
  '/minecraft/whitelist.json',
  '/mc/whitelist.json',
  '/servers/whitelist.json',
  '/data/whitelist.json',
  '/home/whitelist.json',
  '/home/container/whitelist.json',
  '/app/whitelist.json',
  '/container/whitelist.json',
  '/root/whitelist.json',
  '/paper/whitelist.json',
  '/serverfiles/whitelist.json',
  '/files/whitelist.json',
  '/whitelist/whitelist.json',
];

(async () => {
  const config = {
    host: process.env.SFTP_HOST,
    port: parseInt(process.env.SFTP_PORT, 10),
    username: process.env.SFTP_USERNAME,
    password: process.env.SFTP_PASSWORD,
  };

  const client = new SftpClient();
  await client.connect(config);
  console.log('✅ Connected\n');

  console.log('--- Testing stat on candidate paths ---');
  for (const p of candidates) {
    try {
      const st = await client.stat(p);
      console.log(`✅ stat(${p}) => size=${st.size}`);
    } catch (e) {
      // silent, just note it's not found
      console.log(`❌ stat(${p})`);
    }
  }

  console.log('\n--- Testing realPath on candidates ---');
  for (const p of candidates) {
    try {
      const rp = await client.realPath(p);
      console.log(`realPath(${p}) => ${rp}`);
    } catch (e) {
      console.log(`realPath(${p}) ERROR: ${e.message}`);
    }
  }

  await client.end();
  console.log('\nDone');
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
