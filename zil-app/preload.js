const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Pencere kontrolleri
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // Store işlemleri
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  storeGetAll: () => ipcRenderer.invoke('store-get-all'),
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: () => ipcRenderer.invoke('import-data'),

  // Ses dosyası işlemleri
  selectSoundFile: () => ipcRenderer.invoke('select-sound-file'),
  selectMultipleSoundFiles: () => ipcRenderer.invoke('select-multiple-sound-files'),
  listSoundFiles: () => ipcRenderer.invoke('list-sound-files'),
  deleteSoundFile: (filePath) => ipcRenderer.invoke('delete-sound-file', filePath),
  getSoundsDirectory: () => ipcRenderer.invoke('get-sounds-directory'),

  // Zamanlama
  updateSchedules: () => ipcRenderer.invoke('update-schedules'),
  setCeremonyMode: (enabled) => ipcRenderer.invoke('set-ceremony-mode', enabled),
  getCeremonyMode: () => ipcRenderer.invoke('get-ceremony-mode'),

  // Otomatik başlatma
  setAutoStart: (enabled) => ipcRenderer.invoke('set-auto-start', enabled),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),

  // Uygulama yolu
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // Supabase reconnect (Okul Kodu + PIN)
  reconnectSupabase: (schoolCode, pin) => ipcRenderer.invoke('reconnect-supabase', schoolCode, pin),

  // Güncelleme Kontrolü
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  restartApp: () => ipcRenderer.invoke('restart-app'),

  // Olayları dinle
  onPlayScheduledBell: (callback) => {
    ipcRenderer.on('play-scheduled-bell', (event, bell) => callback(bell));
  },
  onBellEvent: (callback) => {
    ipcRenderer.on('bell-event', (event, data) => callback(data));
  },
  onBellsEnabledChanged: (callback) => {
    ipcRenderer.on('bells-enabled-changed', (event, enabled) => callback(enabled));
  },
  onRemoteCommand: (callback) => {
    ipcRenderer.on('remote-command', (event, cmd) => callback(cmd));
  },
  // Güncelleme Olayları
  startDownloadUpdate: () => ipcRenderer.invoke('start-download-update'),
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-progress', (event, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info));
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, info) => callback(info));
  },
  onRendererPatchAvailable: (callback) => {
    ipcRenderer.on('renderer-patch-available', (event, info) => callback(info));
  },
  onSupabaseStatus: (callback) => {
    ipcRenderer.on('supabase-status', (event, isConnected) => callback(isConnected));
  }
});
