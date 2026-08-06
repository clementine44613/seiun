@echo off
REM Start the Meow Server whitelist bot under PM2.
REM This runs the bot in the background (independent of VSCode).
cd /d D:\Codes\Meow Server
C:\Users\clementine\AppData\Roaming\npm\pm2.cmd resurrect
C:\Users\clementine\AppData\Roaming\npm\pm2.cmd start meow-bot
</content>
