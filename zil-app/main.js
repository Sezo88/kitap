const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, nativeImage, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');
const schedule = require('node-schedule');
const Store = require('electron-store');
const AdmZip = require('adm-zip');

// Supabase Realtime için WebSocket ve Supabase istemcisi
global.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// electron-store yapılandırma
const store = new Store({
  name: 'zil-sistemi-config',
  defaults: {
    schedules: {
      pazartesi: [],
      sali: [],
      carsamba: [],
      persembe: [],
      cuma: []
    },
    sounds: {},
    playlists: {},
    settings: {
      bellVolume: 1.0,
      musicVolume: 0.5,
      announcementVolume: 0.8,
      autoStart: true,
      bellsEnabled: true,
      defaultBellDuration: 5
    }
  }
});

let mainWindow = null;
let tray = null;
let scheduledJobs = [];
let ceremonyMode = false;
let powerSaveBlockerId = null;

// Tek instance kilidi
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: true,
    title: 'Okul Zil Sistemi',
    icon: path.join(__dirname, 'src', 'assets', 'icon.png'),
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0e1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const customRendererPath = path.join(app.getPath('userData'), 'renderer', 'index.html');
  if (fs.existsSync(customRendererPath)) {
    console.log('OTA Renderer Yaması yükleniyor:', customRendererPath);
    mainWindow.loadFile(customRendererPath).catch((err) => {
      console.error('Yama yüklenemedi, orijinal src/index.html dosyasına dönülüyor:', err);
      mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  }

  mainWindow.show();
  mainWindow.focus();

  // Pencere kapatıldığında tray'e minimize et
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // Basit bir tray ikonu oluştur
  const iconPath = path.join(__dirname, 'src', 'assets', 'icon.png');
  let trayIcon;
  
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    // Fallback: 16x16 basit ikon
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  updateTrayMenu();
  tray.setToolTip('Okul Zil Sistemi');

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Göster',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Zilleri Aç/Kapat',
      type: 'checkbox',
      checked: store.get('settings.bellsEnabled', true),
      click: (menuItem) => {
        store.set('settings.bellsEnabled', menuItem.checked);
        if (mainWindow) {
          mainWindow.webContents.send('bells-enabled-changed', menuItem.checked);
        }
      }
    },
    {
      label: 'Güncellemeleri Kontrol Et',
      click: () => {
        checkForUpdates(true);
      }
    },
    { type: 'separator' },
    {
      label: 'Çıkış',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

// ========== IPC HANDLERS ==========

// Pencere kontrolleri
ipcMain.on('window-minimize', () => mainWindow?.hide());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window-close', () => mainWindow?.close());

// Ayarları yükle/kaydet
ipcMain.handle('store-get', (event, key) => {
  return store.get(key);
});

ipcMain.handle('store-set', (event, key, value) => {
  if (value === undefined || value === null) {
    store.delete(key);
  } else {
    store.set(key, value);
  }
  if (key === 'settings.bellsEnabled') {
    sendHeartbeat();
    updateTrayMenu();
  }
  return true;
});

ipcMain.handle('store-get-all', () => {
  return store.store;
});

// Yedekleme (Dışa Aktarma)
ipcMain.handle('export-data', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Verileri Yedekle (ZIP)',
    defaultPath: path.join(app.getPath('documents'), 'okul-zil-yedek.zip'),
    filters: [{ name: 'ZIP Dosyası', extensions: ['zip'] }]
  });

  if (!result.canceled && result.filePath) {
    try {
      const zip = new AdmZip();
      
      // 1. Ayarları config.json olarak ekle
      const data = JSON.stringify(store.store, null, 2);
      zip.addFile("config.json", Buffer.from(data, "utf8"));
      
      // 2. Müzik klasöründeki dosyaları tek tek güvenli bir şekilde ekle
      const soundsDir = getSoundsDirectory();
      if (fs.existsSync(soundsDir)) {
        const files = fs.readdirSync(soundsDir);
        for (const file of files) {
          const filePath = path.join(soundsDir, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
              zip.addLocalFile(filePath, "sounds");
            }
          } catch (fileErr) {
            console.error(`Dosya yedeğe eklenirken atlandı (${file}):`, fileErr);
          }
        }
      }
      
      // ZIP'i kaydet
      zip.writeZip(result.filePath);
      return true;
    } catch (err) {
      console.error('Yedekleme hatası:', err);
      return false;
    }
  }
  return false;
});

// Nesnedeki eski dosya yollarını mevcut cihaza göre düzeltir
function fixPathsInObject(obj, currentSoundsDir) {
  if (!obj) return obj;

  if (typeof obj === 'string') {
    if (obj.includes('Zil_Sesleri_ve_Muzikler')) {
      const fileName = path.basename(obj);
      return path.join(currentSoundsDir, fileName);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => fixPathsInObject(item, currentSoundsDir));
  }

  if (typeof obj === 'object') {
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      newObj[key] = fixPathsInObject(value, currentSoundsDir);
    }
    return newObj;
  }

  return obj;
}

// Geri Yükleme (İçe Aktarma)
ipcMain.handle('import-data', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Yedekten Geri Yükle (ZIP)',
    filters: [{ name: 'ZIP Dosyası', extensions: ['zip'] }],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const zipPath = result.filePaths[0];
      const zip = new AdmZip(zipPath);
      const soundsDir = getSoundsDirectory();
      
      // 1. config.json'ı oku ve yolları düzelt
      const zipEntries = zip.getEntries();
      const configEntry = zipEntries.find(entry => entry.entryName === "config.json");
      
      if (configEntry) {
        const data = zip.readAsText(configEntry);
        let parsedData = JSON.parse(data);
        // Cihazlar arası path uyuşmazlığını çözmek için yolları düzelt
        parsedData = fixPathsInObject(parsedData, soundsDir);
        store.store = parsedData;
      }
      
      // 2. sounds klasörü altındaki dosyaları çıkart
      if (!fs.existsSync(soundsDir)) {
        fs.mkdirSync(soundsDir, { recursive: true });
      }
      
      for (const entry of zipEntries) {
        const normalizedName = entry.entryName.replace(/\\/g, '/');
        if (normalizedName.startsWith("sounds/") && !entry.isDirectory) {
          const fileName = normalizedName.substring("sounds/".length);
          if (fileName) {
            const destPath = path.join(soundsDir, fileName);
            fs.writeFileSync(destPath, entry.getData());
          }
        }
      }
      
      return true;
    } catch (err) {
      console.error('Geri yükleme hatası:', err);
      return false;
    }
  }
  return false;
});

// Ses dosyası seçme
ipcMain.handle('select-sound-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Ses Dosyası Seç',
    filters: [
      { name: 'Ses Dosyaları', extensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const sourcePath = result.filePaths[0];
  const fileName = path.basename(sourcePath);
  
  // Ses dosyasını uygulama dizinine kopyala
  const soundsDir = getSoundsDirectory();
  const destPath = path.join(soundsDir, fileName);

  try {
    if (!fs.existsSync(soundsDir)) {
      fs.mkdirSync(soundsDir, { recursive: true });
    }
    fs.copyFileSync(sourcePath, destPath);
    return { name: fileName, path: destPath };
  } catch (err) {
    console.error('Ses dosyası kopyalama hatası:', err);
    return null;
  }
});

// Birden fazla ses dosyası seçme (playlist için)
ipcMain.handle('select-multiple-sound-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Müzik Dosyaları Seç',
    filters: [
      { name: 'Ses Dosyaları', extensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a'] }
    ],
    properties: ['openFile', 'multiSelections']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const soundsDir = getSoundsDirectory();
  const copiedFiles = [];

  for (const sourcePath of result.filePaths) {
    const fileName = path.basename(sourcePath);
    const destPath = path.join(soundsDir, fileName);
    
    try {
      if (!fs.existsSync(soundsDir)) {
        fs.mkdirSync(soundsDir, { recursive: true });
      }
      fs.copyFileSync(sourcePath, destPath);
      copiedFiles.push({ name: fileName, path: destPath });
    } catch (err) {
      console.error('Dosya kopyalama hatası:', err);
    }
  }

  return copiedFiles.length > 0 ? copiedFiles : null;
});

// Ses dizinini al
function getSoundsDirectory() {
  const isDev = !app.isPackaged;
  const baseDir = isDev ? app.getAppPath() : path.dirname(app.getPath('exe'));
  const localDir = path.join(baseDir, 'Zil_Sesleri_ve_Muzikler');
  
  if (isDev) {
    return localDir;
  }
  
  try {
    // Klasörün varlığını kontrol et/oluştur ve yazılabilirliğini test et
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const testFile = path.join(localDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return localDir; // Yazılabilir, yerel dizini kullan
  } catch (err) {
    // Yazılamaz (örn: C:\Program Files altındaysa), Belgelerim klasörünü kullan
    const documentsDir = path.join(app.getPath('documents'), 'Okul Zil Sistemi', 'Zil_Sesleri_ve_Muzikler');
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }
    return documentsDir;
  }
}

// Varsayılan ses dosyalarını ilklendir ve kopyala
function initializeDefaultSounds() {
  try {
    const soundsDir = getSoundsDirectory();
    if (!fs.existsSync(soundsDir)) {
      fs.mkdirSync(soundsDir, { recursive: true });
    }

    const bundledDir = path.join(__dirname, 'assets', 'sounds');
    const defaultSoundsMap = {
      'istiklalmarsi.mp3': { type: 'sounds', key: 'anthem' },
      '2dakikalıksiren.mp3': { type: 'sounds', key: 'siren' },
      'saygı duruşu.mp3': { type: 'sounds', key: 'silence' },
      'ogrenci-zili-anonslu-Sozlu.mp3': { type: 'settings', key: 'entryBell' },
      'zilsesi1.mp3': { type: 'settings', key: 'exitBell' },
      'Ogretmen-Giris-Zili-Anonslu.mp3': { type: 'settings', key: 'teacherBell' }
    };

    for (const [fileName, mapping] of Object.entries(defaultSoundsMap)) {
      const sourcePath = path.join(bundledDir, fileName);
      const destPath = path.join(soundsDir, fileName);

      if (fs.existsSync(sourcePath)) {
        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(sourcePath, destPath);
          console.log(`Varsayılan ses kopyalandı: ${fileName}`);
        }

        const storeKey = mapping.type === 'sounds' ? `sounds.${mapping.key}` : `settings.${mapping.key}`;
        const currentVal = store.get(storeKey);
        
        if (!currentVal || !fs.existsSync(currentVal)) {
          store.set(storeKey, destPath);
          console.log(`Ayar güncellendi: ${storeKey} -> ${destPath}`);
        }
      }
    }
  } catch (err) {
    console.error('Varsayılan sesler kopyalanırken hata oluştu:', err);
  }
}

ipcMain.handle('get-sounds-directory', () => {
  return getSoundsDirectory();
});

// Ses dosyasını sil
ipcMain.handle('delete-sound-file', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const soundsDir = getSoundsDirectory();
      // Sadece oluşturduğumuz klasör içindekileri silebiliriz
      if (filePath.startsWith(soundsDir)) {
        fs.unlinkSync(filePath);
        return true;
      }
    }
  } catch (err) {
    console.error('Dosya silme hatası:', err);
  }
  return false;
});

// Mevcut ses dosyalarını listele
ipcMain.handle('list-sound-files', () => {
  const soundsDir = getSoundsDirectory();
  const bundledDir = path.join(__dirname, 'assets', 'sounds');
  const files = [];

  // Kullanıcı ses dosyaları
  if (fs.existsSync(soundsDir)) {
    const userFiles = fs.readdirSync(soundsDir)
      .filter(f => /\.(mp3|wav|ogg|aac|m4a)$/i.test(f));
    userFiles.forEach(f => {
      files.push({ name: f, path: path.join(soundsDir, f), type: 'user' });
    });
  }

  // Varsayılan ses dosyaları
  if (fs.existsSync(bundledDir)) {
    const bundledFiles = fs.readdirSync(bundledDir)
      .filter(f => /\.(mp3|wav|ogg|aac|m4a)$/i.test(f));
    bundledFiles.forEach(f => {
      files.push({ name: f, path: path.join(bundledDir, f), type: 'bundled' });
    });
  }

  return files;
});

// ========== ZAMANLAMA ==========

ipcMain.handle('set-ceremony-mode', (event, enabled) => {
  ceremonyMode = enabled;
  return ceremonyMode;
});

ipcMain.handle('get-ceremony-mode', () => {
  return ceremonyMode;
});

// Zamanlamaları güncelle
ipcMain.handle('update-schedules', () => {
  rescheduleAllBells();
  return true;
});

function rescheduleAllBells() {
  // Tüm mevcut zamanlamaları iptal et
  scheduledJobs.forEach(job => job.cancel());
  scheduledJobs = [];

  const days = ['pazar', 'pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi'];
  const dayMap = { pazar: 0, pazartesi: 1, sali: 2, carsamba: 3, persembe: 4, cuma: 5, cumartesi: 6 };

  const schedules = store.get('schedules', {});

  for (const [dayName, bells] of Object.entries(schedules)) {
    const dayOfWeek = dayMap[dayName];
    if (dayOfWeek === undefined) continue;

    bells.forEach((bell, index) => {
      if (!bell.time || !bell.enabled) return;

      const [hour, minute] = bell.time.split(':').map(Number);

      const rule = new schedule.RecurrenceRule();
      rule.dayOfWeek = dayOfWeek;
      rule.hour = hour;
      rule.minute = minute;
      rule.second = 0;

      const job = schedule.scheduleJob(rule, () => {
        // Tören modu aktifse veya ziller kapalıysa çalma
        const bellsEnabled = store.get('settings.bellsEnabled', true);
        if (ceremonyMode || !bellsEnabled) {
          console.log(`Zil atlandı (tören modu: ${ceremonyMode}, ziller aktif: ${bellsEnabled}): ${bell.label}`);
          return;
        }

        console.log(`Zil çalıyor: ${bell.label} - ${bell.time}`);
        if (mainWindow) {
          mainWindow.webContents.send('play-scheduled-bell', bell);
          mainWindow.webContents.send('bell-event', {
            type: 'ring',
            bell: bell,
            timestamp: Date.now()
          });
        }
      });

      if (job) {
        scheduledJobs.push(job);
      }
    });
  }

  console.log(`${scheduledJobs.length} zil zamanlandı.`);
}

// Otomatik başlatma ayarı
ipcMain.handle('set-auto-start', (event, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: app.getPath('exe')
  });
  store.set('settings.autoStart', enabled);
  return true;
});

ipcMain.handle('get-auto-start', () => {
  return store.get('settings.autoStart', true);
});

// Supabase Değişkenleri
let supabase = null;
let schoolId = null;
let bellCommandsSubscription = null;

function setupSupabase() {
  let supabaseUrl = store.get('settings.supabaseUrl');
  let supabaseKey = store.get('settings.supabaseKey');
  schoolId = store.get('settings.schoolId');

  // Cihazdaki diğer projeden (C:\Projects\kitap\.env.local) otomatik okumaya çalış
  if (!supabaseUrl || !supabaseKey) {
    try {
      const peerEnvPath = path.join(__dirname, '..', 'kitap', '.env.local');
      if (fs.existsSync(peerEnvPath)) {
        const envContent = fs.readFileSync(peerEnvPath, 'utf8');
        const lines = envContent.split('\n');
        let url = '';
        let key = '';
        lines.forEach(line => {
          if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
            url = line.split('=')[1].trim();
          }
          if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
            key = line.split('=')[1].trim();
          }
        });
        if (url && key) {
          supabaseUrl = url;
          supabaseKey = key;
          store.set('settings.supabaseUrl', url);
          store.set('settings.supabaseKey', key);
          console.log('Supabase credentials auto-detected from C:\\Projects\\kitap\\.env.local');
        }
      }
    } catch (err) {
      console.error('Error auto-detecting Supabase env:', err);
    }
  }

  if (supabaseUrl && supabaseKey) {
    try {
      supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
      });
      console.log('Supabase client initialized.');
      if (schoolId) {
        listenToBellCommands();
        startHeartbeat();
        processPendingCommands();
        
        // Supabase Realtime'a ek olarak, gecikmeleri önlemek için 3 saniyede bir yedek kontrol (polling) yap
        setInterval(processPendingCommands, 3000);
      } else {
        console.warn('School ID not set. Realtime listener, heartbeat, and pending checker not started.');
      }
    } catch (err) {
      console.error('Supabase initialization failed:', err);
    }
  } else {
    console.warn('Supabase credentials not configured.');
  }
}

let heartbeatInterval = null;

function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  // Anlık ilk kalp atışı gönderimi
  sendHeartbeat();

  // Her 30 saniyede bir gönder
  heartbeatInterval = setInterval(sendHeartbeat, 30000);
}

async function sendHeartbeat() {
  if (supabase && schoolId) {
    try {
      const bellsEnabled = store.get('settings.bellsEnabled', true);
      const { error } = await supabase.rpc('bell_heartbeat', { 
        p_school_id: schoolId,
        p_bell_active: bellsEnabled
      });
      if (error) {
        console.error('Heartbeat gönderim hatası:', error.message);
      } else {
        console.log(`Heartbeat başarıyla gönderildi (Ziller aktif: ${bellsEnabled}).`);
      }
    } catch (err) {
      console.error('Heartbeat gönderimi sırasında istisna:', err.message);
    }
  }
}

async function processPendingCommands() {
  if (!supabase || !schoolId) return;

  console.log('Bekleyen komutlar kontrol ediliyor...');
  try {
    const { data: pendingCmds, error } = await supabase
      .from('bell_commands')
      .select('*')
      .eq('school_id', schoolId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Bekleyen komutları çekerken hata:', error.message);
      return;
    }

    if (pendingCmds && pendingCmds.length > 0) {
      console.log(`${pendingCmds.length} adet bekleyen komut onaylanıyor (acknowledged)...`);
      
      // Tüm bekleyen komutların ID'lerini al
      const cmdIds = pendingCmds.map(cmd => cmd.id);
      
      // Hepsini tek seferde onaylanmış yap (RPC üzerinden)
      const { error: ackErr } = await supabase.rpc('acknowledge_bell_commands', { p_cmd_ids: cmdIds });
      if (ackErr) {
        console.error('Bekleyen komutlar onaylanırken hata:', ackErr.message);
      }

      // Sadece en son gönderilen komutu çal (ve sadece son 2 dakika içinde gönderildiyse)
      const latestCmd = pendingCmds[pendingCmds.length - 1];
      const diff = Date.now() - new Date(latestCmd.triggered_at || latestCmd.created_at).getTime();
      
      if (diff < 120000) { // 2 dakika (120 saniye)
        console.log(`En son bekleyen komut çalınıyor: ${latestCmd.command_type}`);
        if (mainWindow) {
          mainWindow.webContents.send('remote-command', latestCmd);
        }
      } else {
        console.log('Bekleyen komutlar eski olduğu için çalınmadı, sadece alındı olarak işaretlendi.');
      }
    }
  } catch (err) {
    console.error('Bekleyen komut kontrolü sırasında hata:', err.message);
  }
}

function listenToBellCommands() {
  if (!supabase || !schoolId) return;

  if (bellCommandsSubscription) {
    bellCommandsSubscription.unsubscribe();
  }

  console.log(`Supabase Realtime dinlemesi başlatılıyor. Okul ID: ${schoolId}`);

  bellCommandsSubscription = supabase
    .channel('public:bell_commands')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'bell_commands',
        filter: `school_id=eq.${schoolId}`
      },
      async (payload) => {
        const cmd = payload.new;
        if (cmd && cmd.status === 'pending') {
          console.log('Uzaktan komut tetiklendi:', cmd.command_type);
          
          if (mainWindow) {
            mainWindow.webContents.send('remote-command', cmd);
          }

          // Komutu 'acknowledged' olarak işaretle (RPC üzerinden)
          const { error } = await supabase.rpc('acknowledge_bell_commands', { p_cmd_ids: [cmd.id] });

          if (error) {
            console.error('Komut durumu güncellenirken hata:', error.message);
          }
        }
      }
    )
    .subscribe((status) => {
      console.log(`Supabase Realtime durum: ${status}`);
      if (mainWindow) {
        mainWindow.webContents.send('supabase-status', status === 'SUBSCRIBED');
      }
    });
}

// Reconnect ve Okul Kodu + PIN Çözümleme Handler'ı
ipcMain.handle('reconnect-supabase', async (event, schoolCode, pin) => {
  const supabaseUrl = store.get('settings.supabaseUrl');
  const supabaseKey = store.get('settings.supabaseKey');

  if (!supabaseUrl || !supabaseKey) {
    return { success: false, error: 'Supabase URL veya Anon Key bilgileri eksik.' };
  }

  try {
    const tempClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    if (!schoolCode) {
      return { success: false, error: 'Okul kodu boş olamaz.' };
    }

    // Okul kodu ve PIN doğrulaması yap (RPC resolve_school_code_secure)
    const { data: schoolsList, error: err } = await tempClient
      .rpc('resolve_school_code_secure', {
        p_code: schoolCode.trim().toUpperCase(),
        p_pin: pin ? pin.trim() : null
      });

    if (err || !schoolsList || schoolsList.length === 0) {
      return { success: false, error: 'Okul kodu veya PIN hatalı.' };
    }

    const school = schoolsList[0];
    const schoolId = school.school_id || school.id;
    const schoolName = school.school_name || school.name || 'Okul';

    if (!schoolId) {
      return { success: false, error: 'Okul ID bilgisi alınamadı.' };
    }

    // Okul ID ve Kodu kaydet
    store.set('settings.schoolId', schoolId);
    store.set('settings.schoolCode', schoolCode.trim().toUpperCase());
    // Supabase bağlantısını yeniden yükle
    setupSupabase();
    
    return { success: true, schoolName: schoolName };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

const { autoUpdater } = require('electron-updater');

// Güncelleme Kontrolü Fonksiyonu (Katman 2 - Tam Sürüm)
async function checkForUpdates(manualCheck = false) {
  const manifestUrl = 'https://oyp.vercel.app/downloads/renderer-manifest.json';
  
  try {
    // Her event listener eklemeden önce eskileri temizle ki çoklu kayıt olmasın
    autoUpdater.removeAllListeners('update-not-available');
    autoUpdater.removeAllListeners('update-available');
    autoUpdater.removeAllListeners('update-downloaded');
    autoUpdater.removeAllListeners('download-progress');

    if (manualCheck) {
      autoUpdater.once('update-not-available', () => {
        if (mainWindow) {
          mainWindow.webContents.send('update-available', { version: 'Güncel' });
        }
      });
    }

    autoUpdater.once('update-available', (info) => {
      console.log('Yeni sürüm bulundu:', info.version);
      if (mainWindow) {
        mainWindow.webContents.send('update-available', {
          version: info.version,
          notes: info.releaseNotes || 'Yeni sürüm indiriliyor...'
        });
      }
    });

    autoUpdater.on('download-progress', (progressObj) => {
      if (mainWindow) {
        mainWindow.webContents.send('update-progress', {
          percent: progressObj.percent,
          bytesPerSecond: progressObj.bytesPerSecond
        });
      }
    });

    autoUpdater.once('update-downloaded', () => {
      console.log('Güncelleme indirildi, kapanışta kurulacak.');
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded');
      }
    });

    // Otomatik indirmeyi kapat, kullanıcı butona basınca indireceğiz
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error('Güncelleme kontrol hatası:', error.message);
    if (manualCheck && mainWindow) {
      // Sessizce hatayı yoksayalım, console'da kalabilir
    }
  }

  // Katman 1 (OTA Renderer Hot-Patch)
  try {
    const res = await fetch(manifestUrl);
    if (res.ok) {
      const data = await res.json();
      const localRendererVer = store.get('settings.rendererVersion', 0);
      if (data.renderer_version && data.renderer_version > localRendererVer && data.url) {
        console.log(`Yeni renderer yaması bulundu: v${data.renderer_version} (Yerel: v${localRendererVer})`);
        
        const zipRes = await fetch(data.url);
        if (zipRes.ok) {
          const buffer = Buffer.from(await zipRes.arrayBuffer());
          const tempZipPath = path.join(app.getPath('userData'), 'temp_renderer_patch.zip');
          fs.writeFileSync(tempZipPath, buffer);

          const rendererDir = path.join(app.getPath('userData'), 'renderer');
          const zip = new AdmZip(tempZipPath);
          zip.extractAllTo(rendererDir, true);
          fs.unlinkSync(tempZipPath);

          store.set('settings.rendererVersion', data.renderer_version);
          console.log('Renderer yaması başarıyla uygulandı.');

          if (mainWindow) {
            mainWindow.webContents.send('renderer-patch-available', {
              version: data.renderer_version,
              notes: data.notes
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Renderer yama kontrolü hatası:', err);
  }
}

ipcMain.handle('check-for-updates', async () => {
  await checkForUpdates(true);
  return { success: true };
});

// Uygulama dosya yolunu al
ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});

ipcMain.handle('start-download-update', () => {
  try {
    autoUpdater.downloadUpdate();
    return true;
  } catch (e) {
    if (e.message && e.message.includes('update downloaded')) {
      autoUpdater.quitAndInstall(false, true);
    }
    return false;
  }
});

// ========== APP LIFECYCLE ==========

app.whenReady().then(() => {
  // Ekran kapansa dahi Windows'un uygulamayı askıya almasını (suspension) ve uykuya geçmesini engelle
  try {
    powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    console.log(`Power save blocker başlatıldı. ID: ${powerSaveBlockerId}`);
  } catch (err) {
    console.error('Power save blocker başlatılamadı:', err);
  }

  initializeDefaultSounds();
  setupSupabase();
  createWindow();
  createTray();
  rescheduleAllBells();

  // Güncelleme kontrolünü başlat (açılışta + 24 saatte bir)
  setTimeout(() => checkForUpdates(false), 5000);
  setInterval(() => checkForUpdates(false), 24 * 60 * 60 * 1000);

  // Otomatik başlatma ayarla
  const autoStart = store.get('settings.autoStart', true);
  app.setLoginItemSettings({
    openAtLogin: autoStart,
    path: app.getPath('exe')
  });
});

app.on('window-all-closed', () => {
  // Windows'ta pencere kapanınca tray'de kalmaya devam et
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  
  if (powerSaveBlockerId !== null) {
    try {
      powerSaveBlocker.stop(powerSaveBlockerId);
      console.log(`Power save blocker durduruldu. ID: ${powerSaveBlockerId}`);
    } catch (err) {
      console.error('Power save blocker durdurulamadı:', err);
    }
  }

  // Tüm zamanlamaları iptal et
  scheduledJobs.forEach(job => job.cancel());
  schedule.gracefulShutdown();
});
