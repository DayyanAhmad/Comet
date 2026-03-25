const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const https = require('https');
const fs = require('fs');

// ── Logger ────────────────────────────────────────────────────
let logPath;
let logStream;

function initLogger() {
  const logDir = app.getPath('logs');
  fs.mkdirSync(logDir, { recursive: true });
  logPath = path.join(logDir, 'comet.log');
  logStream = fs.createWriteStream(logPath, { flags: 'a' });
  logStream.write(`\n--- Session started ${new Date().toISOString()} ---\n`);
}

function log(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
  if (logStream) logStream.write(line + '\n');
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send('app-log', { level, msg });
  }
}

// ── Scripts path (differs between dev and packaged) ──────────
const SCRIPTS_DIR = app.isPackaged
  ? path.join(path.dirname(process.execPath), 'scripts')
  : path.join(__dirname, 'scripts');

// ── Window setup ──────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width:     440,
    height:    620,
    minWidth:  440,
    minHeight: 620,
    maxWidth:  440,
    maxHeight: 620,
    resizable: false,
    frame: false,
    backgroundColor: '#060d1c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    }
  });
  win.loadFile('renderer/index.html');
}

app.whenReady().then(() => {
  initLogger();
  createWindow();
  log('INFO', `App started. Log file: ${logPath}`);
});
app.on('window-all-closed', () => app.quit());

// ── IPC: renderer log relay ───────────────────────────────────
ipcMain.on('write-log', (_e, { level, msg }) => {
  log(level, msg);
});

ipcMain.on('open-log-file', () => {
  if (logPath) shell.openPath(logPath);
});

// ── IPC: get installed version ────────────────────────────────
ipcMain.handle('get-installed-version', async () => {
  return new Promise((resolve) => {
    exec('dpkg -l discord 2>/dev/null | grep \'^ii\' | awk \'{print $3}\'', (err, stdout, stderr) => {
      if (err) log('WARN', `get-installed-version exec error: ${err.message}`);
      if (stderr) log('WARN', `get-installed-version stderr: ${stderr.trim()}`);
      const version = stdout.trim();
      log('INFO', `Installed version: ${version || 'not-installed'}`);
      resolve(version || 'not-installed');
    });
  });
});

// ── IPC: get latest version from Discord ─────────────────────
ipcMain.handle('get-latest-version', async () => {
  return new Promise((resolve, reject) => {
    log('INFO', 'Fetching latest version from discord.com...');
    const req = https.request(
      { host: 'discord.com', path: '/api/download?platform=linux&format=deb', method: 'HEAD' },
      (res) => {
        const location = res.headers['location'] || '';
        log('INFO', `Discord download redirect: ${location}`);
        const match = location.match(/discord-(\d+\.\d+\.\d+)\.deb/);
        if (match) {
          log('INFO', `Latest version: ${match[1]}`);
          resolve(match[1]);
        } else {
          const err = new Error('Could not parse version from redirect URL');
          log('ERROR', err.message);
          reject(err);
        }
      }
    );
    req.on('error', (err) => {
      log('ERROR', `Network error fetching latest version: ${err.message}`);
      reject(err);
    });
    req.end();
  });
});

// ── IPC: run update ───────────────────────────────────────────
ipcMain.on('start-update', (event) => {
  const send = (type, payload) => event.sender.send('update-progress', { type, ...payload });

  const DEST_DIR = '/tmp/comet';
  const INSTALL_SCRIPT = path.join(SCRIPTS_DIR, 'install-discord.sh');

  log('INFO', 'Update started');

  // Step 1 — check installed version
  send('step', { step: 1, status: 'active' });
  exec('dpkg -l discord 2>/dev/null | grep \'^ii\' | awk \'{print $3}\'', (err, stdout) => {
    const ver = stdout.trim();
    log('INFO', `Step 1 done. Current version: ${ver || 'none'}`);
    send('step', { step: 1, status: 'done', version: ver });

    // Step 2 — download
    send('step', { step: 2, status: 'active' });
    log('INFO', `Starting download to ${DEST_DIR}`);
    const dl = spawn('bash', [path.join(SCRIPTS_DIR, 'download-discord.sh'), DEST_DIR]);

    let debPath = '';
    dl.stdout.on('data', (data) => {
      const line = data.toString().trim();
      if (line) log('INFO', `download: ${line}`);
      if (line.endsWith('.deb')) debPath = line;
      send('progress', { value: null, label: line });
    });
    dl.stderr.on('data', (data) => {
      log('WARN', `download stderr: ${data.toString().trim()}`);
    });

    dl.on('close', (code) => {
      log('INFO', `Download process exited with code ${code}. deb: ${debPath}`);
      if (code !== 0) { send('error', { message: 'Download failed' }); return; }
      send('step', { step: 2, status: 'done' });

      // Step 3 — install via pkexec
      send('step', { step: 3, status: 'active' });
      log('INFO', `Running pkexec ${INSTALL_SCRIPT} ${debPath}`);
      const install = spawn('pkexec', [INSTALL_SCRIPT, debPath]);

      install.stdout.on('data', (d) => log('INFO', `install: ${d.toString().trim()}`));
      install.stderr.on('data', (d) => {
        const text = d.toString().trim();
        log('WARN', `install stderr: ${text}`);
        send('log', { text });
      });
      install.on('close', (code) => {
        log('INFO', `Install process exited with code ${code}`);
        if (code === 126) { send('error', { message: 'Installation cancelled by user.' }); return; }
        if (code !== 0)   { send('error', { message: `Installation failed (dpkg returned ${code})` }); return; }
        send('step', { step: 3, status: 'done' });

        // Step 4 — launch Discord
        send('step', { step: 4, status: 'active' });
        log('INFO', 'Launching Discord...');
        spawn('bash', [path.join(SCRIPTS_DIR, 'launch-discord.sh')], { detached: true });
        setTimeout(() => {
          send('step', { step: 4, status: 'done' });
          send('complete', {});
          log('INFO', 'Update complete.');
        }, 1500);
      });
    });
  });
});
