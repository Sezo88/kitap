/**
 * scheduler.js - Zamanlama Motoru
 * Renderer tarafı zamanlama yardımcıları ve zil programı yönetimi
 */

const Scheduler = {
  // Durum
  _currentDay: null,
  _todaySchedule: [],
  _ceremonyMode: false,
  _silenceTimer: null,
  _silenceDuration: 60, // saniye
  _silenceCallback: null,
  
  // Gün isimleri (Türkçe)
  dayNames: {
    0: 'pazar',
    1: 'pazartesi',
    2: 'sali',
    3: 'carsamba',
    4: 'persembe',
    5: 'cuma',
    6: 'cumartesi'
  },
  
  dayLabels: {
    pazar: 'Pazar',
    pazartesi: 'Pazartesi',
    sali: 'Salı',
    carsamba: 'Çarşamba',
    persembe: 'Perşembe',
    cuma: 'Cuma',
    cumartesi: 'Cumartesi'
  },
  
  bellTypeLabels: {
    entry: '🔔 Giriş',
    exit: '🔕 Çıkış',
    teacher: '👨‍🏫 Öğretmen',
    break_music: '🎵 Müzik',
    announcement: '📢 Anons',
    custom: '⚡ Özel'
  },
  
  /**
   * Başlatma
   */
  async init() {
    this._currentDay = this.getTodayKey();
    this._silenceDuration = await Storage.getSetting('silenceDuration') || 60;
    await this.loadTodaySchedule();
    
    // Main process'ten gelen zamanlanmış zil olaylarını dinle
    window.electronAPI.onPlayScheduledBell((bell) => {
      this._handleScheduledBell(bell);
    });
  },
  
  /**
   * Bugünün gün anahtarını al
   */
  getTodayKey() {
    const dayOfWeek = new Date().getDay();
    return this.dayNames[dayOfWeek] || 'pazartesi';
  },
  
  /**
   * Bugünün gün adını al (Türkçe)
   */
  getTodayLabel() {
    const key = this.getTodayKey();
    return this.dayLabels[key] || key;
  },
  
  /**
   * Bugünün programını yükle
   */
  async loadTodaySchedule() {
    this._todaySchedule = await Storage.getSchedule(this.getTodayKey());
    return this._todaySchedule;
  },
  
  /**
   * Sonraki zili bul
   */
  getNextBell() {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const enabledBells = this._todaySchedule
      .filter(b => b.enabled !== false)
      .sort((a, b) => {
        const [ah, am] = a.time.split(':').map(Number);
        const [bh, bm] = b.time.split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      });
    
    for (const bell of enabledBells) {
      const [h, m] = bell.time.split(':').map(Number);
      const bellMinutes = h * 60 + m;
      
      if (bellMinutes > currentMinutes) {
        return {
          ...bell,
          minutesUntil: bellMinutes - currentMinutes
        };
      }
    }
    
    // Bugün kalan zil yok
    return null;
  },
  
  /**
   * Geri sayım metni oluştur
   */
  getCountdownText(minutesUntil) {
    if (minutesUntil <= 0) return '';
    
    const hours = Math.floor(minutesUntil / 60);
    const mins = minutesUntil % 60;
    
    if (hours > 0) {
      return `${hours} saat ${mins} dakika sonra`;
    }
    return `${mins} dakika sonra`;
  },
  
  /**
   * Zamanlanmış zil olayını işle
   */
  _handleScheduledBell(bell) {
    if (this._ceremonyMode) {
      console.log('Tören modu aktif, zil atlandı:', bell.label);
      return;
    }
    
    // Zil türüne göre işlem
    switch (bell.type) {
      case 'entry':
      case 'exit':
      case 'teacher':
      case 'custom':
        this._playBellSound(bell);
        break;
      case 'break_music':
        this._playBreakMusic(bell);
        break;
      case 'announcement':
        this._playAnnouncement(bell);
        break;
    }
  },
  
  /**
   * Zil sesi çal
   */
  async _playBellSound(bell) {
    // Giriş veya öğretmen zili çaldığında teneffüs müziği durdurulur
    if (bell.type === 'entry' || bell.type === 'teacher') {
      AudioManager.stopMusic();
    }

    const bellVolume = await Storage.getSetting('bellVolume');
    const bellDuration = await Storage.getSetting('defaultBellDuration') || 5;
    
    let soundPath = null;
    
    // Global sesleri kullan
    if (bell.type === 'entry') {
      soundPath = await Storage.getSetting('entryBell');
    } else if (bell.type === 'exit') {
      soundPath = await Storage.getSetting('exitBell');
    } else if (bell.type === 'teacher') {
      soundPath = await Storage.getSetting('teacherBell');
    } else {
      // Özel ziller vs.
      soundPath = bell.sound || await Storage.getSetting('defaultBellSound');
    }
    
    if (soundPath) {
      AudioManager.playBell(soundPath, bellVolume, bellDuration);
      UI.showToast(`🔔 ${bell.label || 'Zil çalıyor'}`, 'info');

      // Çıkış zili ise ve teneffüs müziği etkinse, zil bittikten sonra müziği başlat
      if (bell.type === 'exit') {
        this._checkAndPlayRecessMusic(bell.time, bellDuration);
      }
    } else {
      UI.showToast(`⚠️ ${bell.type === 'entry' ? 'Giriş' : 'Çıkış'} zili için ses dosyası atanmamış!`, 'warning');
    }
  },

  /**
   * Çıkış zili çaldıktan sonra otomatik teneffüs müziğini kontrol eder ve başlatır
   */
  async _checkAndPlayRecessMusic(exitTime, delaySeconds) {
    const recessSettings = await Storage.getSetting('recessSettings') || {};
    const config = recessSettings[exitTime];
    
    if (config && config.enabled) {
      setTimeout(async () => {
        // Tören modu veya ziller kapalıysa çalma
        const bellsEnabled = await Storage.getSetting('bellsEnabled');
        if (this._ceremonyMode || bellsEnabled === false) return;
        
        const playlist = await Storage.getPlaylist();
        const musicVolume = await Storage.getSetting('musicVolume');
        
        if (!playlist || playlist.length === 0) {
          UI.showToast('⚠️ Müzik listesi boş olduğu için teneffüs müziği çalınamadı!', 'warning');
          return;
        }
        
        let soundToPlay = config.sound;
        
        if (soundToPlay === 'random') {
          const randomIndex = Math.floor(Math.random() * playlist.length);
          AudioManager.playMusic(playlist[randomIndex].path, musicVolume, playlist[randomIndex].name);
          UI.showToast(`🎵 Teneffüs Müziği (Rastgele): ${playlist[randomIndex].name}`, 'info');
        } else {
          const index = parseInt(soundToPlay);
          if (!isNaN(index) && playlist[index]) {
            AudioManager.playMusic(playlist[index].path, musicVolume, playlist[index].name);
            UI.showToast(`🎵 Teneffüs Müziği: ${playlist[index].name}`, 'info');
          } else {
            // Rastgele çal (varsayılan)
            const randomIndex = Math.floor(Math.random() * playlist.length);
            AudioManager.playMusic(playlist[randomIndex].path, musicVolume, playlist[randomIndex].name);
            UI.showToast(`🎵 Teneffüs Müziği (Rastgele): ${playlist[randomIndex].name}`, 'info');
          }
        }
        
        // Süre sınırı varsa durdur
        if (config.durationLimit !== 'infinite') {
          const durationSec = parseInt(config.durationLimit);
          if (!isNaN(durationSec) && durationSec > 0) {
            setTimeout(() => {
              AudioManager.stopMusic();
            }, durationSec * 1000);
          }
        }
      }, delaySeconds * 1000);
    }
  },

  /**
   * Teneffüsleri otomatik olarak belirle
   */
  getDetectedRecesses(bells) {
    if (!bells || bells.length === 0) return [];
    
    // Zilleri saate göre sırala (aktif olanlar)
    const sorted = [...bells]
      .filter(b => b.enabled !== false)
      .sort((a, b) => {
        const [ah, am] = a.time.split(':').map(Number);
        const [bh, bm] = b.time.split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      });
      
    const recesses = [];
    let recessCount = 0;
    
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      if (current.type === 'exit') {
        // Bir sonraki giriş veya öğretmen zilini bul
        let nextEntry = null;
        for (let j = i + 1; j < sorted.length; j++) {
          if (sorted[j].type === 'entry' || sorted[j].type === 'teacher') {
            nextEntry = sorted[j];
            break;
          }
        }
        
        if (nextEntry) {
          const [sh, sm] = current.time.split(':').map(Number);
          const [eh, em] = nextEntry.time.split(':').map(Number);
          
          const startMin = sh * 60 + sm;
          const endMin = eh * 60 + em;
          const duration = endMin - startMin;
          
          if (duration > 0) {
            let label = "";
            if (duration > 20) {
              label = "Öğle Arası";
            } else {
              recessCount++;
              label = `${recessCount}. Teneffüs`;
            }
            
            recesses.push({
              id: current.time,
              startTime: current.time,
              endTime: nextEntry.time,
              duration: duration,
              label: label
            });
          }
        }
      }
    }
    
    return recesses;
  },
  
  /**
   * Teneffüs müziği çal
   */
  async _playBreakMusic(bell) {
    const playlist = await Storage.getPlaylist();
    const musicVolume = await Storage.getSetting('musicVolume');
    
    if (!playlist || playlist.length === 0) {
      UI.showToast('⚠️ Müzik listesi boş!', 'warning');
      return;
    }

    if (bell.sound === 'random') {
      // Rastgele çal
      const randomIndex = Math.floor(Math.random() * playlist.length);
      AudioManager.playMusic(playlist[randomIndex].path, musicVolume, playlist[randomIndex].name);
      UI.showToast(`🎵 Rastgele Müzik: ${playlist[randomIndex].name}`, 'info');
    } else if (bell.sound !== null && bell.sound !== undefined) {
      // Belirli bir müziği çal
      const index = parseInt(bell.sound);
      if (playlist[index]) {
        AudioManager.playMusic(playlist[index].path, musicVolume, playlist[index].name);
        UI.showToast(`🎵 Müzik: ${playlist[index].name}`, 'info');
      } else {
         UI.showToast('⚠️ Seçilen müzik listede bulunamadı!', 'warning');
      }
    } else {
      // Default: Playlisti sırayla çal
      AudioManager.playPlaylist(playlist, musicVolume);
      UI.showToast('🎵 Teneffüs müziği başladı', 'info');
    }
  },
  
  /**
   * Anons çal
   */
  async _playAnnouncement(bell) {
    const volume = await Storage.getSetting('announcementVolume');
    const announcements = await Storage.getAnnouncements();
    
    if (!announcements || announcements.length === 0) {
      UI.showToast('⚠️ Anons listesi boş!', 'warning');
      return;
    }

    const index = parseInt(bell.sound);
    if (!isNaN(index) && announcements[index]) {
      AudioManager.playCeremony(announcements[index].path, volume, announcements[index].name);
      UI.showToast(`📢 Anons: ${announcements[index].name}`, 'info');
    } else {
      UI.showToast('⚠️ Seçilen anons bulunamadı!', 'warning');
    }
  },
  
  /**
   * Tören modunu aç/kapat
   */
  async setCeremonyMode(enabled) {
    this._ceremonyMode = enabled;
    await window.electronAPI.setCeremonyMode(enabled);
    return this._ceremonyMode;
  },
  
  /**
   * Tören modu aktif mi?
   */
  isCeremonyMode() {
    return this._ceremonyMode;
  },
  
  /**
   * Saygı duruşu başlat
   * @param {Function} onTick - Her saniye çağrılır (kalan saniye)
   * @param {Function} onComplete - Bittiğinde çağrılır
   */
  startSilence(onTick, onComplete) {
    this.stopSilence();
    
    let remaining = this._silenceDuration;
    
    if (onTick) onTick(remaining, this._silenceDuration);
    
    this._silenceTimer = setInterval(() => {
      remaining--;
      if (onTick) onTick(remaining, this._silenceDuration);
      
      if (remaining <= 0) {
        this.stopSilence();
        if (onComplete) onComplete();
      }
    }, 1000);
    
    this._silenceCallback = onComplete;
  },
  
  /**
   * Saygı duruşu durdur
   */
  stopSilence() {
    if (this._silenceTimer) {
      clearInterval(this._silenceTimer);
      this._silenceTimer = null;
    }
  },
  
  /**
   * Saygı duruşu süresi güncelle
   */
  setSilenceDuration(seconds) {
    this._silenceDuration = seconds;
  },
  
  /**
   * Zamanlamaları main process'e gönder
   */
  async syncSchedules() {
    await window.electronAPI.updateSchedules();
  },
  
  /**
   * Zaman formatla (00:00)
   */
  formatTime(hours, minutes) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  },
  
  /**
   * Saniyeyi MM:SS formatına çevir
   */
  formatSeconds(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
};
