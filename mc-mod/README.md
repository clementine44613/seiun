# Seiun Auth

Fabric mod for Minecraft 1.21.1 that enforces Discord-to-Minecraft username bindings.

## What it does

When a player joins the server, the mod checks `bindings.json` in the server root directory. If the player's username is not in the bindings file, they are kicked with: "You are not bound to this Minecraft username."

## Prerequisites

- Java 21
- Fabric Loader 0.16.5+
- Fabric API

## Building

1. Install Java 21 JDK
2. Open a terminal in this folder
3. Run:
   ```
   gradlew.bat build
   ```
4. The JAR will be in `build/libs/seiun-auth-1.0.0.jar`

## Installing

1. Place the built JAR in your server's `mods` folder
2. Ensure `bindings.json` exists in the server root directory
3. Restart the server

## Updating bindings

The Discord bot automatically pushes `bindings.json` to the server root after each whitelist/bind change. No manual file transfer needed.

## Configuration

No config needed. The mod reads `bindings.json` from the server root.
