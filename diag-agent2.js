// Brute-force discover the Shockbyte SFTP 'agent' name.
// Run with: node diag-agent2.js
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

  const agentCandidates = [
    name, uid, 'default', 'server', 'servers', 'minecraft', 'mc', 'gaming',
    'game', 'files', 'serverfiles', 'main', 'primary', 'root', 'home',
    'container', 'app', 'data', 'api', 'v1', 'sftp', 'discord',
    `default@${uid}`, `${name}@${uid}`, uid.replace(/-/g, ''),
  ];

  const client = new SftpClient();
  await client.connect(config);
  console.log('✅ Connected\n');

  console.log('--- Trying list(agent) to discover valid agents ---');
  for (const agent of agentCandidates) {
    try {
      const list = await client.list(agent);
      console.log(`✅ list(${agent}) =>`, list.map((f) => `${f.type} ${f.name}`).join(', '));
    } catch (e) {
      // not found
    }
  }

  console.log('\n--- Trying get(agent/whitelist.json) ---');
  for (const agent of agentCandidates) {
    try {
      const data = await client.get(`${agent}/whitelist.json`);
      console.log(`✅ get(${agent}/whitelist.json) =>`, data.toString('utf8').slice(0, 120));
    } catch (e) {
      // not found
    }
  }

  await client.end();
  console.log('\nDone');
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
