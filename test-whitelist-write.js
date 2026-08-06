// Test adding and removing a player via the actual service (write path).
// This adds a throwaway player then removes them, leaving the whitelist unchanged.
// Run with: node test-whitelist-write.js
require('dotenv').config();
const { createWhitelistService } = require('./src/whitelist');

(async () => {
  const config = require('./src/config');
  const whitelist = createWhitelistService(config);

  const testPlayer = 'BlackboxTest'; // non-existent MC account -> addPlayer will reject

  console.log('Whitelist path:', config.sftp.whitelistPath);
  console.log('');

  try {
    // 1. Try addPlayer with a non-existent Minecraft account (should be rejected at Mojang check)
    const addResult = await whitelist.addPlayer(testPlayer);
    console.log('addPlayer(nonexistent) =>', addResult);

    // 2. Try removePlayer (should say not on whitelist)
    const removeResult = await whitelist.removePlayer(testPlayer);
    console.log('removePlayer =>', removeResult.message);

    // 3. Confirm the real whitelist is intact
    const list = await whitelist.listWhitelisted();
    console.log('Final whitelist =>', list);
  } catch (err) {
    console.error('❌ FAILED:', err.message);
  } finally {
    await whitelist.sftp.disconnect().catch(() => {});
    process.exit(0);
  }
})();
