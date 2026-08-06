// Whitelist operations via SFTP + Mojang API for UUID resolution.
const crypto = require('crypto');
const { SftpConnection } = require('./sftp');

// Mojang API: get UUID from username (returns null if not a premium account).
async function getMojangUuid(username) {
  const url = `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 204) return null; // not a premium account
    if (!res.ok) throw new Error(`Mojang API error ${res.status}`);
    const data = await res.json();
    return data.id || null;
  } finally {
    clearTimeout(timeout);
  }
}

// Java-compatible offline UUID for cracked players (UUID.nameUUIDFromBytes("OfflinePlayer:"+name)).
function getOfflineUuid(username) {
  const md5 = crypto.createHash('md5').update(`OfflinePlayer:${username}`, 'utf8').digest();
  // Set version bits to 3 and variant bits to 10xx (matches Java's algorithm).
  md5[6] = (md5[6] & 0x0f) | 0x30;
  md5[8] = (md5[8] & 0x3f) | 0x80;
  const h = md5.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Resolve a UUID for a username, preferring the real Mojang UUID for premium
// accounts and falling back to an offline UUID for cracked players.
async function resolveUuid(username) {
  try {
    const premium = await getMojangUuid(username);
    if (premium) {
      // Mojang returns a UUID without dashes; format it with dashes.
      return premium.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
    }
  } catch (err) {
    // If Mojang API is unreachable, fall through to offline UUID.
    console.error('Mojang lookup failed, using offline UUID:', err.message);
  }
  return getOfflineUuid(username);
}

function createWhitelistService(config) {
  const sftp = new SftpConnection(config.sftp);

  async function readWhitelistArray() {
    const raw = await sftp.readWhitelist();
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function saveWhitelistArray(list) {
    const content = JSON.stringify(list, null, 2);
    await sftp.writeWhitelist(content);
  }

  async function isPlayerWhitelisted(username) {
    const list = await readWhitelistArray();
    const lower = username.toLowerCase();
    return list.some((entry) => (entry.name || '').toLowerCase() === lower);
  }

  async function addPlayer(username) {
    // Resolve the UUID: premium players get their real Mojang UUID,
    // cracked players get a deterministic offline UUID.
    const uuid = await resolveUuid(username);

    const list = await readWhitelistArray();
    const lower = username.toLowerCase();

    if (list.some((entry) => (entry.name || '').toLowerCase() === lower)) {
      return { added: false, already: true, message: `**${username}** is already whitelisted.` };
    }

    // Minecraft UUIDs use dashes in whitelist.json
    list.push({ uuid, name: username });
    await saveWhitelistArray(list);

    return { added: true, already: false, message: `Added **${username}** to the whitelist!` };
  }

  async function removePlayer(username) {
    let list = await readWhitelistArray();
    const lower = username.toLowerCase();
    const before = list.length;
    list = list.filter((entry) => (entry.name || '').toLowerCase() !== lower);

    if (list.length === before) {
      return { removed: false, message: `**${username}** is not on the whitelist.` };
    }

    await saveWhitelistArray(list);
    return { removed: true, message: `Removed **${username}** from the whitelist.` };
  }

  async function listWhitelisted() {
    const list = await readWhitelistArray();
    const names = list.map((entry) => entry.name).filter(Boolean);
    return names.length
      ? `Whitelisted players (${names.length}): ${names.join(', ')}`
      : 'No players are whitelisted.';
  }

  return {
    sftp,
    addPlayer,
    removePlayer,
    isPlayerWhitelisted,
    listWhitelisted,
  };
}

module.exports = { createWhitelistService };
