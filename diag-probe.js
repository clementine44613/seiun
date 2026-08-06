// Probe the Shockbyte SFTP gateway's supported operations and path schema.
// Run with: node diag-probe.js
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

  console.log('--- pwd / cwd ---');
  try { console.log('Default CWD:', await client.cwd()); } catch (e) { console.log('cwd ERROR:', e.message); }

  // Try to find the home dir via the SFTP channel's realpath of current dir
  console.log('\n--- realPath of various ---');
  for (const p of ['', '.', './', '//', '@', 'server', 'mc', 'default', 'root']) {
    try { console.log(`realPath(${JSON.stringify(p)}) =>`, await client.realPath(p)); }
    catch (e) { console.log(`realPath(${JSON.stringify(p)}) ERROR:`, e.message.slice(0, 50)); }
  }

  console.log('\n--- Try list on likely agent roots ---');
  for (const p of ['/', '', '.', 'server', 'servers', 'default', 'minecraft', 'data', 'home']) {
    try {
      const list = await client.list(p);
      console.log(`list(${JSON.stringify(p)}) =>`, list.map((f) => `${f.type} ${f.name}`).join(', '));
    } catch (e) {
      console.log(`list(${JSON.stringify(p)}) ERROR:`, e.message.slice(0, 55));
    }
  }

  await client.end();
  console.log('\nDone');
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
