// Probe Shockbyte 'agent' path convention using the username prefix.
// Run with: node diag-agent.js
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
  const agent = config.username.split('@')[0] || 'default';
  console.log('agent:', agent, '| uid:', uid);

  const candidates = [
    `whitelist.json`,
    `${agent}/whitelist.json`,
    `${uid}/whitelist.json`,
    `${agent}/${uid}/whitelist.json`,
    `default/whitelist.json`,
    `default/whitelist.json`,
    `/default/whitelist.json`,
    `minecraft/whitelist.json`,
  ];

  const client = new SftpClient();
  await client.connect(config);
  console.log('✅ Connected\n');

  console.log('--- Trying get with agent prefixes ---');
  for (const p of candidates) {
    try {
      const data = await client.get(p);
      console.log(`✅ get(${p}) => ${data.toString('utf8').slice(0, 80)}`);
    } catch (e) {
      console.log(`❌ get(${p}) => ${e.message.slice(0, 55)}`);
    }
  }

  console.log('\n--- Trying list with agent prefixes ---');
  for (const p of [agent, `default`, `${uid}`, `minecraft`, `server`]) {
    try {
      const list = await client.list(p);
      console.log(`list(${p}) =>`, list.map((f) => `${f.type} ${f.name}`).join(', '));
    } catch (e) {
      console.log(`list(${p}) ERROR:`, e.message.slice(0, 55));
    }
  }

  await client.end();
  console.log('\nDone');
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
