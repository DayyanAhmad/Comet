// ── State ──────────────────────────────────────────────────────
const State = {
  IDLE:         'idle',
  CHECKING:     'checking',
  UP_TO_DATE:   'up-to-date',
  UPDATE_FOUND: 'update-found',
  UPDATING:     'updating',
  COMPLETE:     'complete',
  ERROR:        'error',
};

let currentState = State.IDLE;

// ── Helpers ────────────────────────────────────────────────────
function setBadge(type, text) {
  const badge = document.getElementById('status-badge');
  badge.className = `badge badge--${type}`;
  badge.textContent = text;
}

function setStep(n, status) {
  const step = document.getElementById(`step-${n}`);
  const dot  = document.getElementById(`dot-${n}`);
  if (!step || !dot) return;
  step.className = status !== 'idle' ? `step step--${status}` : 'step';
  dot.textContent = status === 'done' ? '✓' : n;
}

function setProgress(pct, label) {
  if (pct !== null) {
    document.getElementById('progress-fill').style.width = `${Math.min(pct, 100)}%`;
    document.getElementById('progress-pct').textContent  = `${Math.round(pct)}%`;
  }
  if (label) document.getElementById('progress-label').textContent = label;
}

function appendLog(text, type = 'dim') {
  const output = document.getElementById('logs-output');
  const line   = document.createElement('div');
  line.className   = `log-line log-line--${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function switchTab(tab) {
  const isUpdate = tab === 'update';
  document.getElementById('tab-update').classList.toggle('tab--active', isUpdate);
  document.getElementById('tab-logs').classList.toggle('tab--active', !isUpdate);
  document.getElementById('steps-panel').style.display   = isUpdate ? 'flex' : 'none';
  document.getElementById('logs-panel').classList.toggle('logs-panel--visible', !isUpdate);
  document.getElementById('progress-wrap').style.display = isUpdate ? '' : 'none';
}

// ── State machine ──────────────────────────────────────────────
function setState(newState, payload = {}) {
  currentState = newState;

  const btnCheck   = document.getElementById('btn-check');
  const btnUpdate  = document.getElementById('btn-update');
  const progressWrap = document.getElementById('progress-wrap');

  if (newState !== State.UPDATING && newState !== State.COMPLETE) {
    [1, 2, 3, 4].forEach(n => setStep(n, 'idle'));
  }

  // Reset button to primary style unless overridden below
  btnUpdate.className = 'btn btn--primary';

  switch (newState) {

    case State.IDLE:
      setBadge('neutral', 'Not checked');
      btnCheck.disabled   = false;
      btnUpdate.disabled  = true;
      btnUpdate.textContent = 'Update Discord';
      progressWrap.classList.remove('progress-wrap--visible');
      break;

    case State.CHECKING:
      setBadge('loading', 'Checking…');
      btnCheck.disabled  = true;
      btnUpdate.disabled = true;
      break;

    case State.UP_TO_DATE:
      setBadge('success', 'Up to date');
      btnCheck.disabled   = false;
      btnUpdate.disabled  = true;
      btnUpdate.textContent = 'Up to date';
      break;

    case State.UPDATE_FOUND:
      setBadge('warn', 'Update available');
      btnCheck.disabled  = false;
      btnUpdate.disabled = false;
      btnUpdate.textContent = payload.latestVersion
        ? `Update to ${payload.latestVersion}`
        : 'Update Discord';
      break;

    case State.UPDATING:
      setBadge('loading', 'Updating…');
      btnCheck.disabled  = true;
      btnUpdate.disabled = true;
      progressWrap.classList.add('progress-wrap--visible');
      document.getElementById('progress-label').textContent = 'Starting…';
      document.getElementById('progress-pct').textContent   = '';
      document.getElementById('progress-fill').style.width  = '0%';
      break;

    case State.COMPLETE:
      setBadge('success', 'Up to date');
      btnCheck.disabled   = false;
      btnUpdate.disabled  = true;
      btnUpdate.className = 'btn btn--success';
      btnUpdate.textContent = 'Discord launched ✓';
      progressWrap.classList.remove('progress-wrap--visible');
      if (payload.newVersion) {
        document.getElementById('installed-version').textContent = payload.newVersion;
      }
      break;

    case State.ERROR:
      setBadge('error', 'Error');
      btnCheck.disabled  = false;
      btnUpdate.disabled = false;
      appendLog(payload.message || 'Unknown error', 'error');
      switchTab('logs');
      break;
  }
}

// ── Version comparison ─────────────────────────────────────────
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

// ── Actions ────────────────────────────────────────────────────
async function checkForUpdates() {
  setState(State.CHECKING);
  appendLog('Fetching installed version…', 'info');
  try {
    const installed = await window.comet.getInstalledVersion();
    const latest    = await window.comet.getLatestVersion();
    document.getElementById('installed-version').textContent = installed === 'not-installed' ? 'Not installed' : installed;
    document.getElementById('latest-version').textContent    = latest;
    document.getElementById('installed-version').classList.remove('info-row__value--empty');
    document.getElementById('latest-version').classList.remove('info-row__value--empty');
    appendLog(`Installed: ${installed}`, 'dim');
    appendLog(`Latest: ${latest}`, 'dim');
    if (installed === 'not-installed' || versionIsNewer(latest, installed)) {
      setState(State.UPDATE_FOUND, { latestVersion: latest });
      appendLog(`Update available: ${installed} → ${latest}`, 'info');
    } else {
      setState(State.UP_TO_DATE);
      appendLog('Discord is up to date.', 'success');
    }
  } catch (err) {
    setState(State.ERROR, { message: err.message });
  }
}

function startUpdate() {
  setState(State.UPDATING);
  appendLog('Starting update process…', 'info');
  window.comet.removeProgressListener();
  window.comet.startUpdate();

  window.comet.onProgress((data) => {
    switch (data.type) {
      case 'step':
        setStep(data.step, data.status);
        appendLog(`Step ${data.step}: ${data.status}`, data.status === 'done' ? 'success' : 'info');
        break;
      case 'progress':
        setProgress(data.value, data.label);
        break;
      case 'complete':
        setState(State.COMPLETE, { newVersion: data.version });
        appendLog('Update complete. Discord launched.', 'success');
        window.comet.removeProgressListener();
        break;
      case 'error':
        setState(State.ERROR, { message: data.message });
        window.comet.removeProgressListener();
        break;
    }
  });
}

// ── Star field ─────────────────────────────────────────────────
function generateStars(container, count = 18) {
  for (let i = 0; i < count; i++) {
    const star  = document.createElement('div');
    const size  = Math.random() < 0.7 ? 1 : 2;
    const isCyan = Math.random() < 0.3;
    star.className = 'star';
    star.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      top: ${Math.random() * 100}%;
      left: ${Math.random() * 100}%;
      background: ${isCyan ? '#00d4ff' : '#ffffff'};
      --duration: ${2 + Math.random() * 3}s;
      --delay: -${Math.random() * 4}s;
    `;
    container.appendChild(star);
  }
}

// ── Renderer error capture ─────────────────────────────────────
window.addEventListener('error', (e) => {
  const msg = `Renderer error: ${e.message} (${e.filename}:${e.lineno})`;
  window.comet.writeLog('ERROR', msg);
  appendLog(msg, 'error');
});

window.addEventListener('unhandledrejection', (e) => {
  const msg = `Unhandled rejection: ${e.reason}`;
  window.comet.writeLog('ERROR', msg);
  appendLog(msg, 'error');
});

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Wire up controls
  document.getElementById('close-dot').addEventListener('click', () => window.close());
  document.getElementById('tab-update').addEventListener('click', () => switchTab('update'));
  document.getElementById('tab-logs').addEventListener('click',   () => switchTab('logs'));
  document.getElementById('btn-check').addEventListener('click',  checkForUpdates);
  document.getElementById('btn-update').addEventListener('click', startUpdate);
  document.getElementById('btn-open-log').addEventListener('click', () => window.comet.openLogFile());

  // Stars
  generateStars(document.querySelector('.window'));

  // Relay main-process logs to the panel
  window.comet.onLog((data) => {
    const type = data.level === 'ERROR' ? 'error'
               : data.level === 'INFO'  ? 'info'
               : 'dim';
    appendLog(data.msg, type);
  });

  // Load installed version on start
  (async () => {
    appendLog('Comet started.', 'dim');
    try {
      const installed = await window.comet.getInstalledVersion();
      if (installed && installed !== 'not-installed') {
        document.getElementById('installed-version').textContent = installed;
        document.getElementById('installed-version').classList.remove('info-row__value--empty');
        appendLog(`Detected Discord ${installed}`, 'info');
      }
    } catch (err) {
      appendLog(`Could not detect Discord: ${err.message}`, 'error');
    }
  })();
});
