# Okuma Takip Uygulaması — Implementasyon Planı

> Bu doküman bir yapay zeka kodlama ajanına (Cursor/Claude Code vb.) verilmek üzere hazırlanmıştır. Kod içermez, sadece mimari, veri modeli, ekranlar ve fazlar tanımlanmıştır. Ajan bu plana göre kodu yazacaktır.

---

## 1. Proje Özeti

Okullarda her gün ders saatinde (okuma saati) öğrencilerin kitap getirip getirmediğini ve okuyup okumadığını öğretmenin işaretlediği, öğrencilerin aktif okudukları kitabı seçtiği, okul kütüphanesinin tutulduğu ve idarenin tüm sınıfların durumunu raporladığı bir web uygulaması.

- **Barındırma:** Vercel
- **Veritabanı / Auth:** Supabase
- **Kullanım modeli:** Süper admin (Sezai) bir "okul topluluğu" oluşturur, idareci ve öğretmenleri davet eder. Öğrenciler e-Okul'dan Excel ile alınıp içeri aktarılır.

---

## 2. Teknoloji Yığını Kararı

| Katman | Seçim | Gerekçe |
|---|---|---|
| Framework | **Next.js 14+ (App Router, TypeScript)** | Vercel'in kendi framework'ü, Supabase ile resmi entegrasyon şablonları mevcut, SSR + Server Actions ile hem hızlı hem güvenli |
| UI | **Tailwind CSS + shadcn/ui** | Hazır, profesyonel görünümlü tablo/form/dashboard bileşenleri; raporlama ekranları için ideal |
| Veritabanı/Auth | **Supabase (Postgres + Auth + RLS)** | İstenen veritabanı; Row Level Security ile rol bazlı erişim doğal olarak çözülüyor |
| Form & Validasyon | **react-hook-form + zod** | Öğrenci/kitap/kullanıcı formları için standart, az hata |
| Excel İşleme | **SheetJS (xlsx)** | e-Okul Excel exportlarını client veya server'da parse etmek için |
| Tablo/Liste | **TanStack Table** | Sınıf listeleri, rapor tabloları, filtreleme/sıralama |
| Grafik (opsiyonel) | **Recharts** | İdare raporlarında okuma oranı grafikleri |
| Deploy | **Vercel** | İstenen hedef platform |

**Neden Next.js + Supabase?** Bu ikili, Vercel ekosisteminde en olgun ve en çok örneklenmiş kombinasyon olduğu için yapay zeka ajanlarının doğru kod üretme başarısı en yüksek seçenektir. Ayrıca Server Actions sayesinde ayrı bir backend (FastAPI gibi) kurmaya gerek kalmaz, tek repo / tek deploy yeterli olur.

---

## 3. Roller ve Yetkiler

| Rol | Açıklama | Yetkiler |
|---|---|---|
| `super_admin` | Sezai | Tüm okul topluluklarını yönetir, idareci/öğretmen davet eder, her şeyi görür/düzenler |
| `idareci` | Okul müdürü/müdür yardımcısı (Nazan Tunay gibi) | Kendi okulundaki tüm sınıf, öğrenci, öğretmen verilerini görür; rapor ekranına erişir; günlük işaretleme yapmaz (salt okunur + öğretmen/sınıf yönetimi) |
| `ogretmen` | Dersi giren öğretmen | Sadece kendisine atanmış sınıf(lar)ı görür, günlük okuma işaretlemesi yapar, öğrencinin aktif kitabını değiştirir, kütüphaneye kitap ekleyebilir |

Yetkilendirme Supabase **Row Level Security (RLS)** politikaları ile `school_id` ve `role` üzerinden uygulanır. Bir öğretmen sadece `teacher_classes` tablosunda kendine atanmış `class_id`'lere ait verilere erişebilir; idareci ve süper admin kendi `school_id`'sindeki (süper admin: tüm) her şeye erişebilir.

---

## 4. Veri Modeli (Supabase / Postgres)

> Aşağıdaki tablolar alan listesi olarak verilmiştir; SQL kodunu ajan yazacaktır.

### 4.1 `schools` (okul topluluğu)
- id (uuid, pk)
- name (text) — örn. "İhsan Çelikten Ortaokulu"
- created_by (uuid → auth.users)
- created_at

### 4.2 `profiles` (kullanıcı profili, auth.users ile 1-1)
- id (uuid, pk = auth.users.id)
- school_id (fk → schools)
- full_name (text)
- role (enum: super_admin | idareci | ogretmen)
- created_at

### 4.3 `classes` (sınıflar)
- id (uuid, pk)
- school_id (fk)
- name (text) — örn. "5-A"
- grade_level (int) — örn. 5
- created_at

### 4.4 `teacher_classes` (öğretmen–sınıf ilişkisi, çoktan-çoğa)
- id (uuid, pk)
- teacher_id (fk → profiles)
- class_id (fk → classes)

### 4.5 `students` (öğrenciler)
- id (uuid, pk)
- school_id (fk)
- class_id (fk → classes)
- e_okul_no (text, opsiyonel — e-Okul numarası)
- full_name (text)
- is_active (bool, default true) — sınıf değişikliği/ayrılma durumunda pasife çekmek için
- created_at

### 4.6 `books` (kütüphane)
- id (uuid, pk)
- school_id (fk)
- title (text)
- author (text)
- page_count (int, opsiyonel)
- category (text, opsiyonel)
- added_by (fk → profiles)
- created_at

### 4.7 `student_books` (öğrencinin okuduğu/okuduğu kitap geçmişi + aktif kitap)
- id (uuid, pk)
- student_id (fk)
- book_id (fk)
- status (enum: active | completed | abandoned)
- started_at (date)
- finished_at (date, null olabilir)
- created_at

> Kural: bir öğrencinin aynı anda yalnızca **bir** `status = active` kaydı olabilir. Yeni kitap seçildiğinde önceki aktif kayıt `completed` veya `abandoned` yapılır.

### 4.8 `reading_logs` (günlük işaretleme — uygulamanın çekirdeği)
- id (uuid, pk)
- student_id (fk)
- class_id (fk) — raporlama hızlı sorgular için redundant ama pratik
- log_date (date)
- brought_book (bool) — kitabı getirdi mi
- did_read (bool) — okudu mu
- active_book_id (fk → books, nullable) — o günkü aktif kitap referansı (geçmişe dönük doğruluk için)
- marked_by (fk → profiles) — işaretleyen öğretmen
- note (text, opsiyonel)
- created_at

> Kısıt: `(student_id, log_date)` üzerinde **unique constraint** — bir öğrenci için günde tek kayıt, öğretmen var olan kaydı güncelleyebilir.

---

## 5. Ekranlar / Modüller

### 5.1 Kimlik Doğrulama & Onboarding
- Giriş/kayıt (Supabase Auth — email/şifre, ileride Google ile giriş eklenebilir)
- Süper admin ilk girişte "Okul Topluluğu Oluştur" akışı
- İdareci/öğretmen davet sistemi: davet linki veya kayıt kodu ile join akışı, role atanarak `profiles` tablosuna yazılır

### 5.2 Öğrenci & Sınıf Yönetimi
- Sınıf oluşturma/düzenleme (idareci, süper admin)
- Öğretmen–sınıf atama ekranı
- **Excel İçe Aktarma:**
  1. e-Okul'dan alınan `.xlsx` dosyası yüklenir
  2. Sistem sütunları otomatik tanımaya çalışır (öğrenci no, ad-soyad, sınıf), eşleşmezse kullanıcı manuel sütun eşlemesi yapar (mapping ekranı)
  3. Önizleme tablosu gösterilir, onaylanınca toplu insert yapılır
  4. Var olmayan sınıflar otomatik oluşturulur veya kullanıcıya sorulur

### 5.3 Kütüphane (Kitaplar)
- Kitap ekle/düzenle/sil (başlık, yazar, sayfa sayısı, kategori)
- Liste + arama/filtre

### 5.4 Aktif Kitap Seçimi
- Öğretmen, öğrenci profilinden "Yeni Kitap Seç" yapar → kütüphaneden seçim veya yeni kitap ekleme
- Önceki aktif kitap otomatik `completed` durumuna alınır, `finished_at` set edilir
- Öğrencinin "okuduğu kitaplar" geçmişi profilinde listelenir

### 5.5 Günlük Okuma Takip Ekranı (Öğretmenin ana ekranı)
- Tarih seçili (varsayılan bugün), öğretmenin sınıfı/sınıfları listelenir
- Her öğrenci satırında: **Getirdi/Getirmedi** ve **Okudu/Okumadı** için tıklanabilir toggle/switch
- Hızlı işaretleme: tüm sınıfı "getirdi+okudu" yapacak toplu buton (öğretmen zaman kazanır)
- Aktif kitap adı satırda görünür (referans için)
- Kayıt anlık olarak Supabase'e yazılır (autosave, sayfa yenilemeye gerek yok)

### 5.6 Öğrenci Profili
- Ad, sınıf, e-Okul no
- Okuduğu kitaplar listesi (geçmiş + aktif)
- Okuma takip geçmişi (takvim görünümü veya tablo: hangi gün getirdi/okudu)
- Okuma oranı (% gün okudu)

### 5.7 İdare Raporları
- Sınıf bazlı filtre, tarih aralığı filtre
- Tablo: öğrenci, sınıf, toplam gün, okuduğu gün sayısı, getirdiği gün sayısı, oran (%)
- Sıralama: en az okuyandan en çok okuyana
- Sınıf bazlı özet (sınıf ortalama okuma oranı)
- Excel/CSV export (opsiyonel, ileri faz)

### 5.8 Kullanıcı/Rol Yönetimi (Süper admin + idareci)
- Öğretmen/idareci listesi, rol değiştirme, sınıf atama
- Davet gönderme/yönetme

---

## 6. RLS (Row Level Security) Mantığı — Yüksek Seviye

- `profiles.school_id = auth.user school_id` koşulu çoğu tabloda temel filtre olacak
- `ogretmen` rolü: `reading_logs`, `student_books` üzerinde yazma yetkisi **sadece** `teacher_classes` ile eşleşen `class_id`'ler için
- `idareci`: kendi `school_id`'sindeki her tabloda okuma (select) yetkisi, öğrenci/sınıf/kullanıcı yönetiminde yazma yetkisi
- `super_admin`: tüm `school_id`'ler için tam yetki

Ajan, her tablo için ayrı `SELECT`, `INSERT`, `UPDATE`, `DELETE` politikalarını bu mantığa göre yazmalıdır.

---

## 7. Fazlı Yol Haritası

| Faz | İçerik | Çıktı |
|---|---|---|
| **Faz 0** | Next.js + Supabase proje kurulumu, Vercel pipeline, env değişkenleri, temel layout | Boş ama deploy edilebilir proje |
| **Faz 1** | Auth, roller, okul topluluğu oluşturma, davet akışı | Süper admin giriş yapıp okul oluşturabiliyor |
| **Faz 2** | Sınıf yönetimi + öğrenci yönetimi + Excel import | Öğrenciler sisteme toplu yüklenebiliyor |
| **Faz 3** | Kütüphane + aktif kitap seçimi | Kitap eklenip öğrenciye atanabiliyor |
| **Faz 4** | Günlük okuma takip ekranı (öğretmen) | Öğretmen günlük işaretleme yapabiliyor |
| **Faz 5** | Öğrenci profili + okuma geçmişi | Geçmiş veriler görüntülenebiliyor |
| **Faz 6** | İdare raporlama ekranı | Filtrelenebilir, sıralanabilir raporlar |
| **Faz 7** | Cilalama: mobil uyum, performans, hata yönetimi, export | Üretime hazır sürüm |

> Ajana her fazın sonunda çalışan, test edilebilir bir durum bırakması talimatı verilmelidir (örn. "Faz 2 sonunda: idareci Excel yükleyip öğrenci listesini görebilmeli").

---

## 8. İleriye Dönük Notlar (Şimdilik Kapsam Dışı ama Mimaride Düşünülmeli)

- Çoklu okul desteği zaten `school_id` ile mimaride var; ileride başka okullar da topluluğa eklenebilir
- Öğrenci tarafında giriş/portal şu an yok (sadece öğretmen/idareci/süper admin kullanıcı oluşturuyor) — ileride veli/öğrenci görünümü eklenebilir
- Bildirim/e-posta sistemi (örn. az okuyan öğrenciler için haftalık özet) ileri faz olarak not edilebilir
- Mobil uygulama ihtiyacı doğarsa aynı Supabase backend üzerine Flutter ile (geçmiş projelerindeki gibi) ayrı bir istemci eklenebilir

---

## 9. Ajana Verilecek Genel Talimat (Özet)

> "Next.js 14 (App Router, TypeScript) + Supabase + Tailwind/shadcn ile yukarıdaki veri modelini ve ekranları, Faz 0'dan başlayarak sırayla inşa et. Her faz sonunda çalışır bir demo bırak. RLS politikalarını Bölüm 6'daki role mantığına göre yaz. Excel importu için SheetJS kullan. Vercel'e deploy edilebilir şekilde yapılandır."
