// Test writing & reading whitelist.json via SFTP using absolute path.
// Run with: node test-sftp-write.js
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

  const path = '/whitelist.json';
  const sample = JSON.stringify([{ uuid: '00000000-0000-0000-0000-000000000000', name: 'TestPlayer' }], null, 2);

  try {
    await client.put(Buffer.from(sample, 'utf8'), path);
    console.log(`✅ Wrote ${path}`);

    const data = await client.get(path);
    console.log('Read back:', data.toString('utf8'));

    // Clean up the test file
    await client.delete(path);
    console.log('✅ Deleted test file');
  } catch (e) {
    console.log('❌ Error:', e.message);
  }

  await client.end();
  console.log('\nDone');
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
