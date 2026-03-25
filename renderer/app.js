// ── DOM refs ──────────────────────────────────────────────────
const installedVersionEl = document.getElementById('installed-version');
const latestVersionEl    = document.getElementById('latest-version');
const badgeEl            = document.getElementById('update-badge');
const checkBtn           = document.getElementById('check-btn');
const updateBtn          = document.getElementById('update-btn');
const progressSection    = document.getElementById('progress-section');
const progressLabel      = document.getElementById('progress-label');
const errorBanner        = document.getElementById('error-banner');
const errorMessage       = document.getElementById('error-message');
const stepEls            = [1, 2, 3, 4].map(i => document.getElementById(`step-${i}`));
const logOutput          = document.getElementById('log-output');
const openLogBtn         = document.getElementById('open-log-btn');
const closeBtn           = document.getElementById('close-btn');
const tabUpdateBtn       = document.getElementById('tab-update-btn');
const tabLogsBtn         = document.getElementById('tab-logs-btn');
const tabUpdate          = document.getElementById('tab-update');
const tabLogs            = document.getElementById('tab-logs');

let installedVersion = null;
let latestVersion    = null;

// ── Window controls ───────────────────────────────────────────
closeBtn.addEventListener('click', () => window.close());

// ── Tab switching ─────────────────────────────────────────────
tabUpdateBtn.addEventListener('click', () => switchTab('update'));
tabLogsBtn.addEventListener('click',   () => switchTab('logs'));

function switchTab(tab) {
  const isUpdate = tab === 'update';
  tabUpdateBtn.classList.toggle('active', isUpdate);
  tabLogsBtn.classList.toggle('active', !isUpdate);
  tabUpdateBtn.setAttribute('aria-selected', isUpdate);
  tabLogsBtn.setAttribute('aria-selected', !isUpdate);
  tabUpdate.hidden = !isUpdate;
  tabLogs.hidden   = isUpdate;
}

// ── Logging ───────────────────────────────────────────────────
function appendLog(level, msg) {
  const el = document.createElement('div');
  el.className = `log-entry ${level.toLowerCase()}`;
  const time = new Date().toLocaleTimeString();
  el.textContent = `[${time}] [${level}] ${msg}`;
  logOutput.appendChild(el);
  logOutput.scrollTop = logOutput.scrollHeight;
}

window.discord.onLog((data) => appendLog(data.level, data.msg));
openLogBtn.addEventListener('click', () => window.discord.openLogFile());

// Capture renderer errors
window.addEventListener('error', (e) => {
  const msg = `Renderer error: ${e.message} (${e.filename}:${e.lineno})`;
  window.discord.writeLog('ERROR', msg);
  appendLog('ERROR', msg);
});

window.addEventListener('unhandledrejection', (e) => {
  const msg = `Unhandled rejection: ${e.reason}`;
  window.discord.writeLog('ERROR', msg);
  appendLog('ERROR', msg);
});

// ── Init ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await refreshInstalledVersion();
});

async function refreshInstalledVersion() {
  try {
    const v = await window.discord.getInstalledVersion();
    installedVersion = v;
    installedVersionEl.textContent = v === 'not-installed' ? 'Not installed' : v;
  } catch (err) {
    window.discord.writeLog('ERROR', `refreshInstalledVersion: ${err.message}`);
    installedVersionEl.textContent = 'Error';
  }
}

// ── Check for updates ─────────────────────────────────────────
checkBtn.addEventListener('click', async () => {
  setState('checking');
  try {
    latestVersion = await window.discord.getLatestVersion();
    latestVersionEl.textContent = latestVersion;

    if (installedVersion === 'not-installed' || versionIsNewer(latestVersion, installedVersion)) {
      setState('update-found');
    } else {
      setState('up-to-date');
    }
  } catch (err) {
    latestVersionEl.textContent = 'Could not check';
    window.discord.writeLog('ERROR', `getLatestVersion: ${err.message}`);
    setState('idle');
  }
});

// ── Start update ──────────────────────────────────────────────
updateBtn.addEventListener('click', () => {
  setState('updating');
  window.discord.removeProgressListener();
  window.discord.onProgress(handleProgress);
  window.discord.startUpdate();
});

// ── Progress handler ──────────────────────────────────────────
function handleProgress(data) {
  switch (data.type) {
    case 'step':
      updateStep(data.step, data.status);
      break;
    case 'progress':
      if (data.label) progressLabel.textContent = data.label;
      break;
    case 'complete':
      setState('complete');
      refreshInstalledVersion();
      break;
    case 'error':
      showError(data.message);
      break;
  }
}

function updateStep(step, status) {
  const el = stepEls[step - 1];
  if (!el) return;
  el.className = `step ${status}`;
}

// ── State machine ─────────────────────────────────────────────
function setState(state) {
  errorBanner.hidden        = true;
  progressSection.hidden    = true;
  checkBtn.disabled         = false;
  checkBtn.textContent      = 'Check for updates';
  updateBtn.disabled        = true;
  stepEls.forEach(el => { el.className = 'step idle'; });

  switch (state) {
    case 'idle':
      break;

    case 'checking':
      checkBtn.disabled    = true;
      checkBtn.textContent = 'Checking…';
      break;

    case 'update-found':
      setBadge('Update available', 'update-available');
      updateBtn.disabled = false;
      break;

    case 'up-to-date':
      setBadge('Up to date', 'up-to-date');
      break;

    case 'updating':
      checkBtn.disabled         = true;
      updateBtn.disabled        = true;
      progressSection.hidden    = false;
      progressLabel.textContent = 'Starting…';
      break;

    case 'complete':
      setBadge('Up to date', 'up-to-date');
      progressSection.hidden    = false;
      progressLabel.textContent = 'Discord updated successfully!';
      break;
  }
}

function showError(message) {
  errorBanner.hidden       = false;
  errorMessage.textContent = message;
  checkBtn.disabled        = false;
  updateBtn.disabled       = false;
  progressSection.hidden   = true;
}

function setBadge(text, cls) {
  badgeEl.textContent = text;
  badgeEl.className   = `badge ${cls}`;
}

// ── Semver comparison ─────────────────────────────────────────
function versionIsNewer(newVer, curVer) {
  const parse = v => v.split('.').map(Number);
  const n = parse(newVer);
  const c = parse(curVer);
  for (let i = 0; i < Math.max(n.length, c.length); i++) {
    const ni = n[i] || 0, ci = c[i] || 0;
    if (ni > ci) return true;
    if (ni < ci) return false;
  }
  return false;
}
