const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('comet', {
  getInstalledVersion:    () => ipcRenderer.invoke('get-installed-version'),
  getLatestVersion:       () => ipcRenderer.invoke('get-latest-version'),
  startUpdate:            () => ipcRenderer.send('start-update'),
  onProgress:             (cb) => ipcRenderer.on('update-progress', (_e, data) => cb(data)),
  removeProgressListener: () => ipcRenderer.removeAllListeners('update-progress'),
  writeLog:               (level, msg) => ipcRenderer.send('write-log', { level, msg }),
  openLogFile:            () => ipcRenderer.send('open-log-file'),
  onLog:                  (cb) => ipcRenderer.on('app-log', (_e, data) => cb(data)),
});
