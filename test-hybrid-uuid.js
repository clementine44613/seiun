// Test the hybrid UUID resolution: premium players get Mojang UUID,
// cracked players get offline UUID.
const crypto = require('crypto');

// Replicate resolveUuid logic from src/whitelist.js
async function getMojangUuid(username) {
  const url = `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`;
  try {
    const res = await fetch(url);
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`Mojang API error ${res.status}`);
    const data = await res.json();
    return data.id || null;
  } catch (e) {
    return null;
  }
}

function getOfflineUuid(username) {
  const md5 = crypto.createHash('md5').update(`OfflinePlayer:${username}`, 'utf8').digest();
  md5[6] = (md5[6] & 0x0f) | 0x30;
  md5[8] = (md5[8] & 0x3f) | 0x80;
  const h = md5.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function resolveUuid(username) {
  const premium = await getMojangUuid(username);
  if (premium) {
    return premium.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  }
  return getOfflineUuid(username);
}

(async () => {
  // Meow450 is premium -> real UUID
  const meow = await resolveUuid('Meow450');
  console.log('Meow450 (premium):  ', meow);
  console.log('Expected:           ', '771ff24a-ce81-48d4-b351-44db06a14bf6');
  console.log('Match premium?      ', meow === '771ff24a-ce81-48d4-b351-44db06a14bf6' ? '✅' : '❌');
  console.log('');

  // Notch is premium -> real UUID
  const notch = await resolveUuid('Notch');
  console.log('Notch (premium):    ', notch);
  console.log('Expected:           ', '069a79f4-44e9-4726-a5be-fca90e38aaf5');
  console.log('Match premium?      ', notch === '069a79f4-44e9-4726-a5be-fca90e38aaf5' ? '✅' : '❌');
  console.log('');

  // A likely-cracked/random username -> offline UUID
  const cracked = await resolveUuid('CrackedPlayer_Xx');
  console.log('CrackedPlayer_Xx:   ', cracked);
  console.log('Offline UUID (deterministic):', getOfflineUuid('CrackedPlayer_Xx'));
  console.log('Match offline?      ', cracked === getOfflineUuid('CrackedPlayer_Xx') ? '✅' : '❌');
  console.log('');
  console.log('Offline UUIDs allow lowercase letters — valid for cracked servers.');
  console.log('Note: Offline UUIDs use version 3 (MD5-based), which is correct for cracked servers.');
})();
