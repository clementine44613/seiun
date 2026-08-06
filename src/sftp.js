// SFTP connection wrapper around ssh2-sftp-client.
// Uses an absolute path for the whitelist file, which Shockbyte's gateway
// resolves correctly (realPath("/whitelist.json") => "/whitelist.json").
const SftpClient = require('ssh2-sftp-client');

class SftpConnection {
  constructor({ host, port, username, password, whitelistPath }) {
    this.config = { host, port, username, password };
    // Normalize to an absolute path for the gateway.
    this.whitelistPath = whitelistPath && whitelistPath.startsWith('/')
      ? whitelistPath
      : `/${whitelistPath || 'whitelist.json'}`;
    this.client = null;
  }

  async connect() {
    if (this.client) return;
    this.client = new SftpClient();
    try {
      await this.client.connect(this.config);
    } catch (err) {
      this.client = null;
      throw err;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.end().catch(() => {});
      this.client = null;
    }
  }

  // Shockbyte's gateway tends to fail when reusing a handle for multiple
  // operations, so each operation uses a FRESH connection. This is more
  // reliable than keeping one long-lived handle.
  async readWhitelist() {
    await this.connect();
    try {
      const data = await this.client.get(this.whitelistPath);
      return data.toString('utf8');
    } finally {
      await this.disconnect();
    }
  }

  async writeWhitelist(content) {
    await this.connect();
    try {
      await this.client.put(Buffer.from(content, 'utf8'), this.whitelistPath);
    } finally {
      await this.disconnect();
    }
  }

  async writeFile(path, content) {
    await this.connect();
    try {
      await this.client.put(Buffer.from(content, 'utf8'), path);
    } finally {
      await this.disconnect();
    }
  }

  // Test whether the SFTP gateway can see the whitelist file.
  async whitelistExists() {
    await this.connect();
    try {
      try {
        await this.client.stat(this.whitelistPath);
        return true;
      } catch {
        return false;
      }
    } finally {
      await this.disconnect();
    }
  }
}

module.exports = { SftpConnection };
