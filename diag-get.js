// Try GET operations on candidate paths to find whitelist.json.
// Run with: node diag-get.js
require('dotenv').config();
const SftpClient = require('ssh2-sftp-client');

(async () => {
  const config = {
    host: process.env.SFTP_HOST,
    port: parseInt(process.env.SFTP_PORT, 10),
    username: process.env.SFTP_USERNAME,
    password: process.env.SFTP_PASSWORD,
  };

  const uid = config.username.split('@')[1] || '';
  console.log('Server UID:', uid);

  const candidates = [
    '/whitelist.json',
    'whitelist.json',
    `/server/${uid}/whitelist.json`,
    `/servers/${uid}/whitelist.json`,
    `/data/${uid}/whitelist.json`,
    `/${uid}/whitelist.json`,
    `/default/whitelist.json`,
    `whitelist.json`,
    `./whitelist.json`,
    `home/whitelist.json`,
  ];

  const client = new SftpClient();
  await client.connect(config);
  console.log('✅ Connected\n');

  console.log('--- Trying get() ---');
  for (const p of candidates) {
    try {
      const data = await client.get(p);
      const txt = data.toString('utf8');
      console.log(`✅ get(${p}) => ${txt.slice(0, 100)}`);
    } catch (e) {
      console.log(`❌ get(${p}) => ${e.message.slice(0, 60)}`);
    }
  }

  await client.end();
  console.log('\nDone');
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
