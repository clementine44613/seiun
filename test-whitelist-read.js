// Test reading the whitelist via the actual service with the corrected path.
// Run with: node test-whitelist-read.js
require('dotenv').config();
const { createWhitelistService } = require('./src/whitelist');

(async () => {
  const config = require('./src/config');
  const whitelist = createWhitelistService(config);

  console.log('Whitelist path:', config.sftp.whitelistPath);
  console.log('');

  try {
    const list = await whitelist.listWhitelisted();
    console.log('✅ listWhitelisted =>', list);

    const isMeow = await whitelist.isPlayerWhitelisted('Meow450');
    console.log('Is Meow450 whitelisted?', isMeow);

    const isNotch = await whitelist.isPlayerWhitelisted('Notch');
    console.log('Is Notch whitelisted?', isNotch);
  } catch (err) {
    console.error('❌ FAILED:', err.message);
  } finally {
    await whitelist.sftp.disconnect().catch(() => {});
    process.exit(0);
  }
})();
