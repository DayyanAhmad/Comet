# Discord Updater

A lightweight desktop app for Ubuntu that keeps Discord up to date — check for the latest version, download it, and install it with a single click.

Built with Electron. Styled after Apple HIG.

---

## Install (pre-built)

Download the latest `.deb` from the [Releases](https://github.com/DayyanAhmad/Comet/releases) page and install it:

```bash
sudo dpkg -i discord-updater_*.deb
```

Then launch it from your app menu or run:

```bash
discord-updater
```

---

## Build from source

**Prerequisites:** Node.js 18+, npm, `curl`, `dpkg`

```bash
git clone https://github.com/DayyanAhmad/Comet.git
cd Comet
npm install
npm run build
```

The output `.deb` will be in `dist/`. Install it with `sudo dpkg -i dist/discord-updater_*.deb`.

---

## Run in development

```bash
npm install
npm start
```

> On some Linux setups you may need to fix Electron's sandbox permissions first:
> ```bash
> sudo chown root node_modules/electron/dist/chrome-sandbox
> sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
> ```
> Or the `--no-sandbox` flag is already set in the `start` script as a fallback.

---

## How it works

1. **Check** — reads your installed Discord version via `dpkg`
2. **Download** — fetches the latest `.deb` from `discord.com/api/download`
3. **Install** — runs `dpkg -i` via `pkexec` (prompts for your password)
4. **Launch** — starts Discord detached after install

A Polkit policy (`com.discordupdater.install.policy`) is installed alongside the app so privilege escalation is scoped only to the install script — not a shell.

---

## Bash script alternative

If you prefer no GUI, `update_discord.sh` installs a manually downloaded `.deb`:

```bash
./update_discord.sh ~/Downloads/discord-0.0.XX.deb
```

---

## Requirements

- Ubuntu 20.04+ (or any Debian-based distro with `dpkg` and `pkexec`)
- `curl`
- `policykit-1`
