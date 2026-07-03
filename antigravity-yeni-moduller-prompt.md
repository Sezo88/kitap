# Kitap Okuma Takip Sistemi — Yeni Modüller İçin Ajan Promptu

> Bu prompt Opus 4.6 (Antigravity) ajanına doğrudan verilmek üzere hazırlanmıştır. Mevcut proje: **kitapokuma.vercel.app** (GitHub: Sezo88/kitap) — Next.js 14 + Supabase + Tailwind/shadcn. Aşağıdaki işleri **sırayla, her fazın sonunda çalışan bir demo bırakarak** yap.

---

## ÖNCELİK 0 — Teknik Borç (Diğer her şeyden önce yapılmalı)

Mevcut `attendance_*`, `sms_*`, `cleanliness_*`, `subjects`, `projects` tabloları repodaki SQL migration dosyalarında yok (muhtemelen Supabase panelinden elle oluşturulmuş). Bunu düzelt:

1. Supabase CLI (`supabase db pull` veya `supabase db diff`) ile mevcut canlı şemanın tamamını çek
2. Bunu repoya `database-migration-v2.sql` gibi versiyonlanmış bir dosya olarak ekle, mevcut `patch-*.sql` dosyalarıyla çakışmadığını doğrula
3. README'ye kısa bir not ekle: yeni migration nasıl uygulanır

---

## FAZ 1 — Okul Günü Bilgileri (Ders Programı + Nöbet Programı + Doğum Günü)

Bu üçü ortak bir temel katman, çünkü hepsi ileride pano ve öğretmen ana ekranı tarafından tüketilecek.

### 1.1 Doğum Günü
- `students` tablosuna `dogum_tarihi` (date, nullable) alanı ekle
- Mevcut Excel import ekranına (öğrenci içe aktarma) bu sütun için eşleme desteği ekle (opsiyonel alan, boş bırakılabilir)
- Öğrenci profil ekranında doğum tarihi göster/düzenle

### 1.2 Zil Saatleri (Okul Geneli)
- Yeni tablo: `bell_schedule` — `id, school_id, period_no (1,2,3...), start_time, end_time, label (örn. "1. Ders", "1. Teneffüs")`
- İdareci panelinde bu tabloyu düzenleyebileceği basit bir ekran (CRUD)

### 1.3 Ders Programı (Öğretmen Bazlı)
- Yeni tablo: `lesson_schedule` — `id, school_id, class_id (fk), teacher_id (fk → profiles), subject_id (fk → subjects — zaten var), day_of_week (1-5), period_no (fk → bell_schedule.period_no)`
- İdareci panelinde sınıf/gün/saat bazlı ders programı girişi (basit tablo/grid arayüz)
- Öğretmen dashboard'unda "bugün hangi sınıflara giriyorum" özeti bu tablodan türetilsin

### 1.4 Nöbet Programı
- Yeni tablo: `duty_schedule` — `id, school_id, teacher_id (fk), day_of_week (1-5), period_no veya time_slot (örn. "1. Teneffüs", "Kapı Nöbeti"), location (text, opsiyonel)`
- İdareci panelinde nöbet çizelgesi girişi (haftalık grid: gün × saat dilimi × öğretmen)
- Öğretmen dashboard'unda "bugün nöbetin var" hatırlatma kartı

### 1.5 RLS
- `bell_schedule`, `lesson_schedule`, `duty_schedule`: sadece idareci/süper admin yazabilir; öğretmen kendi okulundaki tüm kayıtları okuyabilir (kendi programını görmek için, sadece kendi kaydıyla sınırlı tutma — meslektaşının nöbetini de görebilmeli)

---

## FAZ 2 — Öğrenci Karnesi (Birleşik Görünüm)

Yeni tablo gerekmiyor — var olan verileri (okuma, devamsızlık, proje, temizlik puanı) tek bir öğrenci profil/karne ekranında birleştir.

- Öğrenci profil sayfasına yeni bir "Karne" sekmesi/bölümü ekle
- İçerik: okuma geçmişi özeti (kaç kitap, hangi kitaplar), devamsızlık oranı (dönem bazlı), proje teslim durumları, temizlik puanı ortalaması
- Dönem/tarih aralığı filtresi (örn. "1. Dönem", "Bu Ay")
- **PDF çıktısı:** mevcut `lib/pdf/` altyapısını kullanarak karneyi tek tıkla PDF olarak indirilebilir/yazdırılabilir hale getir (veli toplantısı için)

---

## FAZ 3 — Zil Programı Entegrasyonu (Electron)

Mevcut Electron zil uygulamasına uzaktan tetikleme özelliği ekle. **Önemli: günlük rutin zil çalma mantığı Electron içinde yerel/offline kalmalı, sadece manuel/özel tetiklemeler uzaktan gelsin.**

- Yeni tablo: `bell_commands` — `id, school_id, command_type (enum: play_bell | play_anthem | custom_announcement), triggered_by (fk → profiles), triggered_at, status (pending/acknowledged)`
- İdareci panelinde "Zil Kontrol" ekranı: butonlar (Teneffüs Zili, İstiklal Marşı, Özel Anons), her tetikleme `bell_commands`'a kayıt açar
- Electron tarafında Supabase Realtime'a (`bell_commands` tablosuna insert) abone ol, yeni kayıt geldiğinde ilgili ses dosyasını yerel olarak çal
- Ses dosyaları Electron içinde yerel dursun, sadece komut (hangi ses) uzaktan gelsin
- RLS: sadece idareci/süper admin `bell_commands`'a insert yapabilir
- Log ekranı: kim, ne zaman, hangi komutu tetikledi

---

## FAZ 4 — Dijital Pano Entegrasyonu (Raspberry Pi)

RPi'deki panoyu "dumb display" haline getir — ağır hesaplama/sorgu yapmasın, sadece sunucu tarafında hazırlanmış slayt listesini gösterip döndürsün.

- Yeni tablo: `panel_slides` veya sunucu tarafında (Edge Function/API route) dinamik hesaplanan bir "aktif slayt listesi" endpoint'i:
  - Aktif duyurular (idarenin girdiği, süresi geçmemiş)
  - Bugünün ders programı / o an hangi ders (Faz 1'deki `lesson_schedule`'dan)
  - Haftanın en çok okuyan sınıfı / ayın kitap kurdu öğrencisi (mevcut okuma verisinden hesaplanır)
  - Bugün doğan öğrenciler (Faz 1.1'den)
  - Bugünün nöbetçi öğretmenleri (Faz 1.4'ten)
- İdareci panelinde "Pano Ayarları": hangi slayt tiplerinin aktif olacağı (toggle), her slaytın ekranda kalma süresi, manuel duyuru ekle/sil
- RPi tarafı: birkaç dakikada bir bu endpoint'i çeker (polling yeterli, Realtime şart değil), CSS geçişleri minimal tutulmalı (blur/gradient animasyonlarından kaçın, sade `opacity` fade kullan) — RPi 4B'de performans sorunu yaşamamak için
- Chromium kiosk modda, gereksiz uzantısız, 1080p çözünürlükte çalıştırılmalı

---

## Genel Kurallar (Tüm Fazlar İçin)
- Her yeni tablo için RLS politikaları mevcut rol yapısına (`super_admin` / `idareci` / `ogretmen`) uygun yazılmalı
- Sayfa geçişlerinde daha önce tespit edilen "sıralı sorgu" (waterfall) hatasına düşme — birbirine bağımlı olmayan sorguları `Promise.all` ile paralel çalıştır
- Her faz sonunda: hangi ekranların çalışır durumda olduğu kısa bir özet halinde raporlanmalı
- Yeni tablo eklerken migration dosyasını mutlaka repoya ekle (Öncelik 0'daki hatayı tekrarlama)
