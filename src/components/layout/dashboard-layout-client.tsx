"use client";

import { useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import type { Role } from "@/lib/types/database";

interface Props {
  role: Role;
  fullName?: string | null;
  schoolName?: string | null;
  children: ReactNode;
}

export function DashboardLayoutClient({ role, fullName, schoolName, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── DESKTOP: static sidebar ───────────────────────── */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64">
        <Sidebar role={role} schoolName={schoolName} />
      </div>

      {/* ── MOBILE: backdrop + drawer ─────────────────────── */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeSidebar}
        aria-hidden="true"
      />
      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar role={role} schoolName={schoolName} onClose={closeSidebar} />
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────────── */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <Header
          fullName={fullName}
          schoolName={schoolName}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 p-3 sm:p-4 lg:p-6 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
