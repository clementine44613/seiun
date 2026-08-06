# 🐱 Meow Server — Project Recovery Notes

> **Read this first if you're resuming work after closing VSCode.**
> This file documents everything about the project so you can pick up instantly.

> 📝 **Full conversation history:** See `CONVERSATION_LOG.md` for everything we've discussed, including project evolution, decisions, and future ideas.

---

## What this project is
A **Node.js Discord bot** that automatically whitelists players on your **Shockbyte Minecraft server** by editing the server's `whitelist.json` over **SFTP**, with a **moderator approval** step to prevent random people from whitelisting themselves.

---

## How to run it (quick restart)

```bash
# In the project folder (d:/Codes/Meow Server)
npm install        # only needed once / after dependency changes
npm start          # starts the bot
```

The bot logs in as **`Seiun#5231`** and registers slash commands on startup.

---

## Project structure
| File | Purpose |
|------|---------|
| `index.js` | Main bot entry — all commands & the approval flow |
| `src/config.js` | Loads settings from `.env` |
| `src/whitelist.js` | SFTP + hybrid UUID logic (premium + cracked players) |
| `src/sftp.js` | SFTP connection helper |
| `.env` | **Your secrets & config** (NOT committed) |
| `.env.example` | Template showing all available settings |
| `package.json` | Dependencies & start script |
| `README.md` | Full setup/usage docs |
| `diag-*.js` / `test-*.js` | Diagnostics/test scripts (used during development) |

---

## Features implemented
- `/whitelist <username>` — player starts verification, gets a 6-char code
- Player sets code as their Minecraft name/skin, clicks **"I have set the code"**
- **Moderator approval**: request posts to the approval channel with ✅ Approve / ❌ Deny buttons
- Only **moderators/admins** can approve/deny
- On approve → player added to whitelist via SFTP, requester DMed
- Requests **expire after 15 minutes** if unhandled
- **Hybrid UUID** support: premium players get Mojang UUID, cracked players get offline UUID (so existing entries like `Meow450` and cracked friends all work)
- Sales/admin commands: `/whitelist-remove`, `/whitelist-list`

---

## Key config values (in `.env`)
| Variable | Status | Notes |
|----------|--------|-------|
| `DISCORD_TOKEN` | ✅ set | Bot token |
| `GUILD_ID` | ✅ set | Discord server ID |
| `SFTP_HOST/PORT/...` | ✅ set | Shockbyte server access |
| `APPROVAL_CHANNEL_ID` | ✅ set | Channel `#seiun-wife` where approvals post |
| `MODERATOR_ROLE_ID` | ⬜ **blank** | Admin can approve; set a role ID to let others |
| `VERIFIED_ROLE_ID` | ⬜ blank | Optional role granted after approval |
| `LOG_CHANNEL_ID` | ⬜ blank | Optional log channel |

---

## Known issue & fix (already deployed)
**Problem:** Approval requests failed with "Missing Access" because the bot lacked **Embed Links** permission in `#seiun-wife`.
**Fix:** `index.js` now **falls back to a plain-text approval message** with the Approve/Deny buttons if the embed can't be sent. So approvals work regardless.

**Optional improvement:** Grant the bot **Embed Links** permission in `#seiun-wife` (channel settings → Permissions → add `Seiun` → enable Embed Links) to show nicer embed cards.

---

## Common commands
| Command | Permission | Description |
|---------|------------|-------------|
| `/whitelist <username>` | Everyone | Start whitelist verification |
| `/verify` | Everyone | Re-show your verification code |
| `/whitelist-remove <username>` | Admin | Remove a player |
| `/whitelist-list` | Admin | List all whitelisted players |

---

## Troubleshooting
- **"Failed to create an approval request"** → check `APPROVAL_CHANNEL_ID` is set and the bot can see/send in that channel.
- **SFTP errors** → check `SFTP_HOST`, `SFTP_PORT`, `SFTP_USERNAME`, `SFTP_PASSWORD` in `.env`.
- **Only moderators can approve** appearing for you → make sure you're an **admin**, or set `MODERATOR_ROLE_ID`.

---

## Todos / next steps
- [ ] (Optional) Set `MODERATOR_ROLE_ID` if non-admin mods should approve
- [ ] (Optional) Grant bot `Embed Links` permission in `#seiun-wife` for nicer cards
- [ ] (Optional) Set `VERIFIED_ROLE_ID` and `LOG_CHANNEL_ID`
- [ ] Test a full whitelist flow end-to-end in Discord
