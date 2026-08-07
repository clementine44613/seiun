const fs = require('fs');
const path = require('path');

const BINDINGS_FILE = path.join(__dirname, '..', 'bindings.json');

function loadBindings() {
  try {
    const raw = fs.readFileSync(BINDINGS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveBindings(bindings) {
  fs.writeFileSync(BINDINGS_FILE, JSON.stringify(bindings, null, 2));
}

function getBoundUsername(discordId) {
  const bindings = loadBindings();
  const entry = bindings[discordId];
  return entry ? entry.username : null;
}

function setBinding(discordId, username, uuid) {
  const bindings = loadBindings();
  bindings[discordId] = { username, uuid, lastVerified: Date.now() };
  saveBindings(bindings);
}

function getBindingUuid(discordId) {
  const bindings = loadBindings();
  const entry = bindings[discordId];
  return entry ? entry.uuid : null;
}

function updateLastVerified(discordId) {
  const bindings = loadBindings();
  if (bindings[discordId]) {
    bindings[discordId].lastVerified = Date.now();
    saveBindings(bindings);
  }
}

function hasBinding(discordId) {
  const bindings = loadBindings();
  return discordId in bindings;
}

module.exports = {
  loadBindings,
  saveBindings,
  getBoundUsername,
  getBindingUuid,
  setBinding,
  updateLastVerified,
  hasBinding,
};
