# Dashboard Sayfa Geçiş Performansı — Ajan Planı

> Claude Code / Antigravity ajanına verilmek üzere hazırlanmıştır. Proje: `kitap` (Next.js 14 App Router + Supabase). **Sorun:** `/dashboard/*` altındaki sayfalar arası geçiş yavaş (gözle görülür gecikme). **Kök sebep:** `src/app/dashboard/layout.tsx` cookie tabanlı (dynamic) bir Server Component olduğu için her client-side navigasyonda sunucuda yeniden çalışıyor ve içinde art arda (paralel değil) 2-3 Supabase network round-trip'i yapıyor, bu da hedef sayfa render olmadan önce her geçişi bloklar.

Fazları sırayla uygula, her adımdan sonra `npm run dev` ile gerçek bir navigasyon testi yap (Network tab'de sayfa geçiş süresini gözlemle).

---

## Faz 1 — En hızlı kazanç: `pendingApprovalsCount` sorgusunu layout'tan çıkar

**Dosya:** `src/app/dashboard/layout.tsx`

Şu an layout, `idareci`/`super_admin` rolündeki kullanıcılar için bekleyen onay sayısını (`pendingApprovalsCount`) senkron olarak (await ile) çekip render'ı bloke ediyor. Bu sadece sidebar'daki küçük bir bildirim rozeti — sayfanın tamamının render'ını bekletmesinin hiçbir gerekçesi yok.

**Yapılacak:**
1. Layout'taki bu sorguyu (`profiles` tablosunda `count`) tamamen kaldır.
2. `DashboardLayoutClient`'a `pendingApprovalsCount` prop olarak sunucudan geçirmek yerine, bunu **client-side** bir component içinde `useEffect` ile mount olduktan sonra çek (örn. bir `PendingApprovalsBadge` client component, kendi Supabase client'ıyla `supabase.from("profiles").select(..., {count:"exact",head:true})` çağırır).
3. Bu component sidebar'da rozetin olduğu yere yerleştirilir; ilk render'da rozet görünmez/0 gösterir, veri geldiğinde (birkaç yüz ms içinde) güncellenir — kullanıcı bunu fark etmez ama artık sayfa geçişini bloklamaz.

**Kabul kriteri:** Layout dosyasında artık `pendingApprovalsCount` için hiçbir `await supabase...` çağrısı yok; rozet hâlâ doğru sayıyı gösteriyor ama sayfa render'ından sonra (asenkron) güncelleniyor.

---

## Faz 2 — Middleware'in doğruladığı kullanıcıyı layout'a tekrar sorgulatma

**Dosyalar:** `src/lib/supabase/middleware.ts`, `src/app/dashboard/layout.tsx`, `src/lib/supabase/auth-cache.ts`

Şu an `middleware.ts` zaten akıllıca davranıyor: JWT'yi cookie'den kendi çözüp süresi 5 dakikadan fazla kaldıysa Supabase Auth API'sine hiç gitmiyor. Ama `getCachedUserAndProfile()` (layout'un çağırdığı) yine de kendi `supabase.auth.getUser()` çağrısını yapıyor — yani middleware'in zaten doğruladığı kullanıcı bilgisi **tekrar** ağ üzerinden doğrulanıyor.

**Yapılacak:**
1. `middleware.ts`'de JWT'yi zaten `parseJwt()` ile çözüyoruz — `payload.sub` (user id) ve varsa `payload.email` gibi alanları bir response header'ına yaz (örn. `x-user-id`, sadece middleware'in "cookie'den hızlı yol" dalında, yani zaten geçerli bir session olduğu bilinen durumda).
2. `getCachedUserAndProfile()` içinde, önce bu header'ın (Next.js'te `headers()` API'siyle) var olup olmadığına bak:
   - Header varsa → `auth.getUser()` çağrısını **atla**, doğrudan header'daki `user_id` ile `profiles` tablosunu sorgula (tek round-trip).
   - Header yoksa (örn. middleware'in "fallback" dalına düştüğü, session'ın yenilenmesi gereken nadir durum) → mevcut `auth.getUser()` akışına geri dön (güvenlik için).
3. Bu optimizasyonu yaparken **güvenlik varsayımını bozma**: header'a yazılan user id, middleware'in JWT imzasını (Supabase'in kendi doğrulamasından) çözdüğü bir değer olmalı — layout bu header'a kör kör güvenmeden önce, header'ın gerçekten middleware tarafından bu istekte set edildiğinden emin ol (Next.js middleware → server component header geçişi zaten güvenli bir kanal, dışarıdan enjekte edilemez, ama yine de kodu yazarken bunu bir yorum satırıyla not düş).

**Kabul kriteri:** Normal navigasyon akışında (geçerli, süresi dolmamış session) layout artık `auth.getUser()`'ı hiç çağırmıyor, sadece tek bir `profiles` sorgusu yapıyor.

---

## Faz 3 — Kalan sorguyu paralelleştir (varsa)

Faz 1 ve 2 sonrası, layout'ta idealde sadece tek bir `profiles` (+ join `schools`) sorgusu kalmış olmalı. Eğer ileride layout'a başka bir veri ihtiyacı eklenirse (örn. yeni bir modül için okul-genel bir ayar), bunu **her zaman** `Promise.all([...])` ile paralel çalıştır, art arda `await` zinciri yapma. Bu fazı, ileride yeni bir layout-seviyesi sorgu eklenirse referans olarak bırak — şu an için ekstra bir aksiyon gerekmeyebilir (Faz 1-2 sonrası kontrol et).

---

## Test / Doğrulama
- Chrome DevTools → Network tab, `/dashboard` altında farklı sayfalar arası (örn. kitap-takip → devam-takip → temizlik) birkaç kez gezin, her geçişteki toplam süreyi ve kaç tane Supabase/PostgREST isteği gittiğini karşılaştır (öncesi/sonrası).
- Süper admin ve idareci rolüyle test et (pendingApprovalsCount rozeti hâlâ doğru görünüyor mu, sadece gecikmeli).
- Session süresi dolmuş/yenilenmesi gereken durumda (`payload.exp - now <= 300`) fallback akışının hâlâ doğru çalıştığını (login'e düşmediğini, session'ın yenilendiğini) test et — Faz 2 burada bir regresyon yaratabilir, özellikle dikkatli test edilmeli.

## Kabul Kriterleri (özet)
- Sayfa geçişlerinde gözle görülür gecikme belirgin şekilde azalmalı (hedef: layout'un bloklayan round-trip sayısı 2-3'ten 0-1'e inmiş olmalı).
- Mevcut auth/redirect davranışı (login'e yönlendirme, complete-registration, pending onay ekranı) hiçbir şekilde bozulmamalı.
- Bekleyen onay rozeti hâlâ doğru sayıyı gösteriyor, sadece artık sayfa render'ını bloklamıyor.
