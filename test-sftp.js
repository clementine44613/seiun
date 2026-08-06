// Test the SFTP connection and check whether whitelist.json exists on the server.
// Run with: node test-sftp.js
require('dotenv').config();
const { SftpConnection } = require('./src/sftp');

(async () => {
  const config = {
    host: process.env.SFTP_HOST || 'sftp.discord.sgp2.shockbyte.host',
    port: parseInt(process.env.SFTP_PORT || '2222', 10),
    username: process.env.SFTP_USERNAME || '',
    password: process.env.SFTP_PASSWORD || '',
    whitelistPath: process.env.WHITELIST_PATH || 'whitelist.json',
  };

  console.log('--- SFTP Connection Test ---');
  console.log('Host:', config.host);
  console.log('Port:', config.port);
  console.log('Username:', config.username);
  console.log('Password set:', config.password ? 'yes (length ' + config.password.length + ')' : 'NO');
  console.log('Whitelist path:', config.whitelistPath);
  console.log('');

  if (!config.username || !config.password) {
    console.log('❌ Missing SFTP_USERNAME or SFTP_PASSWORD in .env');
    process.exit(1);
  }

  const sftp = new SftpConnection(config);

  try {
    await sftp.connect();
    console.log('✅ Connected to SFTP successfully!');

    const exists = await sftp.whitelistExists();
    if (exists) {
      console.log(`✅ whitelist.json exists (${sftp.whitelistPath})!`);
      const raw = await sftp.readWhitelist();
      console.log('📄 Contents:');
      console.log(raw);
      console.log('');
      console.log('SFTP is FULLY WORKING! The bot can read/write whitelist.json.');
    } else {
      console.log(`⚠️  whitelist.json does NOT exist (checked: ${sftp.whitelistPath}).`);
      console.log('');
      console.log('This happens when the server has never whitelisted anyone yet OR');
      console.log('whitelist mode is not enabled. To fix:');
      console.log('');
      console.log('  1. Open your Shockbyte panel → Server Settings / server.properties');
      console.log('  2. Set  white-list=true');
      console.log('  3. Restart the server');
      console.log('  4. In the game or console, run:  /whitelist add <ANY_NAME>');
      console.log('');
      console.log('This makes the server CREATE whitelist.json. Then the bot can access it.');
      console.log('Alternatively, add the file via the panel File Manager, but restarting');
      console.log('after setting white-list=true is the cleanest way.');
    }
  } catch (err) {
    console.log('');
    console.log('❌ SFTP test FAILED:', err.message);
    console.log('');
    console.log('Possible causes:');
    console.log('  - SFTP host/port is wrong');
    console.log('  - SFTP username or password is incorrect');
    console.log('  - Password not set in the panel (click "Update Password")');
    console.log('  - The account lacks permission to read whitelist.json');
  } finally {
    await sftp.disconnect().catch(() => {});
    process.exit(0);
  }
})();
