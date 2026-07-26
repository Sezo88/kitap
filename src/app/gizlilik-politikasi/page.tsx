import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gizlilik Politikası — Okul Yönetim Paneli",
  description:
    "Okul Yönetim Paneli (OYP) gizlilik politikası — hangi verilerin toplandığı, nasıl kullanıldığı ve korunduğu hakkında bilgi.",
};

export default function GizlilikPolitikasiPage() {
  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Gizlilik Politikası</h1>
      <p className="text-muted-foreground mb-6">
        Son güncelleme: 26 Temmuz 2026
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Toplanan Veriler</h2>
        <p className="text-muted-foreground">
          Okul Yönetim Paneli (&quot;OYP&quot;), aşağıdaki verileri
          kullanıcıların hesap oluşturması ve hizmetin sunulması amacıyla
          toplar:
        </p>
        <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
          <li>E-posta adresi (giriş ve hesap doğrulama için)</li>
          <li>Ad-soyad ve rol bilgisi (öğretmen / idareci tanımlaması)</li>
          <li>Okul adı ve ilişkili sınıf/öğrenci bilgileri</li>
          <li>Öğrenci okuma takip verileri (okunan kitap, sayfa sayısı)</li>
          <li>Yoklama, temizlik ve nöbet kayıtları</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">
          2. Verilerin Kullanım Amacı
        </h2>
        <p className="text-muted-foreground">
          Toplanan veriler yalnızca aşağıdaki amaçlar doğrultusunda
          kullanılmaktadır:
        </p>
        <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
          <li>Kullanıcı kimlik doğrulaması ve oturum yönetimi</li>
          <li>Okul yönetim işlevlerinin yerine getirilmesi (kitap takibi, yoklama, nöbet çizelgesi, zil yönetimi)</li>
          <li>Öğretmen ve idarecilere raporlama sunulması</li>
          <li>Lisans ve yetkilendirme kontrolü</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">
          3. Veri Paylaşımı
        </h2>
        <p className="text-muted-foreground">
          OYP, kullanıcı verilerini üçüncü taraflarla{" "}
          <strong>paylaşmaz, satmaz veya kiralamaz.</strong> Veriler yalnızca
          hizmetin sunulması için gerekli altyapı sağlayıcıları (Supabase —
          veritabanı ve kimlik doğrulama hizmeti) üzerinde, şifreli olarak
          saklanır.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. Veri Güvenliği</h2>
        <p className="text-muted-foreground">
          Tüm veriler HTTPS üzerinden şifreli olarak iletilir. Veritabanı
          erişimi Row-Level Security (RLS) politikaları ile korunur — her
          kullanıcı yalnızca yetkilendirildiği okulun verilerine erişebilir.
          Kimlik doğrulama, Supabase Auth altyapısı üzerinden güvenli token
          tabanlı oturum yönetimi ile sağlanır.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Hedef Kitle</h2>
        <p className="text-muted-foreground">
          Bu uygulama öğretmenler ve okul idarecileri için tasarlanmıştır. 13
          yaş altı çocuklara yönelik{" "}
          <strong>değildir</strong>. Uygulama, öğrencilerin değil
          öğretmen/idarecilerin kullanımına yöneliktir.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. İletişim</h2>
        <p className="text-muted-foreground">
          Gizlilik politikası ile ilgili sorularınız için e-posta adresimiz
          üzerinden bizimle iletişime geçebilirsiniz. İletişim bilgileri
          uygulama açıklamasında yer almaktadır.
        </p>
      </section>
    </main>
  );
}
