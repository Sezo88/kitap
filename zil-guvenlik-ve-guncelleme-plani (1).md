# Zil Sistemi — Güvenlik Sıkılaştırma + PIN + Güncelleme Kontrolü — Ajan Planı

> Bu prompt Antigravity/Claude Code ajanına doğrudan verilmek üzere hazırlanmıştır. Proje: **kitapokuma.vercel.app** (GitHub: Sezo88/kitap) — Next.js 14 + Supabase + Electron (`zil-app/`). Fazları **sırayla**, her fazın sonunda çalışan bir demo bırakarak yap. Faz 0'ı atlama — diğer her şeyden önce gelir.

---

## FAZ 0 — Kritik RLS Düzeltmesi (Önce bu, diğer her şeyden önce)

**Sorun:** `schools_select` politikası `USING (true)` olduğu için anon key ile herkes `schools` tablosunun TÜM sütunlarını (sms_password, sms_username, pano_pin, code) çekebiliyor. Ayrıca `bell_commands_insert` politikasında `school_id` kontrolü yok, bu yüzden bir okulun idarecisi başka okula zil komutu gönderebilir.

### 0.1 — `schools` tablosunu genel okumaya kapat
- Mevcut `schools_select USING (true)` politikasını KALDIR.
- Yerine sadece kendi okulunu/super_admin'i gören bir politika ekle:
  ```sql
  DROP POLICY IF EXISTS "schools_select" ON public.schools;
  CREATE POLICY "schools_select_own" ON public.schools
    FOR SELECT USING (id = public.get_my_school_id() OR public.get_my_role() = 'super_admin');
  ```
- **Dikkat:** `resolve_school_code` RPC'si `SECURITY DEFINER` olduğu için bu politikadan etkilenmez, okul kodu ekranı (giriş öncesi, anon) çalışmaya devam eder. `/pano` ekranı da `pano_pin` doğrulamasını RPC üzerinden yapmıyorsa (şu an `.eq("pano_pin", pin)` ile doğrudan sorgu yapıyor — bunu da SECURITY DEFINER bir RPC'ye taşı, örn. `verify_pano_pin(p_school_id, p_pin)`), yoksa pano girişi bu değişiklikten sonra kırılır.
- Aynı mantığı `sms_password`/`sms_username` içeren tüm client tarafı sorgular için kontrol et — bu alanlar artık sadece server-side (service role) route'lardan okunmalı, hiçbir client component `schools` tablosunu `select("*")` ile çekmemeli.

### 0.2 — `bell_commands` cross-school açığını kapat
```sql
DROP POLICY IF EXISTS "bell_commands_insert" ON public.bell_commands;
CREATE POLICY "bell_commands_insert" ON public.bell_commands
  FOR INSERT WITH CHECK (
    public.get_my_role() = 'super_admin'
    OR (public.get_my_role() = 'idareci' AND school_id = public.get_my_school_id())
  );
```
Aynı şekilde `bell_commands_select`/`update` politikalarını da `school_id = get_my_school_id() OR super_admin` ile sınırla (şu an ikisi de `USING (true)`).

### 0.3 — Regresyon kontrolü
- Panel/idareci ekranlarının hepsinin (`bell-control-client.tsx`, `panel-settings-client.tsx`, `dashboard/admin/panel-settings`) hâlâ çalıştığını manuel test et.
- `/pano` ve `/quiz` ekranları (anon, kiosk modu) bilerek `USING (true)` bırakılan tablolara dokunmuyor — bunlara dokunma, onlar tasarım gereği açık.

---

## FAZ 1 — Zil Uygulamasına PIN Ekleme

**Amaç:** Okul kodu tek başına yeterli olmasın; eşleştirme (pairing) anında PIN de doğrulansın. PIN, `schools` tablosunda düz metin tutulmayacak (hash'lenecek) ve hiçbir SELECT politikasıyla dışarı sızmayacak.

### 1.1 — Veritabanı
```sql
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS bell_api_pin_hash text;

CREATE OR REPLACE FUNCTION public.resolve_school_code_secure(p_code text, p_pin text)
RETURNS TABLE (school_id uuid, school_name text, license_expires_at timestamptz, feature_bell boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.license_expires_at, s.feature_bell
  FROM public.schools s
  WHERE s.code = p_code
    AND s.bell_api_pin_hash IS NOT NULL
    AND s.bell_api_pin_hash = extensions.crypt(p_pin, s.bell_api_pin_hash);
END;
$$;
```
- `pgcrypto` eklentisi açık olmalı (`CREATE EXTENSION IF NOT EXISTS pgcrypto;`), hash için `crypt(p_pin, gen_salt('bf'))` kullan.
- Hata mesajı **jenerik** olmalı ("Okul kodu veya PIN hatalı") — kodun mu yoksa PIN'in mi yanlış olduğunu ayırt ettirme (enumeration'ı zorlaştırır).
- Eski `resolve_school_code(p_code)` fonksiyonunu KALDIRMA — geçiş süresi için tut, ama Electron tarafını yeni fonksiyona geçir.

### 1.2 — Admin panel (web) — PIN belirleme ekranı
- `dashboard/admin` altında (muhtemelen mevcut okul ayarları sayfası) yeni bir "Zil API PIN" alanı ekle.
- Kaydetme, PIN'i client'tan **hash'lenmeden** göndermemesi için bir API route üzerinden yapılmalı: `src/app/api/panel/bell-pin/route.ts` (server-side, service role client ile `crypt()` çağırır ya da Postgres RPC `set_bell_pin(p_school_id, p_pin)` SECURITY DEFINER olarak yazılır). Client asla hash algoritmasını görmemeli.
- 4-6 haneli sayısal PIN yeterli (okuldaki kullanım şekli düşünülürse), ama brute-force'a karşı `resolve_school_code_secure` RPC'sine basit bir rate-limit önerisi ekle (örn. `pg_ratelimit` yoksa, uygulama seviyesinde IP/okul-kodu başına dakikada birkaç deneme).

### 1.3 — Electron app (`zil-app/`) — eşleştirme ekranı
- Mevcut okul kodu giriş ekranına (muhtemelen `src/index.html` + `src/js/ui.js`) bir PIN input alanı ekle.
- `preload.js`: `reconnectSupabase: (schoolCode, pin) => ipcRenderer.invoke('reconnect-supabase', schoolCode, pin)` — imzayı güncelle.
- `main.js` → `reconnect-supabase` handler'ını `resolve_school_code_secure` RPC'sini `schoolCode` + `pin` ile çağıracak şekilde güncelle. Başarılı olursa `schoolId`'yi kaydet (PIN'i kaydetme — sadece pairing anında kullanılır, tekrar saklamaya gerek yok çünkü realtime bağlantı `schoolId` ile devam eder).
- Hata durumunda kullanıcıya jenerik mesaj göster ("Okul kodu veya PIN hatalı").

### 1.4 — Geriye dönük uyumluluk
- Halihazırda kurulu, `bell_api_pin_hash` set edilmemiş okullar için: `resolve_school_code_secure` PIN NULL/boş olan okullarda eski davranışa (sadece kod) izin verip vermeyeceğine karar ver — önerim: geçiş dönemi için PIN boşsa eski `resolve_school_code`'a düş, ama admin paneline "PIN belirlenmemiş" uyarı rozeti koy ki herkes PIN'ini girsin.

---

## FAZ 2 — Zil Uygulaması Güncelleme Kontrolü

(Önceki konuşmada konuşulan plan)

### 2.1 — Sürüm dosyası
- `public/downloads/version.json` (Vercel'de statik servis edilecek):
  ```json
  { "version": "1.1.0", "url": "https://kitap-amber.vercel.app/downloads/Okul_Zil_Sistemi_Setup.exe", "notes": "..." }
  ```
- Her yeni build'de bu dosya ve `zil-app/package.json`'daki `version` elle güncellenecek (otomasyon istenirse ayrı bir faz olarak ele alınabilir).

### 2.2 — Electron tarafı kontrol
- `main.js`'e `checkForUpdates()` fonksiyonu: `app.whenReady()` içinde bir kez, sonra günde bir `setInterval` ile `fetch('https://kitap-amber.vercel.app/downloads/version.json')`.
- `app.getVersion()` (package.json'daki `version`, `electron-builder` build sırasında exe'ye gömer) ile `version.json`'daki sürümü basit semver karşılaştırmasıyla kıyasla.
- Yeni sürüm varsa `preload.js` üzerinden renderer'a event gönder (`onUpdateAvailable`), UI'da köşede bir bildirim/rozet göster: "Yeni sürüm mevcut (1.1.0) — İndir" → tıklanınca `shell.openExternal(url)` ile tarayıcıda indirme linkini aç. Otomatik indirme/kurulum YAPMA (code signing yok, güvenlik uyarılarına takılır) — kullanıcı manuel indirip kursun.

### 2.3 — Tray menüsüne "Güncellemeleri kontrol et" seçeneği ekle
- `updateTrayMenu()` fonksiyonuna manuel tetikleme seçeneği ekle.

**2.1–2.3'ün sınırı:** Bu sadece "yeni sürüm var" diye haber verir, kurulumu yine sen elle exe'yi build edip her bilgisayara gidip/gönderip kurmak zorunda kalırsın. Asıl istenen — exe'yi elle taşımadan güncelleme yapabilmek — için iki katmanlı bir mantık gerekiyor:

### 2.4 — Katman 1: Kod güncellemesi (OTA / hot-patch) — çoğu değişiklik için, exe GEREKMEZ
**Mantık:** Electron'da `main.js` (native/Node tarafı) nadiren değişir; günlük değişikliklerin çoğu (yeni ses ekleme, arayüz düzenlemesi, zil tetikleme mantığında küçük düzeltme, yeni komut tipi vb.) `src/` klasöründeki HTML/CSS/JS dosyalarında olur. Bu dosyalar kurulum sırasında diske gömülü değil — uygulama açılışta bir "renderer sürümü" kontrolü yapıp, sunucudan yeni bir zip indirip kullanıcı klasörüne açabilir ve index.html'i oradan yükleyebilir. **Elinde zaten `adm-zip` bağımlılığı var, ek paket gerekmiyor.**

Akış:
1. `zil-app/src/` klasörünü değiştirdikten sonra, sen (ya da agent) `npm run build:renderer-patch` gibi basit bir script çalıştırır: `src/` klasörünü zip'ler → `renderer-manifest.json` içine `{ "renderer_version": 7, "url": ".../renderer-v7.zip", "sha256": "..." }` yazar → ikisini de `public/downloads/` altına koyup Vercel'e push eder (Next.js zaten deploy pipeline'ın var, ekstra sunucu gerekmiyor).
2. `main.js` açılışta ve periyodik olarak `renderer-manifest.json`'ı çeker, yerel `userData/renderer/version.txt` ile karşılaştırır.
3. Yeni sürüm varsa zip'i indirir, **sha256 doğrular** (bozuk/yarım indirmeye karşı), `AdmZip` ile `userData/renderer/` altına açar, eski sürümü yedekleyip değiştirir.
4. `BrowserWindow` bir sonraki açılışta (veya `win.loadFile` çağrısı `userData/renderer/index.html`'i mi yoksa gömülü `src/index.html`'i mi yükleyeceğine karar vererek) güncel dosyaları yükler. En basiti: uygulama tamamen kapanıp yeniden açılınca aktif olur (zaten günde 1-2 kontrol yeterli, anlık geçiş şart değil).
5. Bozuk bir patch gelirse (index.html eksik/parse hatası) **otomatik olarak gömülü orijinal `src/`'ye geri dönülmeli** (fallback) — tek nokta arıza olmasın.

Bu katmanla, "yeni bir zil sesi ekledim" veya "arayüzde küçük bir buton değişikliği yaptım" gibi %80 senaryoda **hiç yeni exe üretmene gerek kalmaz** — sadece zip'i Vercel'e atarsın, bütün okul bilgisayarları bir sonraki açılışta otomatik çeker.

### 2.5 — Katman 2: Tam kurulum güncellemesi (`electron-updater`) — main.js/native değişikliklerinde
**Ne zaman gerekir:** `main.js` içinde yeni bir Node modülü eklendiğinde, Electron sürümü yükseltildiğinde, ya da `package.json` bağımlılıkları değiştiğinde — bunlar Katman 1 ile çözülemez, gerçek yeni installer gerekir.

Mantık:
1. `zil-app`'e `electron-updater` paketini ekle, `electron-builder.yml`'de `publish` alanını **generic provider** olarak Vercel'e işaret et:
   ```yaml
   publish:
     provider: generic
     url: https://kitap-amber.vercel.app/downloads/
   ```
   (Ayrı bir update-server kurmana gerek yok — zaten statik dosya barındıran Vercel'i kullanıyoruz.)
2. Build alırken `electron-builder --publish never` ile hem `Okul_Zil_Sistemi_Setup.exe` hem de `latest.yml` üretilir; ikisini de `public/downloads/`'a koyup push edersin.
3. `main.js`'e `autoUpdater.checkForUpdatesAndNotify()` ekle (günde 1 kontrol yeterli, Katman 1 kontrolüyle aynı zamanlayıcıda çalışabilir).
4. Kod imzalama sertifikan olmadığı için Windows SmartScreen ilk açılışta bir uyarı gösterebilir — bunu kullanıcıya (idareciye) önceden bir kez anlatman yeterli, `electron-updater` yine de arka planda indirip günceller ve bir sonraki uygulama yeniden başlatıldığında sessizce kurar (`autoUpdater.autoInstallOnAppQuit = true`).
5. Bu katman ayda birkaç kez tetiklenecek kadar nadir olduğu için karmaşıklığı düşük tutmak adına otomatik indirsin ama **kurulumu** sadece "uygulamayı yeniden başlat" dediğinde yapsın (kullanıcı ortasında zil çalarken kurulum yapıp uygulamayı kapatmasın).

### 2.6 — Hangi katman ne zaman kullanılır (özet karar tablosu)
| Değişiklik türü | Katman |
|---|---|
| Yeni zil sesi, arayüz metni/stil değişikliği, renderer JS mantığı (`src/js/*`) | Katman 1 (OTA zip) — exe yok |
| `main.js` içinde yeni IPC handler, yeni npm bağımlılığı, Electron sürüm yükseltmesi | Katman 2 (electron-updater, yeni installer) |
| Veritabanı/RLS/RPC değişikliği (Faz 0/1'deki gibi) | Hiçbiri gerekmez — sunucu tarafı, Electron'u etkilemez |

---

## Kabul Kriterleri (her faz için)
- Faz 0: Anon key ile `curl` üzerinden `schools?select=*` denendiğinde artık veri dönmemeli (401/boş sonuç); mevcut idareci/super_admin panelleri hatasız çalışmalı.
- Faz 1: PIN yanlışsa Electron'da bağlantı reddedilmeli; doğruysa mevcut akış (heartbeat, realtime, komutlar) değişmeden çalışmalı.
- Faz 2 (bildirim): `version.json`'daki sürüm yükseltildiğinde açık olan Electron app'te bildirim görünmeli; sürüm aynıysa hiçbir şey göstermemeli.
- Faz 2.4 (OTA): `src/` içinde bir dosya değiştirip yeni bir `renderer-vN.zip` + manifest yayınlandığında, uygulama yeniden açıldığında değişiklik exe'ye dokunmadan görünmeli; bozuk bir zip yüklendiğinde uygulama çökmeden gömülü sürüme dönmeli.
- Faz 2.5 (installer güncelleme): `latest.yml` + yeni exe yayınlandığında `electron-updater` arka planda indirmeli, uygulama yeniden başlatılınca yeni sürüm kurulu olmalı.
