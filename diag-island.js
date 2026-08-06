// Access whitelist.json using the server name as the agent.
// The root listing showed: "1. Meow's Island"
// Run with: node diag-island.js
require('dotenv').config();
const SftpClient = require('ssh2-sftp-client');

(async () => {
  const config = {
    host: process.env.SFTP_HOST,
    port: parseInt(process.env.SFTP_PORT, 10),
    username: process.env.SFTP_USERNAME,
    password: process.env.SFTP_PASSWORD,
  };

  const serverName = "1. Meow's Island";

  const candidates = [
    `${serverName}/whitelist.json`,
    `${serverName}/minecraft/whitelist.json`,
    `${serverName}/server/whitelist.json`,
    `${serverName}/files/whitelist.json`,
    `${serverName}/data/whitelist.json`,
    `${serverName}/whitelist/whitelist.json`,
    `/${serverName}/whitelist.json`,
    `${serverName}/whitelist.json`,
  ];

  const client = new SftpClient();
  await client.connect(config);
  console.log('✅ Connected\n');

  // First, list the server directory to see its contents
  console.log(`--- list(${serverName}) ---`);
  for (const p of [serverName, `/${serverName}`, `/${serverName}/`]) {
    try {
      const list = await client.list(p);
      console.log(`✅ list(${p}) =>`);
      list.forEach((f) => console.log(`  ${f.type} ${f.name}`));
    } catch (e) {
      console.log(`❌ list(${p}): ${e.message.slice(0, 60)}`);
    }
  }

  console.log('\n--- get(agent/whitelist.json) ---');
  for (const p of candidates) {
    try {
      const data = await client.get(p);
      console.log(`✅ get(${p}) => ${data.toString('utf8').slice(0, 150)}`);
    } catch (e) {
      console.log(`❌ get(${p}): ${e.message.slice(0, 60)}`);
    }
  }

  await client.end();
  console.log('\nDone');
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
