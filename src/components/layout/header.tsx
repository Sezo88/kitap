"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";

interface HeaderProps {
  fullName?: string | null;
  schoolName?: string | null;
  onMenuClick?: () => void;
}

export function Header({ fullName, schoolName, onMenuClick }: HeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 border-b bg-background flex items-center justify-between px-3 gap-3 sticky top-0 z-20">
      {/* Left: hamburger + title on mobile */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-muted transition-colors shrink-0"
          aria-label="Menüyü aç"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* App name on mobile only (hidden on desktop since sidebar shows it) */}
        <div className="flex items-center gap-1.5 lg:hidden min-w-0">
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-sm truncate text-primary">Okuma Takip</span>
          {schoolName && (
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">· {schoolName}</span>
          )}
        </div>
        {/* Welcome on desktop */}
        <span className="text-sm text-muted-foreground hidden lg:block truncate">
          Hoş geldin{fullName ? `, ${fullName}` : ""}
        </span>
      </div>

      {/* Right: logout */}
      <Button variant="ghost" size="sm" onClick={handleLogout} className="shrink-0 gap-1.5">
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Çıkış</span>
      </Button>
    </header>
  );
}
