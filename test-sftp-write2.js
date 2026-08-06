// Test the SFTP write + read path using a SCRATCH file (not the real whitelist).
// Verifies put() and get() work on a temp path under the agent.
// Run with: node test-sftp-write2.js
require('dotenv').config();
const SftpClient = require('ssh2-sftp-client');

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

  const scratchPath = "/1. Meow's Island/.meowbot-scratch-test.json";
  const content = JSON.stringify([{ uuid: '00000000-0000-0000-0000-000000000000', name: 'ScratchTest' }], null, 2);

  try {
    await client.put(Buffer.from(content, 'utf8'), scratchPath);
    console.log(`✅ Wrote scratch file: ${scratchPath}`);

    const data = await client.get(scratchPath);
    console.log('Read back:', data.toString('utf8'));

    await client.delete(scratchPath);
    console.log('✅ Deleted scratch file');
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  await client.end();
  console.log('\nDone');
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
