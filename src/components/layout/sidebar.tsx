"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  BookOpen,
  Clock,
  GraduationCap,
  Users,
  Library,
  ClipboardCheck,
  BarChart3,
  UserCircle,
  Settings,
  Send,
  X,
  ClipboardList,
  MessageSquare,
  FileText,
  Sparkles,
  BookMarked,
  FolderKanban,
  FileSearch,
  Bell,
  CalendarDays,
  Shield,
  Monitor,
  Building,
  Archive,
  HelpCircle,
} from "lucide-react";
import type { Role } from "@/lib/types/database";

interface SidebarProps {
  role: Role;
  schoolName?: string | null;
  schoolFeatures?: {
    feature_attendance: boolean;
    feature_library: boolean;
    feature_cleanliness: boolean;
    feature_lesson_schedule: boolean;
    feature_bell: boolean;
  };
  onClose?: () => void;
}

const menuItems = [
  { href: "/dashboard", label: "Ana Sayfa", icon: BookOpen, roles: ["super_admin", "idareci", "ogretmen"] },
  { href: "/dashboard/admin/schools", label: "Okul Lisansları", icon: Building, roles: ["super_admin"] },
  { href: "/dashboard/classes", label: "Sınıflar", icon: GraduationCap, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/students", label: "Öğrenciler", icon: Users, roles: ["super_admin", "idareci", "ogretmen"] },
  { href: "/dashboard/library", label: "Kütüphane", icon: Library, roles: ["super_admin", "idareci", "ogretmen"], feature: "feature_library" },
  { href: "/dashboard/tracking", label: "Okuma Takip", icon: ClipboardCheck, roles: ["super_admin", "idareci", "ogretmen"], feature: "feature_library" },
  { href: "/dashboard/attendance", label: "Yoklama", icon: ClipboardList, roles: ["super_admin", "idareci", "ogretmen"], feature: "feature_attendance" },
  { href: "/dashboard/cleanliness", label: "Temiz Sınıf Puanlama", icon: Sparkles, roles: ["super_admin", "idareci", "ogretmen"], feature: "feature_cleanliness" },
  { href: "/dashboard/projects", label: "Proje Belirleme", icon: FolderKanban, roles: ["super_admin", "idareci", "ogretmen"] },
  { href: "/dashboard/projects/list", label: "Proje Listesi", icon: FileSearch, roles: ["super_admin", "idareci", "ogretmen"] },
  { href: "/dashboard/reports", label: "Raporlar", icon: BarChart3, roles: ["super_admin", "idareci", "ogretmen"] },
  { href: "/dashboard/subjects", label: "Ders Yönetimi", icon: BookMarked, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/admin/bell-schedule", label: "Ders Saatleri", icon: Bell, roles: ["super_admin", "idareci"], feature: "feature_bell" },
  { href: "/dashboard/admin/bell-control", label: "Zil Kontrol", icon: Bell, roles: ["super_admin", "idareci"], feature: "feature_bell" },
  { href: "/dashboard/admin/lesson-schedule", label: "Ders Programı", icon: CalendarDays, roles: ["super_admin", "idareci"], feature: "feature_lesson_schedule" },
  { href: "/dashboard/admin/duty-schedule", label: "Nöbet Programı", icon: Shield, roles: ["super_admin", "idareci"], feature: "feature_lesson_schedule" },
  { href: "/dashboard/admin/panel-settings", label: "Pano Ayarları", icon: Monitor, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/admin/quiz", label: "Soru Bankası", icon: HelpCircle, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/admin/archive", label: "Sezon Arşivleme", icon: Archive, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/admin/approvals", label: "Bekleyen Onaylar", icon: Clock, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/admin/users", label: "Kullanıcılar", icon: Settings, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/admin/invite", label: "Davet Gönder", icon: Send, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/admin/sms-settings", label: "SMS Ayarları", icon: MessageSquare, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/admin/sms-logs", label: "SMS Geçmişi", icon: FileText, roles: ["super_admin", "idareci"] },
];

export function Sidebar({ role, schoolName, schoolFeatures, onClose }: SidebarProps) {
  const pathname = usePathname();
  const filteredItems = menuItems.filter((item) => {
    if (!item.roles.includes(role)) return false;
    
    // Süper admin her özelliği görebilir
    if (role === "super_admin") return true;

    // Lisans kısıtlamalarını kontrol et
    if (schoolFeatures && item.feature) {
      return (schoolFeatures as any)[item.feature] !== false;
    }
    return true;
  });

  return (
    <aside className="h-full w-64 bg-sidebar text-sidebar-foreground flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-sidebar-accent">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="font-bold text-sm leading-tight">Okul Asistanı</h1>
            {schoolName && (
              <p className="text-xs text-sidebar-foreground/60 truncate max-w-[160px]">{schoolName}</p>
            )}
          </div>
        </div>
        {/* Close button only on mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
            aria-label="Menüyü kapat"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        <ul className="space-y-0.5">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors active:scale-95",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Profile Footer */}
      <div className="p-4 border-t border-sidebar-accent">
        <Link
          href="/dashboard/profile/me"
          onClick={onClose}
          className="flex items-center gap-2.5 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors py-1"
        >
          <UserCircle className="h-4 w-4 shrink-0" />
          <span>Profilim</span>
        </Link>
      </div>
    </aside>
  );
}
