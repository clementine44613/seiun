# 🐱 Meow Server — Auto-Whitelist Discord Bot

A Discord bot that **automatically adds players to your Minecraft server's whitelist** via **SFTP**, with a simple verification flow.

Works with **Shockbyte's Discord-collab panel** (and most Pterodactyl panels) without needing RCON.

## Features

- `/whitelist <username>` — start the verification process
- `/verify` — re-show your verification code
- `/verify-keepalive` — refresh your heartbeat to stay online
- `/whitelist-status` — check if you're whitelisted
- `/whitelist-remove <username>` — (Admin) remove a player
- `/whitelist-list` — (Admin) list all whitelisted players
- **Hybrid UUID resolution**: premium players get their real Mojang UUID, cracked players get a deterministic offline UUID (works on `online-mode=false` servers!)
- **1 Discord user = 1 Minecraft username binding**: each Discord account can only whitelist one Minecraft name
- **2-step verification code**: users must enter the generated code in Discord (modal) — no more nickname/skin tricks
- **Moderator approval**: optional human review step before a player is actually added to the whitelist (recommended for cracked servers)
- **RCON Heartbeat**: bot periodically checks who is online and kicks players whose Discord owner stopped verifying
- **Fabric Mod (seiun-auth)**: server-side enforcement that reads `bindings.json` and kicks unbound players on join
- Optional: grants a "Verified" role after successful whitelist
- Optional: logs whitelist actions to a channel

## How the verification works

1. A player runs `/whitelist <minecraft_username>`.
2. The bot generates a random 6-character code and shows it to the player.
3. The player clicks **"Enter verification code"** in Discord.
4. A **modal** pops up asking for the 6-character code.
5. If the code is correct, the bot proceeds.
6. **If moderator approval is enabled** (`APPROVAL_CHANNEL_ID` set), the request is posted to the approval channel with **✅ Approve / ❌ Deny** buttons. A moderator must approve it before the player is added.
7. Once approved (or immediately if approval is disabled), the bot:
   a) Resolves the player's UUID — **premium** players get the real Mojang UUID, **cracked** players get a deterministic offline UUID
   b) Downloads `whitelist.json` via **SFTP**
   c) Adds the player's `{ uuid, name }`
   d) Uploads `whitelist.json` back
   e) Saves the Discord-to-Minecraft binding in `bindings.json`
   f) Pushes `bindings.json` to the MC server
   g) Confirms in Discord (the server auto-reloads the whitelist)

> 💡 **Moderator approval** is highly recommended for cracked servers, since anyone could otherwise whitelist any name with just a Discord account.

---

## Prerequisites

- **Node.js 18+** (fetch API required)
- **Java 21** (to build the Fabric mod)
- A **Minecraft Fabric server** (1.21.1) with SFTP access (Shockbyte provides this)
- A **Discord bot** application

---

## 1. Create a Discord bot

1. Go to https://discord.com/developers/applications
2. Click **New Application** → name it (e.g., "Seiun")
3. Go to **Bot** → click **Add Bot**
4. Copy the **Bot Token** (keep it secret!)
5. Enable these **Privileged Gateway Intents**:
   - `MESSAGE CONTENT INTENT`
   - `SERVER MEMBERS INTENT` (optional, for role assignment)
6. In **OAuth2 → URL Generator**:
   - Scope: `bot`, `applications.commands`
   - Bot permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`, `Manage Roles`
   - Copy the generated invite URL and add the bot to your server

---

## 2. Get your SFTP details from Shockbyte

In your Shockbyte **Discord panel** (`discord.shockbyte.com`):

1. Log in and select your server.
2. Look for **"SFTP Settings"** or **"Access Control"** (the location varies by plan).
3. You should see:
   - **Host:** e.g., `sftp.discord.sgp2.shockbyte.host`
   - **Port:** `2222`
   - **Username:** e.g., `default@c832bec3-...`
   - **Password:** If not set, click **"Update Password"** / **"Set Password"** to create one.

> 💡 The SFTP password is separate from your panel login — make sure to set it if it shows "No password set."

---

## 3. Enable RCON (optional but recommended)

To use the heartbeat feature, enable RCON on your Minecraft server:

1. In your server's `server.properties`, set:
   ```
   enable-rcon=true
   rcon.password=your_rcon_password_here
   rcon.port=25575
   ```
2. Restart the server.

---

## 4. Set up the bot

```bash
# 1. Install dependencies
npm install

# 2. Create your config file
cp .env.example .env
```

Edit `.env` and fill in your details:

```env
DISCORD_TOKEN=your_bot_token
GUILD_ID=your_discord_server_id
SFTP_HOST=sftp.discord.sgp2.shockbyte.host
SFTP_PORT=2222
SFTP_USERNAME=your_sftp_username
SFTP_PASSWORD=your_sftp_password
WHITELIST_PATH=YourServerName/whitelist.json

# --- Moderator approval (recommended for cracked servers) ---
APPROVAL_CHANNEL_ID=
MODERATOR_ROLE_ID=

# --- RCON Heartbeat (optional but recommended) ---
RCON_HOST=
RCON_PORT=25575
RCON_PASSWORD=
HEARTBEAT_INTERVAL_SECONDS=30
HEARTBEAT_TIMEOUT_SECONDS=120
```

### Getting Discord IDs
- **GUILD_ID** (server ID): Enable Developer Mode in Discord (Settings → Advanced), then right-click your server → **Copy Server ID**
- **LOG_CHANNEL_ID**: right-click a channel → **Copy Channel ID**
- **VERIFIED_ROLE_ID**: right-click a role → **Copy Role ID**
- **APPROVAL_CHANNEL_ID**: right-click the channel where approval requests should appear → **Copy Channel ID**
- **MODERATOR_ROLE_ID**: right-click the moderator role → **Copy Role ID**

### 🛡️ Enabling moderator approval

For a **cracked server**, keeping `APPROVAL_CHANNEL_ID` **blank** means anyone with a Discord account can whitelist any Minecraft name. To prevent that:

1. Create a private channel (e.g., `#whitelist-approvals`) that only mods can see.
2. Set its ID as `APPROVAL_CHANNEL_ID`.
3. Optionally set `MODERATOR_ROLE_ID` to restrict who can click Approve/Deny (Admins always can).

When a player verifies, a request with **✅ Approve / ❌ Deny** buttons is posted there. The player is only whitelisted after you click **Approve**.

### ⚠️ The `WHITELIST_PATH` / agent prefix

Shockbyte's Discord-collab SFTP gateway uses a **non-standard path scheme**: the first path segment is the **server name** (the "agent"), not `whitelist.json` at the root. If you see `agent with path 'X' was not found`, the path is wrong.

Set `WHITELIST_PATH` to `YourServerName/whitelist.json`. For example, for a server named **"1. Meow's Island"**:

```env
WHITELIST_PATH=1. Meow's Island/whitelist.json
```

> 💡 To find your server name: connect via SFTP, list the root (`/` ), and look for the folder shown there — that's your agent/prefix. The bot prepends `/` automatically, so don't include a leading slash.

---

## 5. Build the Fabric mod (optional but recommended)

```bash
cd mc-mod
gradlew.bat build
```

The built JAR will be at `mc-mod/build/libs/seiun-auth-1.0.0.jar`.

Install it by dropping the JAR into your MC server's `mods` folder.

---

## 6. Run the bot

```bash
npm start
```

The bot will register its slash commands on startup and log in.

---

## Commands summary

| Command | Permissions | Description |
|---------|-------------|-------------|
| `/whitelist <username>` | Everyone | Start whitelist verification |
| `/verify` | Everyone | Re-show your verification code |
| `/verify-keepalive` | Everyone | Refresh heartbeat to stay online |
| `/whitelist-status` | Everyone | Check whitelist status |
| `/whitelist-remove <username>` | Admin | Remove a player |
| `/whitelist-list` | Admin | Show all whitelisted players |

---

## Troubleshooting

- **"SFTP authentication failed"** → Check `SFTP_USERNAME` and `SFTP_PASSWORD` in `.env`. If the panel says "No password set," click **Update Password** to create one.
- **"The whitelist.json file was not found"** → Make sure whitelist mode is enabled on the server, and the file exists in the server root (visible in the Files section).
- **Slash commands not appearing** → Re-invite the bot with the `applications.commands` scope, or wait a few minutes.
- **Cracked server (`online-mode=false`)** → The bot uses a **hybrid UUID** approach: it checks the Mojang API first, and if the name isn't a premium account it falls back to a deterministic offline UUID. This lets both premium and cracked players join the same whitelist.
- **Detached/closed VSCode** → Keep the bot running via `npm start` in a terminal, or host it 24/7 on a free service like Render, Railway, or a VPS.
</content>
