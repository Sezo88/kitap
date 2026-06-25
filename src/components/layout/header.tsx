"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
import { useRouter } from "next/navigation";

interface HeaderProps {
  fullName?: string | null;
  onMenuClick?: () => void;
}

export function Header({ fullName, onMenuClick }: HeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-16 border-b bg-background flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md hover:bg-muted cursor-pointer"
          aria-label="Menü"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm text-muted-foreground hidden sm:block">
          Hoş geldin{fullName ? `, ${fullName}` : ""}
        </span>
      </div>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut className="h-4 w-4 mr-2" />
        Çıkış
      </Button>
    </header>
  );
}
