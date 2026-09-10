export interface TeacherPermissionConfig {
  key: string;
  label: string;
  category: "Temel Modüller" | "Akademik & Program" | "İdare & Zil Sistemi";
  description: string;
  href: string;
  defaultAllowed: boolean;
}

export const MANAGEABLE_PERMISSIONS: TeacherPermissionConfig[] = [
  // Temel Modüller (Varsayılan Açık)
  {
    key: "students",
    label: "Öğrenci Listesi",
    category: "Temel Modüller",
    description: "Öğrenci listesini ve sınıf dağılımlarını görüntüleme",
    href: "/dashboard/students",
    defaultAllowed: true,
  },
  {
    key: "attendance",
    label: "Yoklama",
    category: "Temel Modüller",
    description: "Ders yoklaması alma ve geçmiş yoklamaları inceleme",
    href: "/dashboard/attendance",
    defaultAllowed: true,
  },
  {
    key: "library",
    label: "Kütüphane",
    category: "Temel Modüller",
    description: "Kitap kataloğu ve ödünç/iade işlemleri",
    href: "/dashboard/library",
    defaultAllowed: true,
  },
  {
    key: "tracking",
    label: "Okuma Takibi",
    category: "Temel Modüller",
    description: "Öğrencilerin kitap okuma takibini yapma",
    href: "/dashboard/tracking",
    defaultAllowed: true,
  },
  {
    key: "cleanliness",
    label: "Temiz Sınıf Puanlama",
    category: "Temel Modüller",
    description: "Haftalık sınıf temizlik ve düzen puanlaması",
    href: "/dashboard/cleanliness",
    defaultAllowed: true,
  },
  {
    key: "projects",
    label: "Proje İşlemleri",
    category: "Temel Modüller",
    description: "Öğrenci proje belirleme ve proje listeleri",
    href: "/dashboard/projects",
    defaultAllowed: true,
  },
  {
    key: "reports",
    label: "Raporlar",
    category: "Temel Modüller",
    description: "Okul ve sınıf bazlı okuma/yoklama raporları",
    href: "/dashboard/reports",
    defaultAllowed: true,
  },

  // Akademik & Program
  {
    key: "exam_schedule",
    label: "Ortak Sınavlar",
    category: "Akademik & Program",
    description: "Ortak sınav takvimi görüntüleme ve sınav tarihi belirleme",
    href: "/dashboard/exam-schedule",
    defaultAllowed: true,
  },
  {
    key: "duty_schedule",
    label: "Nöbet Programı",
    category: "Akademik & Program",
    description: "Öğretmen haftalık nöbet çizelgesini görüntüleme",
    href: "/dashboard/admin/duty-schedule",
    defaultAllowed: false,
  },
  {
    key: "lesson_schedule",
    label: "Ders Programı",
    category: "Akademik & Program",
    description: "Okulun genel ders programını ve saatlerini görüntüleme",
    href: "/dashboard/admin/lesson-schedule",
    defaultAllowed: false,
  },
  {
    key: "classes",
    label: "Sınıf Yönetimi",
    category: "Akademik & Program",
    description: "Tüm sınıf ve şube listelerini görme",
    href: "/dashboard/classes",
    defaultAllowed: false,
  },
  {
    key: "subjects",
    label: "Ders Yönetimi",
    category: "Akademik & Program",
    description: "Okulda tanımlı dersler listesi",
    href: "/dashboard/subjects",
    defaultAllowed: false,
  },
  {
    key: "quiz",
    label: "Soru Bankası",
    category: "Akademik & Program",
    description: "Günün sorusu ve akıllı tahta yarışma soruları",
    href: "/dashboard/admin/quiz",
    defaultAllowed: false,
  },

  // İdare & Zil Sistemi (Varsayılan Kapalı - İdare Açabilir)
  {
    key: "bell_schedule",
    label: "Ders & Zil Saatleri",
    category: "İdare & Zil Sistemi",
    description: "Ders giriş, çıkış ve teneffüs zamanlamaları",
    href: "/dashboard/admin/bell-schedule",
    defaultAllowed: false,
  },
  {
    key: "bell_control",
    label: "Zil Kontrol & Çalma",
    category: "İdare & Zil Sistemi",
    description: "Acil durum siren veya uzaktan zil çalma butonu",
    href: "/dashboard/admin/bell-control",
    defaultAllowed: false,
  },
  {
    key: "panel_settings",
    label: "Pano Ayarları",
    category: "İdare & Zil Sistemi",
    description: "Akıllı pano slaytları ve duyuru yönetimi",
    href: "/dashboard/admin/panel-settings",
    defaultAllowed: false,
  },
];

/**
 * Belirli bir menünün öğretmen tarafından erişilebilir olup olmadığını kontrol eder (İstemci & Sunucu Güvenli)
 */
export function isMenuAllowedForTeacher(
  menuHref: string,
  teacherPermissions: Record<string, boolean> = {}
): boolean {
  // Ana Sayfa her zaman herkese açıktır
  if (menuHref === "/dashboard") return true;

  const perm = MANAGEABLE_PERMISSIONS.find((p) => p.href === menuHref || (p.href !== "/dashboard" && menuHref.startsWith(p.href)));
  if (!perm) {
    // İdare paneli (kullanıcılar, davet, sms vb.) asla öğretmene açılmaz
    return false;
  }

  // İdare özel olarak belirlemişse onu kullan
  if (teacherPermissions[perm.key] !== undefined) {
    return teacherPermissions[perm.key];
  }

  // Belirlenmemişse varsayılan değer
  return perm.defaultAllowed;
}
