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
} from "lucide-react";
import type { Role } from "@/lib/types/database";

interface SidebarProps {
  role: Role;
  schoolName?: string | null;
  onClose?: () => void;
}

const menuItems = [
  { href: "/dashboard", label: "Ana Sayfa", icon: BookOpen, roles: ["super_admin", "idareci", "ogretmen"] },
  { href: "/dashboard/classes", label: "Sınıflar", icon: GraduationCap, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/students", label: "Öğrenciler", icon: Users, roles: ["super_admin", "idareci", "ogretmen"] },
  { href: "/dashboard/library", label: "Kütüphane", icon: Library, roles: ["super_admin", "idareci", "ogretmen"] },
  { href: "/dashboard/tracking", label: "Okuma Takip", icon: ClipboardCheck, roles: ["super_admin", "idareci", "ogretmen"] },
  { href: "/dashboard/attendance", label: "Yoklama", icon: ClipboardList, roles: ["super_admin", "idareci", "ogretmen"] },
  { href: "/dashboard/cleanliness", label: "Temiz Sınıf Puanlama", icon: Sparkles, roles: ["super_admin", "idareci", "ogretmen"] },
  { href: "/dashboard/reports", label: "Raporlar", icon: BarChart3, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/admin/approvals", label: "Bekleyen Onaylar", icon: Clock, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/admin/users", label: "Kullanıcılar", icon: Settings, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/admin/invite", label: "Davet Gönder", icon: Send, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/admin/sms-settings", label: "SMS Ayarları", icon: MessageSquare, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/admin/sms-logs", label: "SMS Geçmişi", icon: FileText, roles: ["super_admin", "idareci"] },
];

export function Sidebar({ role, schoolName, onClose }: SidebarProps) {
  const pathname = usePathname();
  const filteredItems = menuItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="h-full w-64 bg-sidebar text-sidebar-foreground flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-sidebar-accent">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <h1 className="font-bold text-sm leading-tight">Okuma Takip</h1>
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
