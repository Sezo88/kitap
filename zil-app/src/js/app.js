/**
 * app.js - Ana Uygulama Kontrolcüsü
 * Tüm modülleri başlatır ve koordine eder
 */

const App = {
  // Zamanlayıcılar
  _clockInterval: null,
  _nextBellInterval: null,
  
  /**
   * Uygulama başlatma
   */
  async init() {
    console.log('🔔 Okul Zil Sistemi başlatılıyor...');
    
    // 1. UI elementlerini hazırla
    UI.init();
    
    // 2. Audio modülünü başlat
    AudioManager.init();
    AudioManager.onPlayStateChange = (isPlaying, channel, label) => {
      UI.updateNowPlaying(isPlaying, channel, label);
      
      // Tören sesleri bittiğinde tören modunu kapat
      if (!isPlaying && channel === 'ceremony' && !Scheduler.isCeremonyMode()) {
        // Sadece saygı duruşu değilse
      }
    };
    
    // 3. Verileri yükle
    await this._loadSettings();
    
    // 4. Zamanlama modülünü başlat
    await Scheduler.init();
    
    // 5. Bugünün programını göster
    await this._loadCurrentDaySchedule();
    
    // 6. Playlist ve Anonsları yükle
    await this._loadPlaylist();
    await this._loadAnnouncements();
    
    // 7. Olay dinleyicilerini bağla
    this._bindEvents();
    
    // 8. Saati başlat
    this._startClock();
    
    // 9. Sonraki zil bilgisini güncelle
    this._startNextBellUpdater();
    
    // 10. Main process olaylarını dinle
    this._listenMainProcessEvents();
    
    // 11. Gün seçiciyi bugüne ayarla
    this._setDaySelector();
    
    console.log('✅ Uygulama hazır!');
  },
  
  /**
   * Ayarları yükle
   */
  async _loadSettings() {
    // Zil ses seviyesi
    const bellVolume = await Storage.getSetting('bellVolume');
    UI.els.bellVolume.value = (bellVolume || 1) * 100;
    UI.els.bellVolumeValue.textContent = `${Math.round((bellVolume || 1) * 100)}%`;
    
    // Müzik ses seviyesi
    const musicVolume = await Storage.getSetting('musicVolume');
    UI.els.musicVolume.value = (musicVolume || 0.5) * 100;
    
    // Zil süresi
    const bellDuration = await Storage.getSetting('defaultBellDuration');
    UI.els.bellDuration.value = bellDuration || 5;
    
    // Saygı duruşu süresi
    const silenceDuration = await Storage.getSetting('silenceDuration');
    UI.els.silenceDurationInput.value = silenceDuration || 60;
    
    // Ziller aktif/pasif
    const bellsEnabled = await Storage.getSetting('bellsEnabled');
    UI.els.bellSwitch.checked = bellsEnabled !== false;
    
    // Otomatik başlatma
    const autoStart = await window.electronAPI.getAutoStart();
    UI.els.autoStartSwitch.checked = autoStart;
    
    // Ses atamalarını göster
    const anthemPath = await Storage.getSoundAssignment('anthem');
    if (anthemPath) {
      UI.updateSoundAssignmentDisplay('anthem', anthemPath.split(/[/\\]/).pop());
    }
    
    const sirenPath = await Storage.getSoundAssignment('siren');
    if (sirenPath) {
      UI.updateSoundAssignmentDisplay('siren', sirenPath.split(/[/\\]/).pop());
    }
    
    const silencePath = await Storage.getSoundAssignment('silence');
    if (silencePath) {
      UI.updateSoundAssignmentDisplay('silence', silencePath.split(/[/\\]/).pop());
    }
    
    const entryBell = await Storage.getSetting('entryBell');
    if (entryBell) {
      UI.updateSoundAssignmentDisplay('entryBell', entryBell.split(/[/\\]/).pop());
    }

    const exitBell = await Storage.getSetting('exitBell');
    if (exitBell) {
      UI.updateSoundAssignmentDisplay('exitBell', exitBell.split(/[/\\]/).pop());
    }

    const teacherBell = await Storage.getSetting('teacherBell');
    if (teacherBell) {
      UI.updateSoundAssignmentDisplay('teacherBell', teacherBell.split(/[/\\]/).pop());
    }

    const quickBell = await Storage.getSetting('quickBell');
    if (quickBell) {
      UI.updateSoundAssignmentDisplay('quickBell', quickBell.split(/[/\\]/).pop());
    }
    
    // Anons sesi
    const announcementVolume = await Storage.getSetting('announcementVolume');
    if (UI.els.announcementVolume) {
      UI.els.announcementVolume.value = (announcementVolume || 0.8) * 100;
    }

    // Supabase ayarlarını yükle
    const schoolCode = await Storage.get('settings.schoolCode');
    const inputSchool = document.getElementById('school-id');
    if (inputSchool && schoolCode) inputSchool.value = schoolCode;
  },
  
  /**
   * Bugünün gün seçicisini ayarla
   */
  _setDaySelector() {
    const today = Scheduler.getTodayKey();
    const options = UI.els.daySelector.options;
    for (let i = 0; i < options.length; i++) {
      if (options[i].value === today) {
        UI.els.daySelector.selectedIndex = i;
        break;
      }
    }
  },
  
  /**
   * Mevcut günün programını yükle
   */
  async _loadCurrentDaySchedule() {
    const day = UI.els.daySelector.value;
    const bells = await Storage.getSchedule(day);
    UI.renderScheduleTable(bells);
    await this._loadRecessSettings(bells);
  },
  
  /**
   * Teneffüs ayarlarını yükle ve render et
   */
  async _loadRecessSettings(bells) {
    const recesses = Scheduler.getDetectedRecesses(bells);
    const recessSettings = await Storage.getSetting('recessSettings') || {};
    const playlist = await Storage.getPlaylist();
    UI.renderRecessTable(recesses, recessSettings, playlist);
  },

  /**
   * Playlist yükle
   */
  async _loadPlaylist() {
    const playlist = await Storage.getPlaylist();
    UI.renderPlaylist(playlist);

    // Teneffüs ayarlarındaki müzik dropdown'larını güncelle
    const day = UI.els.daySelector.value;
    const bells = await Storage.getSchedule(day);
    await this._loadRecessSettings(bells);
  },

  /**
   * Anonsları yükle
   */
  async _loadAnnouncements() {
    const announcements = await Storage.getAnnouncements();
    UI.renderAnnouncements(announcements);
  },
  
  /**
   * Olay dinleyicileri
   */
  _bindEvents() {
    // ===== SEKMELER =====
    UI.els.tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabId = e.currentTarget.dataset.tab;
        UI.switchTab(tabId);
      });
    });
    // ===== PENCERE KONTROLLERİ =====
    UI.els.btnMinimize.addEventListener('click', () => {
      window.electronAPI.minimizeWindow();
    });
    
    UI.els.btnMaximize.addEventListener('click', () => {
      window.electronAPI.maximizeWindow();
    });
    
    UI.els.btnClose.addEventListener('click', () => {
      window.electronAPI.closeWindow();
    });
    
    // ===== ANA SWITCH =====
    UI.els.bellSwitch.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      await Storage.saveSetting('bellsEnabled', enabled);
      await window.electronAPI.storeSet('settings.bellsEnabled', enabled);
      
      if (enabled) {
        UI.showToast('🔔 Ziller açıldı', 'success');
      } else {
        UI.showToast('🔕 Ziller kapatıldı', 'warning');
      }
    });
    
    // ===== TÖREN BUTONLARI =====
    
    // İstiklal Marşı
    UI.els.btnIstiklal.addEventListener('click', async () => {
      const soundPath = await Storage.getSoundAssignment('anthem');
      if (!soundPath) {
        UI.showToast('⚠️ İstiklal Marşı ses dosyası atanmamış! Sol panelden dosya seçin.', 'warning');
        return;
      }
      
      // Tören modunu aç
      await Scheduler.setCeremonyMode(true);
      UI.updateCeremonyBadge(true);
      
      const bellVolume = await Storage.getSetting('bellVolume');
      AudioManager.playCeremony(soundPath, bellVolume, 'İstiklal Marşı');
      UI.els.btnIstiklal.classList.add('playing');
      
      // Bitmesini dinle
      AudioManager._ceremonyAudio.onended = async () => {
        UI.els.btnIstiklal.classList.remove('playing');
        await Scheduler.setCeremonyMode(false);
        UI.updateCeremonyBadge(false);
      };
    });
    
    // Siren
    UI.els.btnSiren.addEventListener('click', async () => {
      const soundPath = await Storage.getSoundAssignment('siren');
      if (!soundPath) {
        UI.showToast('⚠️ Siren ses dosyası atanmamış! Sol panelden dosya seçin.', 'warning');
        return;
      }
      
      await Scheduler.setCeremonyMode(true);
      UI.updateCeremonyBadge(true);
      
      const bellVolume = await Storage.getSetting('bellVolume');
      AudioManager.playCeremony(soundPath, bellVolume, 'Siren');
      UI.els.btnSiren.classList.add('playing');
      
      AudioManager._ceremonyAudio.onended = async () => {
        UI.els.btnSiren.classList.remove('playing');
        await Scheduler.setCeremonyMode(false);
        UI.updateCeremonyBadge(false);
      };
    });
    
    // Saygı Duruşu + İstiklal Marşı
    UI.els.btnSaygiDurusu.addEventListener('click', async () => {
      const anthemPath = await Storage.getSoundAssignment('anthem');
      if (!anthemPath) {
        UI.showToast('⚠️ İstiklal Marşı ses dosyası atanmamış!', 'warning');
        return;
      }
      
      // Tören modunu aç
      await Scheduler.setCeremonyMode(true);
      UI.updateCeremonyBadge(true);
      UI.els.btnSaygiDurusu.classList.add('playing');
      
      // Her şeyi durdur
      AudioManager.stopAll();
      
      const silencePath = await Storage.getSoundAssignment('silence');
      if (silencePath) {
        const bellVolume = await Storage.getSetting('bellVolume');
        AudioManager.playCeremony(silencePath, bellVolume, 'Saygı Duruşu (Ti)');
      }
      
      // Saygı duruşu sayacını başlat
      Scheduler.startSilence(
        // Her saniye
        (remaining, total) => {
          UI.showSilenceTimer(remaining, total);
        },
        // Bitmesinde İstiklal Marşı çal
        async () => {
          UI.hideSilenceTimer();
          
          const bellVolume = await Storage.getSetting('bellVolume');
          AudioManager.playCeremony(anthemPath, bellVolume, 'İstiklal Marşı');
          UI.els.btnIstiklal.classList.add('playing');
          
          AudioManager._ceremonyAudio.onended = async () => {
            UI.els.btnIstiklal.classList.remove('playing');
            UI.els.btnSaygiDurusu.classList.remove('playing');
            await Scheduler.setCeremonyMode(false);
            UI.updateCeremonyBadge(false);
          };
        }
      );
    });
    
    // Hızlı Zil
    if (UI.els.btnQuickBell) {
      UI.els.btnQuickBell.addEventListener('click', async () => {
        const soundPath = await Storage.getSetting('quickBell');
        if (!soundPath) {
          UI.showToast('⚠️ Hızlı zil sesi atanmamış! Ayarlar sekmesinden dosya seçin.', 'warning');
          return;
        }
        
        const bellVolume = await Storage.getSetting('bellVolume');
        AudioManager.playCeremony(soundPath, bellVolume, 'Hızlı Zil');
        UI.els.btnQuickBell.classList.add('playing');
        
        AudioManager._ceremonyAudio.onended = async () => {
          UI.els.btnQuickBell.classList.remove('playing');
        };
      });
    }

    // DURDUR
    UI.els.btnStopAll.addEventListener('click', async () => {
      AudioManager.stopAll();
      Scheduler.stopSilence();
      UI.hideSilenceTimer();
      
      await Scheduler.setCeremonyMode(false);
      UI.updateCeremonyBadge(false);
      
      // Tüm playing sınıflarını kaldır
      document.querySelectorAll('.ceremony-btn.playing').forEach(btn => {
        btn.classList.remove('playing');
      });
      
      UI.els.nowPlaying.classList.add('hidden');
      UI.showToast('⏹ Tüm sesler durduruldu', 'info');
    });
    
    // ===== SES ATAMALARI =====
    UI.els.btnAssignAnthem.addEventListener('click', async () => {
      const result = await window.electronAPI.selectSoundFile();
      if (result) {
        await Storage.saveSoundAssignment('anthem', result.path);
        UI.updateSoundAssignmentDisplay('anthem', result.name);
        UI.showToast('✅ İstiklal Marşı dosyası atandı', 'success');
      }
    });
    
    UI.els.btnAssignSiren.addEventListener('click', async () => {
      const result = await window.electronAPI.selectSoundFile();
      if (result) {
        await Storage.saveSoundAssignment('siren', result.path);
        UI.updateSoundAssignmentDisplay('siren', result.name);
        UI.showToast('✅ Siren dosyası atandı', 'success');
      }
    });

    UI.els.btnAssignSilenceSound.addEventListener('click', async () => {
      const result = await window.electronAPI.selectSoundFile();
      if (result) {
        await Storage.saveSoundAssignment('silence', result.path);
        UI.updateSoundAssignmentDisplay('silence', result.name);
        UI.showToast('✅ Saygı Duruşu sesi atandı', 'success');
      }
    });
    
    // ===== ZİL PROGRAMI =====
    
    // Gün değiştir
    UI.els.daySelector.addEventListener('change', async () => {
      await this._loadCurrentDaySchedule();
    });
    
    // Zil ekle
    UI.els.btnAddBell.addEventListener('click', () => {
      UI.openAddBellModal();
    });
    
    // Kopyala
    UI.els.btnCopySchedule.addEventListener('click', () => {
      UI.openCopyModal();
    });
    
    // ===== ZİL MODAL =====
    UI.els.modalClose.addEventListener('click', () => UI.closeBellModal());
    UI.els.modalCancel.addEventListener('click', () => UI.closeBellModal());
    UI.els.modalSave.addEventListener('click', () => UI.saveBellModal());
    
    // Modal ses seçme (Özel zil türü için)
    UI.els.modalSelectSound.addEventListener('click', async () => {
      const result = await window.electronAPI.selectSoundFile();
      if (result) {
        UI._modalSelectedSound = result.path;
        UI.els.modalSoundName.textContent = result.name;
      }
    });

    // Modal tür değiştiğinde
    UI.els.bellType.addEventListener('change', async (e) => {
      await UI.updateModalSoundUI(e.target.value);
    });
    
    // Modal dışına tıklama
    UI.els.bellModal.addEventListener('click', (e) => {
      if (e.target === UI.els.bellModal) {
        UI.closeBellModal();
      }
    });
    
    // ===== KOPYALAMA MODAL =====
    UI.els.copyModalClose.addEventListener('click', () => {
      UI.els.copyModal.classList.add('hidden');
    });
    UI.els.copyModalCancel.addEventListener('click', () => {
      UI.els.copyModal.classList.add('hidden');
    });
    UI.els.copyModalSave.addEventListener('click', () => UI.copySchedule());
    UI.els.copyModal.addEventListener('click', (e) => {
      if (e.target === UI.els.copyModal) {
        UI.els.copyModal.classList.add('hidden');
      }
    });
    
    // ===== MÜZİK =====
    UI.els.btnAddMusic.addEventListener('click', async () => {
      const result = await window.electronAPI.selectMultipleSoundFiles();
      if (result) {
        const playlist = await Storage.getPlaylist();
        const newPlaylist = [...playlist, ...result];
        await Storage.savePlaylist(newPlaylist);
        UI.renderPlaylist(newPlaylist);
        UI.showToast(`✅ ${result.length} müzik eklendi`, 'success');
      }
    });
    
    UI.els.btnPlayMusic.addEventListener('click', async () => {
      const playlist = await Storage.getPlaylist();
      if (playlist.length === 0) {
        UI.showToast('⚠️ Playlist boş! Önce müzik ekleyin.', 'warning');
        return;
      }
      
      const volume = UI.els.musicVolume.value / 100;
      AudioManager.playPlaylist(playlist, volume);
      UI.showToast('🎵 Müzik çalıyor', 'info');
    });
    
    UI.els.btnStopMusic.addEventListener('click', () => {
      AudioManager.stopMusic();
      UI.showToast('⏹ Müzik durduruldu', 'info');
    });
    
    if (UI.els.btnQuickStop) {
      UI.els.btnQuickStop.addEventListener('click', () => {
        AudioManager.stopMusic();
        UI.showToast('⏹ Müzik durduruldu', 'info');
      });
    }
    
    UI.els.musicVolume.addEventListener('input', (e) => {
      const volume = e.target.value / 100;
      AudioManager.setVolume('music', volume);
      Storage.saveSetting('musicVolume', volume);
    });
    
    // ===== ANONSLAR =====
    UI.els.btnAddAnnouncement.addEventListener('click', async () => {
      const result = await window.electronAPI.selectMultipleSoundFiles();
      if (result) {
        const list = await Storage.getAnnouncements();
        const newList = [...list, ...result];
        await Storage.saveAnnouncements(newList);
        UI.renderAnnouncements(newList);
        UI.showToast(`✅ ${result.length} anons eklendi`, 'success');
      }
    });

    if (UI.els.announcementVolume) {
      UI.els.announcementVolume.addEventListener('input', (e) => {
        const value = e.target.value;
        if (UI.els.announcementVolumeValue) {
          UI.els.announcementVolumeValue.textContent = `${value}%`;
        }
        const volume = value / 100;
        Storage.saveSetting('announcementVolume', volume);
      });
    }
    
    // ===== AYARLAR =====
    UI.els.bellVolume.addEventListener('input', (e) => {
      const value = e.target.value;
      UI.els.bellVolumeValue.textContent = `${value}%`;
      const volume = value / 100;
      AudioManager.setVolume('bell', volume);
      AudioManager.setVolume('ceremony', volume);
      Storage.saveSetting('bellVolume', volume);
    });
    
    UI.els.bellDuration.addEventListener('change', (e) => {
      const duration = parseInt(e.target.value) || 5;
      Storage.saveSetting('defaultBellDuration', duration);
    });
    
    UI.els.silenceDurationInput.addEventListener('change', (e) => {
      const duration = parseInt(e.target.value) || 60;
      Scheduler.setSilenceDuration(duration);
      Storage.saveSetting('silenceDuration', duration);
    });
    
    UI.els.btnSelectEntryBell.addEventListener('click', async () => {
      const result = await window.electronAPI.selectSoundFile();
      if (result) {
        await Storage.saveSetting('entryBell', result.path);
        UI.updateSoundAssignmentDisplay('entryBell', result.name);
        UI.showToast('✅ Giriş zili sesi ayarlandı', 'success');
      }
    });

    UI.els.btnSelectExitBell.addEventListener('click', async () => {
      const result = await window.electronAPI.selectSoundFile();
      if (result) {
        await Storage.saveSetting('exitBell', result.path);
        UI.updateSoundAssignmentDisplay('exitBell', result.name);
        UI.showToast('✅ Çıkış zili sesi ayarlandı', 'success');
      }
    });

    if (UI.els.btnSelectTeacherBell) {
      UI.els.btnSelectTeacherBell.addEventListener('click', async () => {
        const result = await window.electronAPI.selectSoundFile();
        if (result) {
          await Storage.saveSetting('teacherBell', result.path);
          UI.updateSoundAssignmentDisplay('teacherBell', result.name);
          UI.showToast('✅ Öğretmen zili sesi ayarlandı', 'success');
        }
      });
    }

    if (UI.els.btnSelectQuickBell) {
      UI.els.btnSelectQuickBell.addEventListener('click', async () => {
        const result = await window.electronAPI.selectSoundFile();
        if (result) {
          await Storage.saveSetting('quickBell', result.path);
          UI.updateSoundAssignmentDisplay('quickBell', result.name);
          UI.showToast('✅ Hızlı zil sesi ayarlandı', 'success');
        }
      });
    }

    // Yedekleme
    UI.els.btnExportData.addEventListener('click', async () => {
      const success = await Storage.exportData();
      if (success) {
        UI.showToast('✅ Yedekleme başarılı', 'success');
      }
    });

    UI.els.btnImportData.addEventListener('click', async () => {
      const success = await Storage.importData();
      if (success) {
        UI.showToast('✅ Yedek geri yüklendi. Uygulama güncelleniyor...', 'success');
        // Arayüzü güncelle
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    });
    
    UI.els.autoStartSwitch.addEventListener('change', async (e) => {
      await window.electronAPI.setAutoStart(e.target.checked);
      if (e.target.checked) {
        UI.showToast('✅ Bilgisayar açılışında başlatılacak', 'success');
      } else {
        UI.showToast('ℹ️ Otomatik başlatma kapatıldı', 'info');
      }
    });

    // ===== SUPABASE AYARLARI KAYDET =====
    const btnSaveSupabase = document.getElementById('btn-save-supabase');
    if (btnSaveSupabase) {
      btnSaveSupabase.addEventListener('click', async () => {
        const schoolCode = document.getElementById('school-id')?.value?.trim() || '';
        const pin = document.getElementById('school-pin')?.value?.trim() || '';
        
        if (!schoolCode) {
          UI.showToast('⚠️ Lütfen okul kodunu girin.', 'warning');
          return;
        }
        
        UI.showToast('⏳ Okul kodu ve PIN doğrulanıyor ve bağlanılıyor...', 'info');
        
        const res = await window.electronAPI.reconnectSupabase(schoolCode, pin);
        if (res.success) {
          UI.showToast(`✅ ${res.schoolName} okuluna başarıyla bağlanıldı!`, 'success');
        } else {
          UI.showToast(`❌ Hata: ${res.error}`, 'error');
        }
      });
    }

    // ===== GÜNCELLEME DİNLENİCİLERİ =====
    if (window.electronAPI?.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable((info) => {
        UI.showToast(`🚀 Yeni sürüm mevcut (v${info.version})! Lütfen güncelleyin.`, 'info');
      });
    }

    if (window.electronAPI?.onRendererPatchAvailable) {
      window.electronAPI.onRendererPatchAvailable((info) => {
        UI.showToast(`✨ Arayüz yaması (v${info.version}) yüklendi. Bir sonraki açılışta aktif olacaktır.`, 'success');
      });
    }
    
    // ===== KLAVYE KISAYOLLARI =====
    document.addEventListener('keydown', (e) => {
      // ESC - Modal kapat veya her şeyi durdur
      if (e.key === 'Escape') {
        if (!UI.els.bellModal.classList.contains('hidden')) {
          UI.closeBellModal();
        } else if (!UI.els.copyModal.classList.contains('hidden')) {
          UI.els.copyModal.classList.add('hidden');
        } else {
          // Her şeyi durdur
          UI.els.btnStopAll.click();
        }
      }
      
      // F5 - Yenile engelle
      if (e.key === 'F5') {
        e.preventDefault();
      }
    });
  },
  
  /**
   * Saati başlat
   */
  _startClock() {
    UI.updateClock();
    this._clockInterval = setInterval(() => {
      UI.updateClock();
    }, 1000);
  },
  
  /**
   * Sonraki zil güncelleyiciyi başlat
   */
  _startNextBellUpdater() {
    UI.updateNextBell();
    this._nextBellInterval = setInterval(() => {
      UI.updateNextBell();
    }, 15000); // Her 15 saniyede güncelle
  },
  
  /**
   * Main process olaylarını dinle
   */
  _listenMainProcessEvents() {
    // Ziller açma/kapama (tray'den)
    window.electronAPI.onBellsEnabledChanged((enabled) => {
      UI.els.bellSwitch.checked = enabled;
      if (enabled) {
        UI.showToast('🔔 Ziller açıldı (tray\'den)', 'success');
      } else {
        UI.showToast('🔕 Ziller kapatıldı (tray\'den)', 'warning');
      }
    });
    
    // Zamanlanmış zil olayı
    window.electronAPI.onBellEvent((data) => {
      if (data.type === 'ring') {
        console.log('Zil olayı:', data.bell);
        // Sonraki zil bilgisini güncelle
        setTimeout(() => {
          Scheduler.loadTodaySchedule().then(() => {
            UI.updateNextBell();
          });
        }, 2000);
      }
    });
    
    // Uzaktan Supabase tetiklemesi
    if (window.electronAPI.onRemoteCommand) {
      window.electronAPI.onRemoteCommand(async (cmd) => {
        console.log('Uzaktan komut alındı:', cmd);
        if (cmd.command_type === 'play_bell') {
          const soundPath = await Storage.getSetting('quickBell');
          const volume = await Storage.getSetting('bellVolume');
          const duration = await Storage.getSetting('defaultBellDuration');
          AudioManager.playBell(soundPath, volume || 1.0, duration || 5);
          UI.showToast('🔔 Uzaktan zil tetiklendi', 'success');
        } else if (cmd.command_type === 'play_anthem') {
          const soundPath = await Storage.getSoundAssignment('anthem');
          const volume = await Storage.getSetting('bellVolume');
          AudioManager.playCeremony(soundPath, volume || 1.0, 'İstiklal Marşı');
          UI.showToast('🇹🇷 Uzaktan İstiklal Marşı tetiklendi', 'success');
        } else if (cmd.command_type === 'custom_announcement') {
          const soundPath = await Storage.getSoundAssignment('siren');
          const volume = await Storage.getSetting('bellVolume');
          AudioManager.playCeremony(soundPath, volume || 1.0, 'Siren');
          UI.showToast('📢 Uzaktan siren tetiklendi', 'info');
        } else if (cmd.command_type === 'stop_sound') {
          AudioManager.stopAll();
          UI.showToast('🛑 Uzaktan tüm sesler durduruldu', 'warning');
        } else if (cmd.command_type === 'play_ceremony') {
          const silencePath = await Storage.getSoundAssignment('silence');
          const anthemPath = await Storage.getSoundAssignment('anthem');
          const volume = await Storage.getSetting('bellVolume');
          
          UI.showToast('🇹🇷 Saygı Duruşu başladı...', 'info');
          AudioManager.playCeremony(silencePath, volume || 1.0, 'Saygı Duruşu');
          
          // Saygı Duruşu bittiğinde İstiklal Marşı'na otomatik geç
          const audioEl = AudioManager._ceremonyAudio;
          const playAnthemOnEnd = async () => {
            audioEl.removeEventListener('ended', playAnthemOnEnd);
            // Sadece başka bir ses kanalı veya kullanıcı tarafından durdurulmadıysa devam et
            if (!AudioManager._isPlaying && AudioManager._currentChannel === null) {
              UI.showToast('🇹🇷 İstiklal Marşı çalınıyor...', 'success');
              AudioManager.playCeremony(anthemPath, volume || 1.0, 'İstiklal Marşı');
            }
          };
          audioEl.addEventListener('ended', playAnthemOnEnd);
        } else if (cmd.command_type === 'mute_bell') {
          await Storage.saveSetting('bellsEnabled', false);
          await window.electronAPI.storeSet('settings.bellsEnabled', false);
          UI.els.bellSwitch.checked = false;
          UI.showToast('🔕 Ziller uzaktan kapatıldı', 'warning');
        } else if (cmd.command_type === 'unmute_bell') {
          await Storage.saveSetting('bellsEnabled', true);
          await window.electronAPI.storeSet('settings.bellsEnabled', true);
          UI.els.bellSwitch.checked = true;
          UI.showToast('🔔 Ziller uzaktan açıldı', 'success');
        }
      });
    }
  }
};

// ========== UYGULAMA BAŞLAT ==========
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
