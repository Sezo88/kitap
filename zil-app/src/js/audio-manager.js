/**
 * audio-manager.js - Ses Çalma Yönetimi
 * HTML5 Audio API ile ses çalma, durdurma, ses seviyesi kontrolü
 */

const AudioManager = {
  // Ses kanalları
  _bellAudio: null,       // Zil sesi
  _ceremonyAudio: null,   // Tören sesleri (İstiklal Marşı, Siren)
  _musicAudio: null,      // Teneffüs müziği
  
  // Durum
  _isPlaying: false,
  _currentChannel: null,  // 'bell', 'ceremony', 'music'
  _musicPlaylist: [],
  _musicIndex: 0,
  _musicPlaying: false,
  
  // Callbacks
  onPlayStateChange: null,  // (isPlaying, channel, label) => {}
  onMusicEnd: null,
  
  /**
   * Başlatma
   */
  init() {
    this._bellAudio = new Audio();
    this._ceremonyAudio = new Audio();
    this._musicAudio = new Audio();
    
    // Müzik bittiğinde sonraki parçaya geç
    this._musicAudio.addEventListener('ended', () => {
      this._playNextInPlaylist();
    });
    
    // Tören sesi bittiğinde durumu güncelle
    this._ceremonyAudio.addEventListener('ended', () => {
      this._isPlaying = false;
      this._currentChannel = null;
      if (this.onPlayStateChange) {
        this.onPlayStateChange(false, 'ceremony', '');
      }
    });
    
    // Zil sesi bittiğinde durumu güncelle
    this._bellAudio.addEventListener('ended', () => {
      this._isPlaying = false;
      this._currentChannel = null;
      if (this.onPlayStateChange) {
        this.onPlayStateChange(false, 'bell', '');
      }
    });
  },
  
  /**
   * Zil çal
   */
  playBell(soundPath, volume = 1.0, duration = 0) {
    if (!soundPath) {
      console.warn('Zil ses dosyası belirtilmedi');
      return false;
    }
    
    this._stopChannel('bell');
    
    this._bellAudio.src = soundPath;
    this._bellAudio.volume = Math.min(1, Math.max(0, volume));
    this._bellAudio.currentTime = 0;
    
    const playPromise = this._bellAudio.play();
    if (playPromise) {
      playPromise.catch(err => console.error('Zil çalma hatası:', err));
    }
    
    this._isPlaying = true;
    this._currentChannel = 'bell';
    
    if (this.onPlayStateChange) {
      this.onPlayStateChange(true, 'bell', 'Zil çalıyor');
    }
    
    // Belirli süre sonra durdur
    if (duration > 0) {
      setTimeout(() => {
        this.stopBell();
      }, duration * 1000);
    }
    
    return true;
  },
  
  /**
   * Zil durdur
   */
  stopBell() {
    this._stopChannel('bell');
  },
  
  /**
   * Tören sesi çal (İstiklal Marşı, Siren)
   */
  playCeremony(soundPath, volume = 1.0, label = 'Tören') {
    if (!soundPath) {
      console.warn('Tören ses dosyası belirtilmedi');
      return false;
    }
    
    // Diğer sesleri durdur
    this.stopAll();
    
    this._ceremonyAudio.src = soundPath;
    this._ceremonyAudio.volume = Math.min(1, Math.max(0, volume));
    this._ceremonyAudio.currentTime = 0;
    
    const playPromise = this._ceremonyAudio.play();
    if (playPromise) {
      playPromise.catch(err => console.error('Tören sesi çalma hatası:', err));
    }
    
    this._isPlaying = true;
    this._currentChannel = 'ceremony';
    
    if (this.onPlayStateChange) {
      this.onPlayStateChange(true, 'ceremony', label);
    }
    
    return true;
  },
  
  /**
   * Tören sesini durdur
   */
  stopCeremony() {
    this._stopChannel('ceremony');
  },
  
  /**
   * Müzik çal
   */
  playMusic(soundPath, volume = 0.5, label = 'Müzik') {
    if (!soundPath) {
      console.warn('Müzik dosyası belirtilmedi');
      return false;
    }
    
    this._musicAudio.src = soundPath;
    this._musicAudio.volume = Math.min(1, Math.max(0, volume));
    this._musicAudio.currentTime = 0;
    
    const playPromise = this._musicAudio.play();
    if (playPromise) {
      playPromise.catch(err => console.error('Müzik çalma hatası:', err));
    }
    
    this._musicPlaying = true;
    
    if (this.onPlayStateChange) {
      this.onPlayStateChange(true, 'music', label);
    }
    
    return true;
  },
  
  /**
   * Playlist çal
   */
  playPlaylist(playlist, volume = 0.5) {
    if (!playlist || playlist.length === 0) {
      console.warn('Playlist boş');
      return false;
    }
    
    this._musicPlaylist = [...playlist];
    this._musicIndex = 0;
    
    return this.playMusic(
      this._musicPlaylist[0].path,
      volume,
      this._musicPlaylist[0].name
    );
  },
  
  /**
   * Playlist'te sonraki parça
   */
  _playNextInPlaylist() {
    if (this._musicPlaylist.length === 0) {
      this._musicPlaying = false;
      if (this.onPlayStateChange) {
        this.onPlayStateChange(false, 'music', '');
      }
      return;
    }
    
    this._musicIndex = (this._musicIndex + 1) % this._musicPlaylist.length;
    const next = this._musicPlaylist[this._musicIndex];
    
    this._musicAudio.src = next.path;
    this._musicAudio.currentTime = 0;
    
    const playPromise = this._musicAudio.play();
    if (playPromise) {
      playPromise.catch(err => console.error('Sonraki parça hatası:', err));
    }
    
    if (this.onPlayStateChange) {
      this.onPlayStateChange(true, 'music', next.name);
    }
  },
  
  /**
   * Müzik durdur
   */
  stopMusic() {
    this._musicAudio.pause();
    this._musicAudio.currentTime = 0;
    this._musicPlaying = false;
    this._musicPlaylist = [];
    this._musicIndex = 0;
    
    if (this.onPlayStateChange) {
      this.onPlayStateChange(false, 'music', '');
    }
  },
  
  /**
   * Her şeyi durdur
   */
  stopAll() {
    this._stopChannel('bell');
    this._stopChannel('ceremony');
    this.stopMusic();
    
    this._isPlaying = false;
    this._currentChannel = null;
  },
  
  /**
   * Belirli kanalı durdur
   */
  _stopChannel(channel) {
    let audio;
    switch (channel) {
      case 'bell': audio = this._bellAudio; break;
      case 'ceremony': audio = this._ceremonyAudio; break;
      case 'music': audio = this._musicAudio; break;
      default: return;
    }
    
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    
    if (this._currentChannel === channel) {
      this._isPlaying = false;
      this._currentChannel = null;
    }
    
    if (this.onPlayStateChange) {
      this.onPlayStateChange(false, channel, '');
    }
  },
  
  /**
   * Ses seviyesi ayarla
   */
  setVolume(channel, volume) {
    const vol = Math.min(1, Math.max(0, volume));
    switch (channel) {
      case 'bell': this._bellAudio.volume = vol; break;
      case 'ceremony': this._ceremonyAudio.volume = vol; break;
      case 'music': this._musicAudio.volume = vol; break;
    }
  },
  
  /**
   * Çalıyor mu?
   */
  isPlaying(channel = null) {
    if (channel) {
      switch (channel) {
        case 'bell': return !this._bellAudio.paused;
        case 'ceremony': return !this._ceremonyAudio.paused;
        case 'music': return this._musicPlaying && !this._musicAudio.paused;
      }
    }
    return this._isPlaying || this._musicPlaying;
  },
  
  /**
   * Ses dosyası önizleme (kısa çal)
   */
  preview(soundPath, volume = 0.5, duration = 3) {
    const previewAudio = new Audio(soundPath);
    previewAudio.volume = volume;
    previewAudio.play().catch(err => console.error('Önizleme hatası:', err));
    
    setTimeout(() => {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }, duration * 1000);
    
    return previewAudio;
  }
};
