# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repo has two components:

1. **`update_discord.sh`** — A standalone bash script (currently implemented) that installs or updates Discord from a manually downloaded `.deb` file. Run it as:
   ```bash
   ./update_discord.sh <path-to-discord.deb>
   ```

2. **`discord-updater-implementation-plan.md`** — A design document for a planned Electron desktop GUI app that automates the full update flow (version check → download → install via `pkexec` → launch).

## The Bash Script

`update_discord.sh` uses `set -euo pipefail` and performs these steps in order:

1. Validates the argument is a `.deb` file that looks like a Discord package (`dpkg-deb --field`)
2. Compares the new version against the installed version using `dpkg --compare-versions`
3. Kills running Discord processes via `pgrep`/`pkill`
4. Installs with `sudo dpkg -i`; on failure, runs `sudo apt-get install -f -y` to fix broken deps
5. Verifies the installed version post-install

## Planned Electron App Architecture

The implementation plan describes an app not yet built. Key architectural decisions documented there:

- **IPC security model:** `contextIsolation: true`, `nodeIntegration: false`; renderer communicates only through a narrow `preload.js` bridge exposing `window.discord.*`
- **Privilege escalation:** `pkexec` (not `sudo`) invokes `scripts/install-discord.sh`; a Polkit policy file restricts escalation to only that script
- **Version detection:** HEAD request to `discord.com/api/download?platform=linux&format=deb` and parsing the redirect URL filename
- **Progress streaming:** `ipcMain.on('start-update')` spawns child processes and streams `update-progress` events (`step`, `progress`, `complete`, `error`) back to the renderer
- **Build:** `electron-builder --linux deb` → `dist/discord-updater_1.0.0_amd64.deb`; `scripts/postinstall.sh` copies the Polkit policy on install

### Dev commands (once the Electron app is scaffolded)
```bash
npm start        # run in development
npm run build    # build distributable .deb → dist/
```
