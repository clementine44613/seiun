# 🐱 Meow Server — Conversation Log
> Full context of our collaboration so future sessions can pick up instantly.
> Last updated: current session

---

## 🎯 Project overview
A **Discord bot** that automatically whitelists players on your **Shockbyte Minecraft server** by editing `whitelist.json` over **SFTP**, with a **moderator approval** step to prevent random people from whitelisting themselves.

---

## 📌 Current state (summary)
- **Bot is RUNNING** under PM2 as `meow-bot` (status: online), independent of VSCode.
- Bot logs in as **`Seiun#5231`**.
- **SFTP connection to Shockbyte server: CONFIRMED WORKING** (tested — reads `whitelist.json`).
- Current whitelist: `Meow450` is whitelisted; `Notch` is not.
- Auto-start is configured via `start-bot.bat` in the Windows Startup folder.

---

## 🧠 Everything we discussed (full history)

### 1. Original request
- You lost the previous conversation because VSCode was closed.
- Re-established: you wanted an **automatic whitelist system** connecting **Discord + your Minecraft server** via a **Node.js bot**.

### 2. Architecture decision
- You chose **server console/RCON** as the connection method initially.
- I built an RCON-based bot:
  - `index.js` (main bot)
  - `src/config.js`
  - `src/rcon.js` (RCON wrapper)
  - `src/whitelist.js` (RCON whitelist ops)
  - Installed `discord.js`, `dotenv`, `minecraft-rcon`.

### 3. Running under PM2
- Started the bot under PM2 (`pm2 start index.js --name meow-bot`).
- `pm2 save` to persist the process list.
- `pm2 startup` failed on Windows (not supported) → used **Startup folder** approach instead:
  - Created `start-bot.bat` → copied to `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`.
  - This runs `pm2 resurrect` on login so the bot auto-starts.

### 4. Project EVOLVED (important!)
- The project **switched from RCON to SFTP** to edit the whitelist directly on Shockbyte.
- New/updated files:
  - `src/sftp.js` — SFTP wrapper (`ssh2-sftp-client`).
  - `src/whitelist.js` — SFTP + **hybrid UUID** logic (premium players get Mojang UUID via API, cracked players get offline UUID).
  - `src/config.js` — now uses `SFTP_HOST`, `SFTP_PORT`, `SFTP_USERNAME`, `SFTP_PASSWORD`, `WHITELIST_PATH` (default `"1. Meow's Island/whitelist.json"`).
  - `index.js` — added **moderator approval flow** with ✅ Approve / ❌ Deny buttons, approval channel (`#seiun-wife`), expiry timers, DM notifications.
  - `package.json` — now uses `ssh2-sftp-client` (no more `minecraft-rcon`).
- Created `RECOVERY.md` to document everything.

### 5. Known issue & fix (deployed)
- **Problem:** Approval requests failed with "Missing Access" — bot lacked **Embed Links** permission in `#seiun-wife`.
- **Fix:** `index.js` now **falls back to a plain-text approval message** with the Approve/Deny buttons if the embed can't be sent.
- **Optional:** Grant bot `Embed Links` permission in `#seiun-wife` for nicer embed cards.

### 6. Ping/Pong of testing & control
- **Testing:** Ran `node test-whitelist-read.js` → confirmed SFTP works, reads whitelist correctly.
- **Stopping:** You asked how to stop the bot. Answer: `pm2 stop meow-bot`, restart with `pm2 restart meow-bot`, remove with `pm2 delete meow-bot`.
- **Not limited to VSCode:** You asked if you could only run/stop in VSCode terminal. **No** — PM2 is global, works from any terminal (PowerShell, cmd, Windows Terminal). Or double-click `start-bot.bat`.

### 7. Oracle Cloud hosting (info only — NOT done)
You asked (just for info, don't do it):
- **Is it a hassle?** Moderately. Code needs ~no changes; all work is environment setup (~1–2 hrs first time).
- **Plusses:** 24/7 uptime without your PC, free forever (Always Free tier), no home power/internet reliance.
- **Minuses:**
  - Oracle IP reputation sometimes flagged by Discord.
  - **Biggest risk:** Shockbyte SFTP path may behave differently from a different machine → would need re-testing (`test-whitelist-read.js` first).
  - Depends on VM uptime; SSH-only maintenance; no local GUI; Always Free limits (2 VMs); account cleanup needed.
- **Recommendation:** Keep it local for now; it works. Only move to Oracle if you want 24/7 independence and are OK with SSH/Linux + re-testing SFTP.

---

## 🗂️ Project structure
| File | Purpose | Status |
|------|---------|--------|
| `index.js` | Main bot — all commands & approval flow | ✅ active |
| `src/config.js` | Loads settings from `.env` | ✅ active |
| `src/whitelist.js` | SFTP + hybrid UUID logic | ✅ active |
| `src/sftp.js` | SFTP connection helper | ✅ active |
| `.env` | Secrets & config (NOT committed) | ✅ set |
| `.env.example` | Template | ✅ |
| `package.json` | Dependencies & start script | ✅ |
| `README.md` | Full docs | ✅ |
| `RECOVERY.md` | Recovery notes | ✅ |
| `CONVERSATION_LOG.md` | **This file** | ✅ |
| `start-bot.bat` | Auto-start script | ✅ |
| `diag-*.js` / `test-*.js` | Diagnostics/test scripts | dev tools |

---

## 🔧 Key config values (in `.env`)
| Variable | Status | Notes |
|----------|--------|-------|
| `DISCORD_TOKEN` | ✅ set | Bot token |
| `GUILD_ID` | ✅ set | Discord server ID |
| `SFTP_HOST/PORT/USERNAME/PASSWORD` | ✅ set | Shockbyte access |
| `APPROVAL_CHANNEL_ID` | ✅ set | `#seiun-wife` |
| `MODERATOR_ROLE_ID` | ⬜ blank | Admin can approve; set a role to let others |
| `VERIFIED_ROLE_ID` | ⬜ blank | Optional role after approval |
| `LOG_CHANNEL_ID` | ⬜ blank | Optional log channel |

---

## 🛠️ Useful commands
```bash
pm2 list                 # bot status
pm2 logs meow-bot        # view logs
pm2 stop meow-bot        # stop bot
pm2 restart meow-bot     # restart bot
pm2 delete meow-bot      # remove from PM2
cd D:\Codes\Meow Server && node test-whitelist-read.js   # safe read test
cd D:\Codes\Meow Server && node test-whitelist-write.js  # safe add/remove test
```

---

## ✅ Todos / next steps
- [ ] (Optional) Set `MODERATOR_ROLE_ID` if non-admin mods should approve
- [ ] (Optional) Grant bot `Embed Links` permission in `#seiun-wife` for nicer cards
- [ ] (Optional) Set `VERIFIED_ROLE_ID` and `LOG_CHANNEL_ID`
- [ ] Test a full whitelist flow end-to-end in Discord
- [ ] (Future idea) Consider Oracle Cloud hosting if 24/7 uptime needed — re-test SFTP first
