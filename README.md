# O.Y.P. - Okul Yönetim Paneli

Okul yönetimi, öğrenci takip, yoklama, temiz sınıf puanlama, uzaktan zil kontrolü ve daha fazlası için kapsamlı bir web uygulaması.

**Canlı:** [oyp.vercel.app](https://oyp.vercel.app)

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

**Sıfırdan kurulum veya şema güncelleme** için `database-migration-combined.sql` dosyasını Supabase SQL Editor'da çalıştırın. Bu dosya en güncel haliyle tüm tabloları, RLS politikalarını, RPC tetikleyicilerini ve performans iyileştirmelerini içerir.

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
