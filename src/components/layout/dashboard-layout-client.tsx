"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils/cn";
import type { Role } from "@/lib/types/database";

interface Props {
  role: Role;
  fullName?: string | null;
  schoolName?: string | null;
  children: ReactNode;
}

export function DashboardLayoutClient({ role, fullName, schoolName, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar role={role} schoolName={schoolName} />
      <div className="lg:pl-64">
        <Header fullName={fullName} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 transform transition-transform lg:hidden",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar role={role} schoolName={schoolName} />
        </div>

        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
