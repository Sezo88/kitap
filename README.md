# Okul Asistanı

Okul yönetimi, öğrenci takip, yoklama, temiz sınıf puanlama ve daha fazlası için kapsamlı bir web uygulaması.

**Canlı:** [kitapokuma.vercel.app](https://kitapokuma.vercel.app)

## Teknolojiler

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Veritabanı:** Supabase (PostgreSQL + Auth + RLS)
- **Stil:** Tailwind CSS + shadcn/ui
- **Dağıtım:** Vercel

## Başlangıç

### 1. Bağımlılıkları Kur

```bash
npm install
```

### 2. Ortam Değişkenleri

`.env.local` dosyası oluştur:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. Veritabanı Kurulumu

**Yeni kurulum** için `database-migration-v2.sql` dosyasını Supabase SQL Editor'da çalıştırın. Bu dosya tüm tabloları, RLS politikalarını ve fonksiyonları içerir.

**Mevcut veritabanına** yeni özellikler eklemek için ilgili `patch-*.sql` dosyalarını sırayla çalıştırın:

| Dosya | Açıklama |
|-------|----------|
| `database-migration.sql` | İlk kurulum (v1) |
| `patch-rol-trigger-fix.sql` | Rol atama düzeltmesi |
| `patch-rls-recursion-fix.sql` | RLS sonsuz döngü düzeltmesi |
| `patch-okul-onay-sistemi.sql` | Okul kodu + onay sistemi |
| `patch-okul-kodu-ve-onay.sql` | Okul kodu benzersizlik |
| `patch-ogretmen-ogrenci-ekleme.sql` | Öğretmen öğrenci ekleme yetkisi |
| `patch-veli-sahip.sql` | Veli telefon sahiplik alanları |
| `database-migration-v2.sql` | Konsolide şema (tüm tabloları içerir) |

### 4. Geliştirme Sunucusu

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) adresini tarayıcıda açın.

## Modüller

- **Öğrenci Yönetimi** — Öğrenci CRUD, veli telefon bilgileri, Excel şablon indirme/yükleme
- **Kütüphane** — Kitap yönetimi ve öğrencilere kitap atama
- **Okuma Takip** — Günlük okuma/kitap getirme takibi
- **Yoklama** — Ders saati bazlı yoklama, SMS bildirimi
- **Temiz Sınıf** — 5 kriter üzerinden günlük sınıf puanlama, haftalık kazanan
- **Proje Takip** — Ders bazlı proje atamaları
- **Raporlar** — Okuma, yoklama ve temizlik raporları
- **Yönetim** — Kullanıcı yönetimi, onay sistemi, SMS ayarları

## Proje Yapısı

```
src/
├── app/
│   ├── dashboard/       # Ana uygulama sayfaları
│   │   ├── admin/       # İdareci paneli
│   │   ├── attendance/  # Yoklama
│   │   ├── cleanliness/ # Temiz sınıf
│   │   ├── reports/     # Raporlar
│   │   └── ...
│   └── api/             # API rotaları (SMS vb.)
├── components/          # React bileşenleri
├── lib/                 # Yardımcı fonksiyonlar, tipler, Supabase istemcisi
└── ...
```
