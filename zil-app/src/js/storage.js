/**
 * storage.js - Veri Saklama Modülü
 * electron-store üzerinden kalıcı veri okuma/yazma
 */

const Storage = {
  // Veri önbelleği (performans için)
  _cache: null,

  /**
   * Tüm verileri yükle
   */
  async loadAll() {
    try {
      this._cache = await window.electronAPI.storeGetAll();
      return this._cache;
    } catch (err) {
      console.error('Veri yükleme hatası:', err);
      return this._getDefaults();
    }
  },

  /**
   * Belirli bir anahtarı oku
   */
  async get(key) {
    try {
      return await window.electronAPI.storeGet(key);
    } catch (err) {
      console.error(`Veri okuma hatası (${key}):`, err);
      return null;
    }
  },

  /**
   * Belirli bir anahtara yaz
   */
  async set(key, value) {
    try {
      await window.electronAPI.storeSet(key, value);
      // Önbelleği güncelle
      if (this._cache) {
        this._setNestedValue(this._cache, key, value);
      }
      return true;
    } catch (err) {
      console.error(`Veri yazma hatası (${key}):`, err);
      return false;
    }
  },

  /**
   * Zil programını kaydet
   */
  async saveSchedule(day, bells) {
    return await this.set(`schedules.${day}`, bells);
  },

  /**
   * Zil programını oku
   */
  async getSchedule(day) {
    const schedule = await this.get(`schedules.${day}`);
    return schedule || [];
  },

  /**
   * Tüm programları oku
   */
  async getAllSchedules() {
    const schedules = await this.get('schedules');
    return schedules || this._getDefaults().schedules;
  },

  /**
   * Ayarları kaydet
   */
  async saveSetting(key, value) {
    return await this.set(`settings.${key}`, value);
  },

  /**
   * Ayar oku
   */
  async getSetting(key) {
    const value = await this.get(`settings.${key}`);
    return value !== null && value !== undefined ? value : this._getDefaults().settings[key];
  },

  /**
   * Ses atamalarını kaydet
   */
  async saveSoundAssignment(key, filePath) {
    return await this.set(`sounds.${key}`, filePath);
  },

  /**
   * Ses atamasını oku
   */
  async getSoundAssignment(key) {
    return await this.get(`sounds.${key}`);
  },

  /**
   * Playlist kaydet
   */
  async savePlaylist(playlist) {
    return await this.set('playlists.default', playlist);
  },

  /**
   * Playlist oku
   */
  async getPlaylist() {
    const playlist = await this.get('playlists.default');
    return playlist || [];
  },

  /**
   * Anonsları kaydet
   */
  async saveAnnouncements(announcements) {
    return await this.set('announcements', announcements);
  },

  /**
   * Anonsları oku
   */
  async getAnnouncements() {
    const announcements = await this.get('announcements');
    return announcements || [];
  },

  /**
   * Yedekleme/İçe Aktarma sarmalayıcıları
   */
  async exportData() {
    return await window.electronAPI.exportData();
  },

  async importData() {
    const success = await window.electronAPI.importData();
    if (success) {
      this._cache = await window.electronAPI.storeGetAll();
    }
    return success;
  },

  /**
   * Varsayılan değerler
   */
  _getDefaults() {
    return {
      schedules: {
        pazartesi: [],
        sali: [],
        carsamba: [],
        persembe: [],
        cuma: []
      },
      sounds: {},
      playlists: { default: [] },
      announcements: [],
      settings: {
        bellVolume: 1.0,
        musicVolume: 0.5,
        announcementVolume: 0.8,
        autoStart: true,
        bellsEnabled: true,
        defaultBellDuration: 5,
        silenceDuration: 60,
        entryBell: null,
        exitBell: null,
        teacherBell: null,
        quickBell: null,
        recessSettings: {}
      }
    };
  },

  /**
   * Noktalı anahtarla nested değer atama
   */
  _setNestedValue(obj, key, value) {
    const parts = key.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }
};
