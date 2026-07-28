# Android Splash Ekranı Gecikmesi (Siyah Ekran) — Ajan Planı

> Claude Code / Antigravity ajanına verilmek üzere. **İki ayrı repo** etkileniyor: `oypandroid` (Capacitor Android projesi) ve `kitap` (Next.js sitesi — WebView'in gösterdiği asıl içerik). İkisi de değişmeden sorun çözülmez, ikisini de uygula.

## Sorun
Uygulama açılışında 5-6 saniye (bazen fazla) siyah ekran görünüyor, sonra içerik açılıyor.

## Kök sebep
`oypandroid/capacitor.config.json`'daki `SplashScreen` ayarında `launchAutoHide` belirtilmemiş (varsayılan `true`), yani splash **800ms sonra otomatik kapanıyor** — site (`oyp.vercel.app`, remote URL modunda SSR + hydration) henüz yüklenmemiş olsa bile. Splash kapandıktan sonra, sayfa gerçekten hazır olana kadar geçen sürede kullanıcı boş/siyah bir WebView görüyor. `kitap` reposunda da `@capacitor/splash-screen` paketi hiç kurulu değil — yani "ben yüklendim, splash'i kapat" diyen bir JS çağrısı hiçbir yerde yok.

---

## Adım 1 — `oypandroid` reposu: otomatik kapanmayı durdur

`capacitor.config.json` içindeki `SplashScreen` bloğunu şu şekilde değiştir:
```json
"SplashScreen": {
  "backgroundColor": "#0a0e1a",
  "launchAutoHide": false
}
```
(`launchShowDuration` satırını kaldır, artık kullanılmayacak — kapanma zamanını JS tarafı belirleyecek.)

Değişiklik sonrası:
```bash
npx cap sync android
```
çalıştır ki native tarafa yansısın.

## Adım 2 — `kitap` reposu: splash'i sayfa gerçekten hazır olunca kapat

1. Paketi ekle:
```bash
npm install @capacitor/splash-screen
```
2. `src/components/layout/CapacitorBackButtonHandler.tsx` dosyasını aç (zaten Capacitor bootstrap mantığının olduğu yer). İçine, component mount olduğunda çalışacak şekilde şunu ekle:
```ts
import("@capacitor/splash-screen").then(({ SplashScreen }) => {
  SplashScreen.hide();
});
```
- Bu çağrı, sadece Capacitor ortamında (native app içinde) anlamlı — normal tarayıcıda `@capacitor/splash-screen` import edilse bile no-op davranır, siteye zarar vermez.
- Mevcut dosyadaki `window.Capacitor` kontrolü varsa (muhtemelen var, back-button mantığı zaten bunu kontrol ediyor), `SplashScreen.hide()` çağrısını da aynı kontrolün içine koy — gereksiz yere tarayıcıda import çalıştırmasın.

3. **Önemli detay:** Bu çağrı, component'in en üst seviyede (root layout'a bağlı) mount olduğu ilk render'da tetiklenmeli — yani "sayfa DOM'a geldi" anlamına gelir, "tüm veri yüklendi" anlamına gelmez. Bu ideal davranış zaten: kullanıcı boş/siyah ekran yerine, verinin yüklenmesini beklerken bile en azından **gerçek arayüzün iskeletini** (sidebar, loading spinner'lar vb.) görür — bu, siyah ekrandan çok daha iyi bir kullanıcı deneyimi.

## Adım 3 — Test
1. `oypandroid`'de `npx cap sync android` sonrası Android Studio'dan gerçek cihaza/emülatöre yeni build at.
2. Uygulamayı tamamen kapatıp (background'dan da temizle) yeniden aç — soğuk başlatma testi bu, sıcak başlatmada (uygulama zaten arka planda) fark az olur.
3. Beklenen: splash ekranı (koyu arkaplan, `#0a0e1a`), sayfa gerçekten render olana kadar ekranda kalmalı — siyah/boş bir ara ekran görünmemeli.
4. Mobil veri (wifi değil) ile de test et — gerçek okul ortamında bağlantı daha yavaş olabilir, orada da makul bir sürede (kabul edilebilir, ~1-3 sn) açılmalı.

## Kabul Kriterleri
- Soğuk başlatmada splash, sayfa render olana kadar kesintisiz ekranda kalıyor — arada siyah/boş ekran yok.
- `kitap` reposunda tarayıcıdan (normal web ziyaretçisi) siteye girildiğinde hiçbir davranış değişikliği yok (splash-screen kodu sadece Capacitor içinde çalışıyor).
- Geri tuşu davranışı (önceki fazda eklenen) bozulmamış.
