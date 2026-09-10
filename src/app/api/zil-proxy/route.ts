import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase URL veya KEY bulunamadı");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  return NextResponse.json({
    success: true,
    service: "Okul Zil Sistemi MEB Güvenli Proxy",
    status: "online",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const supabase = getSupabase();

    // 1. Okul Kodu ve PIN Doğrulama (MEB Ağında Supabase'e erişemeyen istemciler için)
    if (action === "resolve-school") {
      const { schoolCode, pin } = body;
      if (!schoolCode) {
        return NextResponse.json({ success: false, error: "Okul kodu boş olamaz." }, { status: 400 });
      }

      const { data: schoolsList, error: err } = await supabase.rpc(
        "resolve_school_code_secure",
        {
          p_code: String(schoolCode).trim().toUpperCase(),
          p_pin: pin ? String(pin).trim() : null,
        }
      );

      if (err || !schoolsList || schoolsList.length === 0) {
        return NextResponse.json({
          success: false,
          error: "Okul kodu veya PIN hatalı.",
        });
      }

      const school = schoolsList[0];
      const schoolId = school.school_id || school.id;
      const schoolName = school.school_name || school.name || "Okul";

      return NextResponse.json({
        success: true,
        schoolId,
        schoolName,
      });
    }

    // 2. Kalp Atışı (Heartbeat)
    if (action === "heartbeat") {
      const { schoolId, bellsEnabled } = body;
      if (!schoolId) {
        return NextResponse.json({ success: false, error: "Okul ID eksik." }, { status: 400 });
      }

      const { error: hbErr } = await supabase.rpc("bell_heartbeat", {
        p_school_id: schoolId,
        p_bell_active: bellsEnabled !== false,
      });

      if (hbErr) {
        return NextResponse.json({ success: false, error: hbErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
    }

    // 3. Bekleyen Komutları Sorgulama ve Onaylama (Poll & Acknowledge)
    if (action === "poll-commands") {
      const { schoolId } = body;
      if (!schoolId) {
        return NextResponse.json({ success: false, error: "Okul ID eksik." }, { status: 400 });
      }

      const { data: pendingCmds, error: cmdErr } = await supabase
        .from("bell_commands")
        .select("*")
        .eq("school_id", schoolId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (cmdErr) {
        return NextResponse.json({ success: false, error: cmdErr.message }, { status: 500 });
      }

      if (pendingCmds && pendingCmds.length > 0) {
        const cmdIds = pendingCmds.map((c: any) => c.id);
        // RPC üzerinden acknowledged yap
        await supabase.rpc("acknowledge_bell_commands", { p_cmd_ids: cmdIds });

        const latestCmd = pendingCmds[pendingCmds.length - 1];
        const diff = Date.now() - new Date(latestCmd.triggered_at || latestCmd.created_at).getTime();
        const shouldPlay = diff < 120000; // Son 2 dakika

        return NextResponse.json({
          success: true,
          commands: pendingCmds,
          latestCommand: shouldPlay ? latestCmd : null,
        });
      }

      return NextResponse.json({
        success: true,
        commands: [],
        latestCommand: null,
      });
    }

    return NextResponse.json({ success: false, error: "Bilinmeyen eylem (action)" }, { status: 400 });
  } catch (err: any) {
    console.error("Zil proxy hatası:", err);
    return NextResponse.json({ success: false, error: err.message || "Proxy sunucu hatası" }, { status: 500 });
  }
}
