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
        return NextResponse.json({ success: false, error: "Okul kodu veya adı boş olamaz." }, { status: 400 });
      }

      const cleanCode = String(schoolCode).trim();
      const cleanPin = pin ? String(pin).trim() : null;

      // 1. Okulu Esnek Ara (Okul Kodu, UUID veya Okul Adı)
      let school: any = null;

      // a) Önce code ile tam eşleşme ara (örn: 737454)
      const { data: byCode } = await supabase
        .from("schools")
        .select("id, name, code, bell_api_pin_hash, pano_pin, license_expires_at, feature_bell")
        .eq("code", cleanCode.toUpperCase())
        .limit(1);

      if (byCode && byCode.length > 0) {
        school = byCode[0];
      }

      // b) Bulunamadıysa UUID ile ara
      if (!school && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanCode)) {
        const { data: byId } = await supabase
          .from("schools")
          .select("id, name, code, bell_api_pin_hash, pano_pin, license_expires_at, feature_bell")
          .eq("id", cleanCode)
          .limit(1);
        if (byId && byId.length > 0) {
          school = byId[0];
        }
      }

      // c) Bulunamadıysa Okul İsmi ile ara
      if (!school) {
        const { data: byName } = await supabase
          .from("schools")
          .select("id, name, code, bell_api_pin_hash, pano_pin, license_expires_at, feature_bell")
          .ilike("name", `%${cleanCode}%`)
          .limit(1);
        if (byName && byName.length > 0) {
          school = byName[0];
        }
      }

      if (!school) {
        return NextResponse.json({
          success: false,
          error: `'${cleanCode}' bilgisine ait okul bulunamadı. Lütfen web panelindeki Okul Kodunu (örn: 737454) girin.`,
        });
      }

      // 2. PIN Doğrulama
      let pinValid = false;
      const hasPinHash = Boolean(school.bell_api_pin_hash && school.bell_api_pin_hash.trim().length > 0);

      if (!hasPinHash) {
        // Okul için PIN belirlenmemiş -> Girişe izin ver
        pinValid = true;
      } else {
        if (!cleanPin) {
          return NextResponse.json({
            success: false,
            error: `Bu okul (${school.name}) için güvenlik PIN'i belirlenmiştir. Lütfen zil uygulamasında Zil API PIN alanını da doldurun.`,
          });
        }

        // Pano PIN'i ile eşleşiyorsa izin ver
        if (school.pano_pin && cleanPin === school.pano_pin) {
          pinValid = true;
        }

        // resolve_school_code_secure RPC ile dene
        if (!pinValid) {
          const { data: rpcList } = await supabase.rpc(
            "resolve_school_code_secure",
            {
              p_code: school.code,
              p_pin: cleanPin,
            }
          );
          if (rpcList && rpcList.length > 0) {
            pinValid = true;
          }
        }
      }

      if (!pinValid) {
        return NextResponse.json({
          success: false,
          error: `Okul bulundu (${school.name}), ancak girdiğiniz PIN eşleşmedi. Lütfen web panelinde belirlediğiniz PIN'i girin.`,
        });
      }

      return NextResponse.json({
        success: true,
        schoolId: school.id,
        schoolName: school.name,
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
