// Investigate what UUID the existing whitelist entry corresponds to.
const crypto = require('crypto');

const existing = '771ff24a-ce81-48d4-b351-44db06a14bf6';

// Standard offline UUID (OfflinePlayer:name)
function offlineUuidStandard(name) {
  const md5 = crypto.createHash('md5').update(`OfflinePlayer:${name}`, 'utf8').digest();
  md5[6] = (md5[6] & 0x0f) | 0x30;
  md5[8] = (md5[8] & 0x3f) | 0x80;
  const h = md5.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Offline UUID without the special prefix, just name
function offlineUuidNameOnly(name) {
  const md5 = crypto.createHash('md5').update(name, 'utf8').digest();
  md5[6] = (md5[6] & 0x0f) | 0x30;
  md5[8] = (md5[8] & 0x3f) | 0x80;
  const h = md5.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

console.log('Existing entry UUID:', existing);
console.log('Standard offline (OfflinePlayer:Meow450):', offlineUuidStandard('Meow450'));
console.log('Name-only offline (Meow450):            ', offlineUuidNameOnly('Meow450'));
console.log('');

// Check Mojang API for Meow450 premium UUID
(async () => {
  try {
    const res = await fetch('https://api.mojang.com/users/profiles/minecraft/Meow450');
    if (res.status === 204) {
      console.log('Mojang: Meow450 -> NOT a premium account (204)');
    } else if (res.ok) {
      const data = await res.json();
      const premium = `${data.id.slice(0,8)}-${data.id.slice(8,12)}-${data.id.slice(12,16)}-${data.id.slice(16,20)}-${data.id.slice(20)}`;
      console.log('Mojang: Meow450 -> premium UUID', premium);
      console.log('Matches existing?', premium === existing ? 'YES' : 'NO');
    } else {
      console.log('Mojang: HTTP', res.status);
    }
  } catch (e) {
    console.log('Mojang check error:', e.message);
  }
})();
