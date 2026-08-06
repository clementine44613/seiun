// More targeted Shockbyte agent discovery.
// Shockbyte gateway uses "agent" as first path segment. Common agent names:
// the server resource type or a specific identifier.
// Run with: node diag-agent3.js
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
  const name = config.username.split('@')[0] || '';

  // Try common Shockbyte agent identifiers
  const agents = [
    'minecraft', 'mc', 'server', 'servers', 'gaming', 'game', 'files',
    'file', 'panel', 'control', 'resource', 'resources', 'instance',
    'instances', 'node', 'nodes', 'default', 'main', 'primary',
  ];

  // Also try the full path patterns that Shockbyte docs mention
  const fullPaths = [
    `/${uid}/whitelist.json`,
    `/${uid}/files/whitelist.json`,
    `/${uid}/server/whitelist.json`,
    `/servers/${uid}/whitelist.json`,
    `/server/${uid}/whitelist.json`,
    `/files/${uid}/whitelist.json`,
    `/minecraft/${uid}/whitelist.json`,
    `/mc/${uid}/whitelist.json`,
    `/instance/${uid}/whitelist.json`,
    `/instances/${uid}/whitelist.json`,
    `/data/${uid}/whitelist.json`,
    `/home/container/whitelist.json`,
    `/container/whitelist.json`,
    `/app/whitelist.json`,
    `/root/whitelist.json`,
    `/whitelist.json`,
    `whitelist.json`,
  ];

  const client = new SftpClient();
  await client.connect(config);
  console.log('✅ Connected\n');

  console.log('--- Trying get() with UID-prefixed paths ---');
  for (const p of fullPaths) {
    try {
      const data = await client.get(p);
      console.log(`✅ get(${p}) => ${data.toString('utf8').slice(0, 100)}`);
    } catch (e) {
      // skip
    }
  }

  console.log('\n--- Trying stat() with UID-prefixed paths ---');
  for (const p of fullPaths) {
    try {
      const st = await client.stat(p);
      console.log(`✅ stat(${p}) => size=${st.size}`);
    } catch (e) {
      // skip
    }
  }

  await client.end();
  console.log('\nDone');
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
