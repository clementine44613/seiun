require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

// Optional values return undefined if not set
function optional(name) {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : undefined;
}

module.exports = {
  discord: {
    token: required('DISCORD_TOKEN'),
    guildId: required('GUILD_ID'),
    logChannelId: optional('LOG_CHANNEL_ID'),
    verifiedRoleId: optional('VERIFIED_ROLE_ID'),
    moderatorRoleId: optional('MODERATOR_ROLE_ID'),
    approvalChannelId: optional('APPROVAL_CHANNEL_ID'),
  },
  sftp: {
    host: required('SFTP_HOST'),
    port: parseInt(process.env.SFTP_PORT || '2222', 10),
    username: required('SFTP_USERNAME'),
    password: required('SFTP_PASSWORD'),
    whitelistPath: process.env.WHITELIST_PATH || "1. Meow's Island/whitelist.json",
    bindingsPath: process.env.BINDINGS_PATH || "1. Meow's Island/bindings.json",
  },
  rcon: {
    host: optional('RCON_HOST') || optional('SFTP_HOST'),
    port: parseInt(process.env.RCON_PORT || '25575', 10),
    password: optional('RCON_PASSWORD'),
  },
  verifyTimeoutSeconds: parseInt(process.env.VERIFY_TIMEOUT_SECONDS || '600', 10),
  approvalTimeoutSeconds: parseInt(process.env.APPROVAL_TIMEOUT_SECONDS || '900', 10),
  heartbeatIntervalSeconds: parseInt(process.env.HEARTBEAT_INTERVAL_SECONDS || '30', 10),
  heartbeatTimeoutSeconds: parseInt(process.env.HEARTBEAT_TIMEOUT_SECONDS || '120', 10),
};
