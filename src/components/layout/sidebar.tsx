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
} from "lucide-react";
import type { Role } from "@/lib/types/database";

interface SidebarProps {
  role: Role;
  schoolName?: string | null;
}

const menuItems = [
  { href: "/dashboard", label: "Ana Sayfa", icon: BookOpen, roles: ["super_admin", "idareci", "ogretmen"] },
  { href: "/dashboard/classes", label: "Sınıflar", icon: GraduationCap, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/students", label: "Öğrenciler", icon: Users, roles: ["super_admin", "idareci", "ogretmen"] },
  { href: "/dashboard/library", label: "Kütüphane", icon: Library, roles: ["super_admin", "idareci", "ogretmen"] },
  { href: "/dashboard/tracking", label: "Okuma Takip", icon: ClipboardCheck, roles: ["super_admin", "idareci", "ogretmen"] },
  { href: "/dashboard/reports", label: "Raporlar", icon: BarChart3, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/admin/approvals", label: "Bekleyen Onaylar", icon: Clock, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/admin/users", label: "Kullanıcılar", icon: Settings, roles: ["super_admin", "idareci"] },
  { href: "/dashboard/admin/invite", label: "Davet Gönder", icon: Send, roles: ["super_admin", "idareci"] },
];

export function Sidebar({ role, schoolName }: SidebarProps) {
  const pathname = usePathname();

  const filteredItems = menuItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="flex items-center gap-2 h-16 px-6 border-b border-sidebar-accent">
        <BookOpen className="h-6 w-6" />
        <div>
          <h1 className="font-bold text-sm">Okuma Takip</h1>
          {schoolName && <p className="text-xs text-sidebar-foreground/60 truncate max-w-[180px]">{schoolName}</p>}
        </div>
      </div>

      <nav className="flex-1 overflow-auto py-4 px-3">
        <ul className="space-y-1">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-sidebar-accent">
        <Link
          href="/dashboard/profile/me"
          className="flex items-center gap-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
        >
          <UserCircle className="h-4 w-4" />
          Profilim
        </Link>
      </div>
    </aside>
  );
}
