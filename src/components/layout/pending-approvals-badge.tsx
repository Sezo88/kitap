"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/types/database";

interface Props {
  role: Role;
  schoolId?: string;
}

export function PendingApprovalsBadge({ role, schoolId }: Props) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (role !== "idareci" && role !== "super_admin") return;

    const supabase = createClient();
    let query = supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending");
    if (role === "idareci" && schoolId) {
      query = query.eq("school_id", schoolId);
    }

    query.then(({ count: c }) => {
      if (c) setCount(c);
    });
  }, [role, schoolId]);

  if (count === 0) return null;

  return (
    <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 animate-pulse">
      {count}
    </span>
  );
}
