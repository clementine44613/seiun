// Verify the offline UUID algorithm matches what's in whitelist.json.
// whitelist.json contains: { uuid: "771ff24a-ce81-48d4-b351-44db06a14bf6", name: "Meow450" }

const crypto = require('crypto');

// Java's UUID.nameUUIDFromBytes(("OfflinePlayer:" + name).getBytes(UTF_8))
function offlineUuid(name) {
  const bytes = Buffer.from(`OfflinePlayer:${name}`, 'utf8');
  const md5 = crypto.createHash('md5').update(bytes).digest();
  // Set the version (bits 4-7 of byte 6) to 3
  md5[6] = (md5[6] & 0x0f) | 0x30;
  // Set the variant (bits 6-7 of byte 8) to 10xx
  md5[8] = (md5[8] & 0x3f) | 0x80;
  // Format as UUID
  const hex = md5.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const expected = '771ff24a-ce81-48d4-b351-44db06a14bf6';
const computed = offlineUuid('Meow450');

console.log('Computed offline UUID for Meow450:', computed);
console.log('Expected (from whitelist.json):      ', expected);
console.log('Match?', computed === expected ? '✅ YES' : '❌ NO');
