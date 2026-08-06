// Deep diagnostic for Shockbyte's SFTP gateway path handling.
// Run with: node diag-sftp.js
require('dotenv').config();
const SftpClient = require('ssh2-sftp-client');

(async () => {
  const config = {
    host: process.env.SFTP_HOST,
    port: parseInt(process.env.SFTP_PORT, 10),
    username: process.env.SFTP_USERNAME,
    password: process.env.SFTP_PASSWORD,
  };

  console.log('Connecting to', config.host, config.port, 'as', config.username);
  const client = new SftpClient();
  await client.connect(config);
  console.log('✅ Connected\n');

  // Try to discover the working directory / realpath
  const probes = ['.', '..', '/', '~', 'whitelist.json', '/whitelist.json'];
  for (const p of probes) {
    try {
      const rp = await client.realPath(p);
      console.log(`realPath(${JSON.stringify(p)}) => ${JSON.stringify(rp)}`);
    } catch (e) {
      console.log(`realPath(${JSON.stringify(p)}) ERROR: ${e.message}`);
    }
  }

  console.log('\n--- Attempting list ---');
  for (const p of ['.', '/', '~']) {
    try {
      const list = await client.list(p);
      console.log(`list(${JSON.stringify(p)}) =>`, list.map((f) => `${f.type} ${f.name}`));
    } catch (e) {
      console.log(`list(${JSON.stringify(p)}) ERROR: ${e.message}`);
    }
  }

  console.log('\n--- Attempting stat ---');
  for (const p of ['whitelist.json', '.', 'server.properties']) {
    try {
      const st = await client.stat(p);
      console.log(`stat(${JSON.stringify(p)}) =>`, st);
    } catch (e) {
      console.log(`stat(${JSON.stringify(p)}) ERROR: ${e.message}`);
    }
  }

  await client.end();
  console.log('\nDone');
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
