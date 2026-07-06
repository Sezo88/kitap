/**
 * ui.js - UI Etkileşimleri
 * DOM manipülasyonu, modal yönetimi, bildirim sistemi, tablo render
 */

const UI = {
  // Element referansları
  els: {},
  
  // Modal durumu
  _editingBellIndex: null,
  _modalSelectedSound: null,
  
  /**
   * Başlatma - element referanslarını al
   */
  init() {
    this.els = {
      // Saat
      clock: document.getElementById('digital-clock'),
      dateDisplay: document.getElementById('date-display'),
      
      // Sonraki zil
      nextBellTime: document.getElementById('next-bell-time'),
      nextBellName: document.getElementById('next-bell-name'),
      nextBellCountdown: document.getElementById('next-bell-countdown'),
      
      // Ana switch
      bellSwitch: document.getElementById('bell-switch'),
      
      // Tören
      btnIstiklal: document.getElementById('btn-istiklal'),
      btnSiren: document.getElementById('btn-siren'),
      btnSaygiDurusu: document.getElementById('btn-saygi-dursu'),
      btnQuickBell: document.getElementById('btn-quick-bell'),
      btnStopAll: document.getElementById('btn-stop-all'),
      ceremonyBadge: document.getElementById('ceremony-mode-badge'),
      silenceTimer: document.getElementById('silence-timer'),
      silenceCountdown: document.getElementById('silence-countdown'),
      silenceProgress: document.getElementById('silence-progress'),
      nowPlaying: document.getElementById('now-playing'),
      nowPlayingText: document.getElementById('now-playing-text'),
      
      // Ses atamaları
      btnAssignAnthem: document.getElementById('btn-assign-anthem'),
      anthemFileName: document.getElementById('anthem-file-name'),
      btnAssignSiren: document.getElementById('btn-assign-siren'),
      sirenFileName: document.getElementById('siren-file-name'),
      btnAssignSilenceSound: document.getElementById('btn-assign-silence-sound'),
      silenceSoundFileName: document.getElementById('silence-sound-file-name'),
      
      // Zil programı
      daySelector: document.getElementById('day-selector'),
      btnAddBell: document.getElementById('btn-add-bell'),
      btnCopySchedule: document.getElementById('btn-copy-schedule'),
      scheduleTbody: document.getElementById('schedule-tbody'),
      emptySchedule: document.getElementById('empty-schedule'),
      
      // Sekmeler
      tabBtns: document.querySelectorAll('.tab-btn'),
      tabPanes: document.querySelectorAll('.tab-pane'),

      // Müzik
      btnAddMusic: document.getElementById('btn-add-music'),
      playlist: document.getElementById('playlist'),
      playlistEmpty: document.getElementById('playlist-empty'),
      btnPlayMusic: document.getElementById('btn-play-music'),
      btnStopMusic: document.getElementById('btn-stop-music'),
      musicVolume: document.getElementById('music-volume'),

      // Hızlı Çalar
      quickPlaylist: document.getElementById('quick-playlist'),
      quickPlaylistEmpty: document.getElementById('quick-playlist-empty'),
      btnQuickStop: document.getElementById('btn-quick-stop'),
      
      // Anonslar
      btnAddAnnouncement: document.getElementById('btn-add-announcement'),
      announcementList: document.getElementById('announcement-list'),
      announcementEmpty: document.getElementById('announcement-empty'),

      // Ayarlar
      bellVolume: document.getElementById('bell-volume'),
      bellVolumeValue: document.getElementById('bell-volume-value'),
      announcementVolume: document.getElementById('announcement-volume'),
      announcementVolumeValue: document.getElementById('announcement-volume-value'),
      bellDuration: document.getElementById('bell-duration'),
      silenceDurationInput: document.getElementById('silence-duration'),
      autoStartSwitch: document.getElementById('auto-start-switch'),
      
      // Global Sesler
      btnSelectEntryBell: document.getElementById('btn-select-entry-bell'),
      btnSelectExitBell: document.getElementById('btn-select-exit-bell'),
      btnSelectTeacherBell: document.getElementById('btn-select-teacher-bell'),
      btnSelectQuickBell: document.getElementById('btn-select-quick-bell'),
      entryBellName: document.getElementById('entry-bell-name'),
      exitBellName: document.getElementById('exit-bell-name'),
      teacherBellName: document.getElementById('teacher-bell-name'),
      quickBellName: document.getElementById('quick-bell-name'),

      // Yedekleme
      btnExportData: document.getElementById('btn-export-data'),
      btnImportData: document.getElementById('btn-import-data'),

      // Modal - Zil
      bellModal: document.getElementById('bell-modal'),
      modalTitle: document.getElementById('modal-title'),
      modalClose: document.getElementById('modal-close'),
      modalCancel: document.getElementById('modal-cancel'),
      modalSave: document.getElementById('modal-save'),
      bellTime: document.getElementById('bell-time'),
      bellType: document.getElementById('bell-type'),
      bellLabel: document.getElementById('bell-label'),
      modalSelectSound: document.getElementById('modal-select-sound'),
      modalSoundName: document.getElementById('modal-sound-name'),
      modalSoundDropdown: document.getElementById('modal-sound-dropdown'),
      modalGlobalSoundText: document.getElementById('modal-global-sound-text'),
      
      // Modal - Kopyala
      copyModal: document.getElementById('copy-modal'),
      copyModalClose: document.getElementById('copy-modal-close'),
      copyModalCancel: document.getElementById('copy-modal-cancel'),
      copyModalSave: document.getElementById('copy-modal-save'),
      
      // Toast
      toastContainer: document.getElementById('toast-container'),
      
      // Pencere kontrolleri
      btnMinimize: document.getElementById('btn-minimize'),
      btnMaximize: document.getElementById('btn-maximize'),
      btnClose: document.getElementById('btn-close'),
    };
  },
  
  /**
   * Dijital saati güncelle
   */
  updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    this.els.clock.textContent = `${h}:${m}:${s}`;
    
    // Tarih
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                     'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    this.els.dateDisplay.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  },
  
  /**
   * Sonraki zil bilgisini güncelle
   */
  updateNextBell() {
    const nextBell = Scheduler.getNextBell();
    

    if (nextBell) {
      this.els.nextBellTime.textContent = nextBell.time;
      this.els.nextBellName.textContent = nextBell.label || 'Zil';
      this.els.nextBellCountdown.textContent = Scheduler.getCountdownText(nextBell.minutesUntil);
    } else {
      this.els.nextBellTime.textContent = '--:--';
      this.els.nextBellName.textContent = 'Bugün kalan zil yok';
      this.els.nextBellCountdown.textContent = '';
    }
  },
  
  /**
   * Zil programı tablosunu render et
   */
  renderScheduleTable(bells) {
    const tbody = this.els.scheduleTbody;
    tbody.innerHTML = '';
    
    if (!bells || bells.length === 0) {
      this.els.emptySchedule.classList.remove('hidden');
      return;
    }
    
    this.els.emptySchedule.classList.add('hidden');
    
    // Saate göre sırala
    const sorted = [...bells].sort((a, b) => {
      const [ah, am] = a.time.split(':').map(Number);
      const [bh, bm] = b.time.split(':').map(Number);
      return (ah * 60 + am) - (bh * 60 + bm);
    });
    
    sorted.forEach((bell, index) => {
      // Orijinal index'i bul
      const origIndex = bells.indexOf(bell);
      
      const tr = document.createElement('tr');
      
      const typeLabel = Scheduler.bellTypeLabels[bell.type] || bell.type;
      const typeClass = `bell-type-${bell.type}`;
      const soundName = bell.sound ? bell.sound.split(/[/\\]/).pop() : 'Varsayılan';
      
      tr.innerHTML = `
        <td class="td-time">${bell.time}</td>
        <td><span class="bell-type-badge ${typeClass}">${typeLabel}</span></td>
        <td>${bell.label || ''}</td>
        <td><span class="td-sound-name" title="${soundName}">${soundName}</span></td>
        <td style="text-align:center">
          <label class="toggle-switch" style="width:40px;height:22px">
            <input type="checkbox" class="bell-enabled-cb" data-index="${origIndex}" ${bell.enabled !== false ? 'checked' : ''}>
            <span class="toggle-slider" style="border-radius:11px"></span>
          </label>
        </td>
        <td class="td-actions">
          <button class="btn-icon btn-edit" data-index="${origIndex}" title="Düzenle">✏️</button>
          <button class="btn-icon btn-delete" data-index="${origIndex}" title="Sil">🗑️</button>
        </td>
      `;
      
      // Toggle-slider küçük boyut ayarı
      const slider = tr.querySelector('.toggle-slider');
      if (slider) {
        slider.style.setProperty('--toggle-size', '16px');
      }
      const toggleSliderBefore = tr.querySelector('.toggle-switch');
      if (toggleSliderBefore) {
        const style = document.createElement('style');
        style.textContent = `
          .toggle-switch[style*="width:40px"] .toggle-slider::before {
            height: 16px; width: 16px; left: 3px; bottom: 3px;
          }
          .toggle-switch[style*="width:40px"] input:checked + .toggle-slider::before {
            transform: translateX(18px);
          }
        `;
        if (!document.getElementById('mini-toggle-style')) {
          style.id = 'mini-toggle-style';
          document.head.appendChild(style);
        }
      }
      
      tbody.appendChild(tr);
    });
    
    // Olay dinleyicileri
    tbody.querySelectorAll('.bell-enabled-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        this._onBellToggle(idx, e.target.checked);
      });
    });
    
    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        this._onBellEdit(idx);
      });
    });
    
    tbody.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        this._onBellDelete(idx);
      });
    });
  },
  
  /**
   * Zil aktif/pasif toggle
   */
  async _onBellToggle(index, enabled) {
    const day = this.els.daySelector.value;
    const bells = await Storage.getSchedule(day);
    if (bells[index]) {
      bells[index].enabled = enabled;
      await Storage.saveSchedule(day, bells);
      await Scheduler.syncSchedules();
      
      // Bugünün programını güncelle
      if (day === Scheduler.getTodayKey()) {
        await Scheduler.loadTodaySchedule();
      }

      if (typeof App !== 'undefined' && typeof App._loadRecessSettings === 'function') {
        await App._loadRecessSettings(bells);
      }
    }
  },
  
  /**
   * Zil düzenle
   */
  async _onBellEdit(index) {
    const day = this.els.daySelector.value;
    const bells = await Storage.getSchedule(day);
    const bell = bells[index];
    
    if (!bell) return;
    
    this._editingBellIndex = index;
    this._modalSelectedSound = bell.sound || null;
    
    this.els.modalTitle.textContent = 'Zili Düzenle';
    this.els.bellTime.value = bell.time;
    this.els.bellType.value = bell.type;
    this.els.bellLabel.value = bell.label || '';
    
    if (bell.type === 'custom' && bell.sound) {
      this.els.modalSoundName.textContent = bell.sound.split(/[/\\]/).pop();
    } else {
      this.els.modalSoundName.textContent = 'Dosya seç...';
    }
    
    await this.updateModalSoundUI(bell.type, bell.sound);
    this.els.bellModal.classList.remove('hidden');
  },
  
  /**
   * Zil sil
   */
  async _onBellDelete(index) {
    const day = this.els.daySelector.value;
    const bells = await Storage.getSchedule(day);
    bells.splice(index, 1);
    await Storage.saveSchedule(day, bells);
    await Scheduler.syncSchedules();
    
    this.renderScheduleTable(bells);
    this.showToast('🗑️ Zil silindi', 'info');
    
    if (day === Scheduler.getTodayKey()) {
      await Scheduler.loadTodaySchedule();
    }

    if (typeof App !== 'undefined' && typeof App._loadRecessSettings === 'function') {
      await App._loadRecessSettings(bells);
    }
  },
  
  /**
   * Zil ekleme modalını aç
   */
  openAddBellModal() {
    this._editingBellIndex = null;
    this._modalSelectedSound = null;
    
    this.els.modalTitle.textContent = 'Yeni Zil Ekle';
    this.els.bellTime.value = '';
    this.els.bellType.value = 'entry';
    this.els.bellLabel.value = '';
    this.els.modalSoundName.textContent = 'Dosya seç...';
    
    this.updateModalSoundUI('entry');
    this.els.bellModal.classList.remove('hidden');
  },
  
  /**
   * Zil modalını kaydet
   */
  async saveBellModal() {
    const time = this.els.bellTime.value;
    if (!time) {
      this.showToast('⚠️ Saat girilmedi!', 'warning');
      return;
    }
    
    const type = this.els.bellType.value;
    let finalSound = null;
    
    if (type === 'break_music' || type === 'announcement') {
      finalSound = this.els.modalSoundDropdown.value;
    } else if (type === 'custom') {
      finalSound = this._modalSelectedSound;
    }
    // entry ve exit için finalSound null kalır, global ayardan çekilir.

    const bell = {
      time: time,
      type: type,
      label: this.els.bellLabel.value || this._autoLabel(type, time),
      sound: finalSound,
      enabled: true
    };
    
    const day = this.els.daySelector.value;
    const bells = await Storage.getSchedule(day);
    
    if (this._editingBellIndex !== null) {
      bells[this._editingBellIndex] = bell;
      this.showToast('✅ Zil güncellendi', 'success');
    } else {
      bells.push(bell);
      this.showToast('✅ Zil eklendi', 'success');
    }
    
    await Storage.saveSchedule(day, bells);
    await Scheduler.syncSchedules();
    
    this.renderScheduleTable(bells);
    this.closeBellModal();
    
    if (day === Scheduler.getTodayKey()) {
      await Scheduler.loadTodaySchedule();
    }

    if (typeof App !== 'undefined' && typeof App._loadRecessSettings === 'function') {
      await App._loadRecessSettings(bells);
    }
  },
  
  /**
   * Otomatik etiket oluştur
   */
  _autoLabel(type, time) {
    const labels = {
      entry: 'Giriş Zili',
      exit: 'Çıkış Zili',
      teacher: 'Öğretmen Zili',
      break_music: 'Teneffüs Müzik',
      announcement: 'Anons',
      custom: 'Özel Zil'
    };
    return `${time} ${labels[type] || 'Zil'}`;
  },
  
  /**
   * Zil modalını kapat
   */
  closeBellModal() {
    this.els.bellModal.classList.add('hidden');
    this._editingBellIndex = null;
    this._modalSelectedSound = null;
  },
  
  /**
   * Kopyalama modalını aç
   */
  openCopyModal() {
    const currentDay = this.els.daySelector.value;
    
    // Mevcut günün checkbox'ını gizle
    this.els.copyModal.querySelectorAll('.copy-day-cb').forEach(cb => {
      cb.checked = false;
      const label = cb.closest('.checkbox-label');
      if (cb.value === currentDay) {
        label.style.display = 'none';
      } else {
        label.style.display = '';
      }
    });
    
    this.els.copyModal.classList.remove('hidden');
  },
  
  /**
   * Programı kopyala
   */
  async copySchedule() {
    const sourceDay = this.els.daySelector.value;
    const sourceBells = await Storage.getSchedule(sourceDay);
    
    const selectedDays = [];
    this.els.copyModal.querySelectorAll('.copy-day-cb:checked').forEach(cb => {
      selectedDays.push(cb.value);
    });
    
    if (selectedDays.length === 0) {
      this.showToast('⚠️ En az bir gün seçin', 'warning');
      return;
    }
    
    for (const day of selectedDays) {
      await Storage.saveSchedule(day, JSON.parse(JSON.stringify(sourceBells)));
    }
    
    await Scheduler.syncSchedules();
    this.els.copyModal.classList.add('hidden');
    this.showToast(`✅ Program ${selectedDays.length} güne kopyalandı`, 'success');

    if (typeof App !== 'undefined' && typeof App._loadRecessSettings === 'function') {
      await App._loadRecessSettings(sourceBells);
    }
  },
  
  /**
   * Playlist render
   */
  renderPlaylist(playlist) {
    const ul = this.els.playlist;
    const empty = this.els.playlistEmpty;
    
    if (!playlist || playlist.length === 0) {
      ul.classList.add('hidden');
      empty.classList.remove('hidden');
      if(this.els.quickPlaylist) this.els.quickPlaylist.classList.add('hidden');
      if(this.els.quickPlaylistEmpty) this.els.quickPlaylistEmpty.classList.remove('hidden');
      return;
    }
    
    empty.classList.add('hidden');
    ul.classList.remove('hidden');
    ul.innerHTML = '';
    
    if(this.els.quickPlaylist) {
      this.els.quickPlaylistEmpty.classList.add('hidden');
      this.els.quickPlaylist.classList.remove('hidden');
      this.els.quickPlaylist.innerHTML = '';
    }
    
    playlist.forEach((item, index) => {
      // Ana Müzikler sekmesindeki liste öğesi
      const li = document.createElement('li');
      li.className = 'playlist-item';
      li.innerHTML = `
        <span class="playlist-item-name" title="${item.name}">🎵 ${item.name}</span>
        <button class="playlist-item-remove" data-index="${index}" title="Kaldır">✕</button>
      `;
      ul.appendChild(li);

      // Hızlı Çalar panelindeki liste öğesi
      if(this.els.quickPlaylist) {
        const qLi = document.createElement('li');
        qLi.className = 'playlist-item quick-play-item';
        qLi.style.cursor = 'pointer';
        qLi.style.padding = '8px 12px';
        qLi.style.marginBottom = '4px';
        qLi.innerHTML = `
          <span class="playlist-item-name" title="${item.name}" style="flex:1;">🎵 ${item.name}</span>
          <span style="font-size: 11px; font-weight: 600; color: var(--accent-green);">▶ Çal</span>
        `;
        qLi.addEventListener('click', async () => {
           const volumeStr = await Storage.getSetting('musicVolume');
           const volume = volumeStr !== undefined ? volumeStr : 0.5;
           AudioManager.playMusic(item.path, volume, item.name);
           this.showToast('🎵 Müzik çalıyor: ' + item.name, 'info');
        });
        
        // Hover efektleri
        qLi.addEventListener('mouseenter', () => qLi.style.background = 'rgba(255,255,255,0.05)');
        qLi.addEventListener('mouseleave', () => qLi.style.background = 'transparent');
        
        this.els.quickPlaylist.appendChild(qLi);
      }
    });
    
    ul.querySelectorAll('.playlist-item-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const pl = await Storage.getPlaylist();
        const itemToRemove = pl[idx];
        
        // Listeden sil
        pl.splice(idx, 1);
        await Storage.savePlaylist(pl);
        
        // Dosyayı sil
        if (itemToRemove && itemToRemove.path) {
          await window.electronAPI.deleteSoundFile(itemToRemove.path);
        }

        this.renderPlaylist(pl);
        this.showToast('🗑️ Müzik kaldırıldı ve dosyası silindi', 'info');
      });
    });
  },
  
  /**
   * Şu an çalıyor göstergesini güncelle
   */
  updateNowPlaying(isPlaying, channel, label) {
    if (isPlaying && channel !== 'music') {
      this.els.nowPlaying.classList.remove('hidden');
      this.els.nowPlayingText.textContent = label || 'Çalıyor...';
    } else if (!AudioManager.isPlaying('ceremony') && !AudioManager.isPlaying('bell')) {
      this.els.nowPlaying.classList.add('hidden');
    }
  },
  
  /**
   * Saygı duruşu UI güncelle
   */
  showSilenceTimer(remaining, total) {
    this.els.silenceTimer.classList.remove('hidden');
    this.els.silenceCountdown.textContent = Scheduler.formatSeconds(remaining);
    
    const progress = (remaining / total) * 100;
    this.els.silenceProgress.style.width = `${progress}%`;
  },
  
  hideSilenceTimer() {
    this.els.silenceTimer.classList.add('hidden');
  },
  
  /**
   * Tören modu badge
   */
  updateCeremonyBadge(active) {
    if (active) {
      this.els.ceremonyBadge.classList.remove('hidden');
    } else {
      this.els.ceremonyBadge.classList.add('hidden');
    }
  },
  
  /**
   * Toast bildirim göster
   */
  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    this.els.toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  
  /**
   * Ses ataması dosya adını güncelle
   */
  updateSoundAssignmentDisplay(type, fileName) {
    switch (type) {
      case 'anthem':
        this.els.anthemFileName.textContent = fileName || 'Dosya seç...';
        break;
      case 'siren':
        this.els.sirenFileName.textContent = fileName || 'Dosya seç...';
        break;
      case 'silence':
        if(this.els.silenceSoundFileName) {
          this.els.silenceSoundFileName.textContent = fileName || 'Dosya seç...';
        }
        break;
      case 'entryBell':
        this.els.entryBellName.textContent = fileName || 'Dosya seç...';
        break;
      case 'exitBell':
        this.els.exitBellName.textContent = fileName || 'Dosya seç...';
        break;
      case 'teacherBell':
        this.els.teacherBellName.textContent = fileName || 'Dosya seç...';
        break;
      case 'quickBell':
        if(this.els.quickBellName) {
          this.els.quickBellName.textContent = fileName || 'Dosya seç...';
        }
        break;
    }
  },

  /**
   * Sekme değiştir
   */
  switchTab(tabId) {
    this.els.tabBtns.forEach(btn => {
      if (btn.dataset.tab === tabId) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    
    this.els.tabPanes.forEach(pane => {
      if (pane.id === tabId) pane.classList.add('active');
      else pane.classList.remove('active');
    });
  },

  /**
   * Anons listesini render et
   */
  renderAnnouncements(announcements) {
    const ul = this.els.announcementList;
    const empty = this.els.announcementEmpty;
    
    if (!announcements || announcements.length === 0) {
      ul.classList.add('hidden');
      empty.classList.remove('hidden');
      return;
    }
    
    empty.classList.add('hidden');
    ul.classList.remove('hidden');
    ul.innerHTML = '';
    
    announcements.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'playlist-item';
      li.innerHTML = `
        <span class="playlist-item-name" title="${item.name}">📢 ${item.name}</span>
        <button class="announcement-item-remove" data-index="${index}" title="Kaldır">✕</button>
      `;
      ul.appendChild(li);
    });
    
    ul.querySelectorAll('.announcement-item-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const list = await Storage.getAnnouncements();
        const itemToRemove = list[idx];
        
        list.splice(idx, 1);
        await Storage.saveAnnouncements(list);
        
        // Dosyayı sil
        if (itemToRemove && itemToRemove.path) {
          await window.electronAPI.deleteSoundFile(itemToRemove.path);
        }

        this.renderAnnouncements(list);
        this.showToast('🗑️ Anons kaldırıldı ve dosyası silindi', 'info');
      });
    });
  },

  /**
   * Modal ses seçici arayüzünü tipe göre güncelle
   */
  async updateModalSoundUI(type, currentSound = null) {
    this.els.modalGlobalSoundText.classList.add('hidden');
    this.els.modalSelectSound.classList.add('hidden');
    this.els.modalSoundDropdown.classList.add('hidden');

    if (type === 'entry' || type === 'exit' || type === 'teacher') {
      this.els.modalGlobalSoundText.classList.remove('hidden');
    } else if (type === 'custom') {
      this.els.modalSelectSound.classList.remove('hidden');
    } else if (type === 'break_music') {
      const playlist = await Storage.getPlaylist();
      this.els.modalSoundDropdown.innerHTML = '<option value="random">🎵 Rastgele Müzik Çal</option>';
      if (playlist && playlist.length > 0) {
        playlist.forEach((item, idx) => {
          this.els.modalSoundDropdown.innerHTML += `<option value="${idx}">Müzik: ${item.name}</option>`;
        });
      }
      this.els.modalSoundDropdown.value = currentSound || 'random';
      this.els.modalSoundDropdown.classList.remove('hidden');
    } else if (type === 'announcement') {
      const announcements = await Storage.getAnnouncements();
      this.els.modalSoundDropdown.innerHTML = '';
      if (announcements && announcements.length > 0) {
        announcements.forEach((item, idx) => {
          this.els.modalSoundDropdown.innerHTML += `<option value="${idx}">📢 ${item.name}</option>`;
        });
        if (currentSound !== null && currentSound !== undefined) {
          this.els.modalSoundDropdown.value = currentSound;
        }
      } else {
        this.els.modalSoundDropdown.innerHTML = '<option value="">(Anons listesi boş)</option>';
      }
      this.els.modalSoundDropdown.classList.remove('hidden');
    }
  },

  /**
   * Teneffüs Ayarları tablosunu render et
   */
  async renderRecessTable(recesses, recessSettings, playlist) {
    const tbody = document.getElementById('recess-tbody');
    const empty = document.getElementById('empty-recess');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!recesses || recesses.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    
    empty.classList.add('hidden');
    
    recesses.forEach((recess) => {
      const config = recessSettings[recess.startTime] || {
        enabled: false,
        sound: 'random',
        durationLimit: 'infinite'
      };
      
      const tr = document.createElement('tr');
      
      // Müzik seçimi dropdown options
      let soundOptions = `<option value="random" ${config.sound === 'random' ? 'selected' : ''}>🎵 Rastgele Müzik</option>`;
      if (playlist && playlist.length > 0) {
        playlist.forEach((item, idx) => {
          soundOptions += `<option value="${idx}" ${String(config.sound) === String(idx) ? 'selected' : ''}>${item.name}</option>`;
        });
      }
      
      // Süre sınır seçenekleri
      const durationOptions = `
        <option value="infinite" ${config.durationLimit === 'infinite' ? 'selected' : ''}>Süre Sınırı Yok (Zil Çalana Kadar)</option>
        <option value="60" ${config.durationLimit === '60' ? 'selected' : ''}>1 Dakika</option>
        <option value="120" ${config.durationLimit === '120' ? 'selected' : ''}>2 Dakika</option>
        <option value="180" ${config.durationLimit === '180' ? 'selected' : ''}>3 Dakika</option>
        <option value="300" ${config.durationLimit === '300' ? 'selected' : ''}>5 Dakika</option>
        <option value="600" ${config.durationLimit === '600' ? 'selected' : ''}>10 Dakika</option>
      `;
      
      tr.innerHTML = `
        <td><strong>${recess.label}</strong></td>
        <td>${recess.startTime} - ${recess.endTime}</td>
        <td>${recess.duration} dk</td>
        <td style="text-align:center">
          <label class="toggle-switch" style="width:40px;height:22px">
            <input type="checkbox" class="recess-enabled-cb" data-id="${recess.startTime}" ${config.enabled ? 'checked' : ''}>
            <span class="toggle-slider" style="border-radius:11px"></span>
          </label>
        </td>
        <td>
          <select class="form-input recess-sound-select" data-id="${recess.startTime}" style="margin:0; padding:4px 8px; font-size:13px;">
            ${soundOptions}
          </select>
        </td>
        <td>
          <select class="form-input recess-duration-select" data-id="${recess.startTime}" style="margin:0; padding:4px 8px; font-size:13px;">
            ${durationOptions}
          </select>
        </td>
      `;
      
      // Toggle-slider styling
      const slider = tr.querySelector('.toggle-slider');
      if (slider) {
        slider.style.setProperty('--toggle-size', '16px');
      }
      
      tbody.appendChild(tr);
    });
    
    // Change handlers
    tbody.querySelectorAll('.recess-enabled-cb').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        await this._updateRecessConfig(id, 'enabled', e.target.checked);
      });
    });
    
    tbody.querySelectorAll('.recess-sound-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        await this._updateRecessConfig(id, 'sound', e.target.value);
      });
    });
    
    tbody.querySelectorAll('.recess-duration-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        await this._updateRecessConfig(id, 'durationLimit', e.target.value);
      });
    });
  },
  
  async _updateRecessConfig(startTime, key, value) {
    const recessSettings = await Storage.getSetting('recessSettings') || {};
    if (!recessSettings[startTime]) {
      recessSettings[startTime] = {
        enabled: false,
        sound: 'random',
        durationLimit: 'infinite'
      };
    }
    
    recessSettings[startTime][key] = value;
    await Storage.saveSetting('recessSettings', recessSettings);
    this.showToast('✅ Teneffüs ayarı güncellendi', 'success');
  }
};
