import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  const script = `#!/usr/bin/env bash
# ==============================================================================
# Pardus ETA 23 - Akilli Tahta Gunun Sorusu Ajani
# Otomatik Calisan, Kilit Ekrani Uzerinde Baslayan, Kendini Guncelleyen Servis
# ==============================================================================

CONFIG_FILE="/opt/tahta-quiz/config.env"
AGENT_PATH="/opt/tahta-quiz/agent.sh"
PID_FILE="/tmp/tahta-quiz-browser.pid"

if [ -f "$CONFIG_FILE" ]; then
  source "$CONFIG_FILE"
fi

OKUL_KODU="\${OKUL_KODU:-737454}"
API_BASE="\${API_BASE:-${origin}}"
SINIF="\${SINIF:-}"

echo "[Tahta Quiz] Ajan baslatildi. Okul: $OKUL_KODU, API: $API_BASE"

# X11 Ekran ve Yetki Tespiti (Ogretmen oturumu acilmadan kilit ekrani onunde calisabilmesi icin)
find_x11() {
  export DISPLAY="\${DISPLAY:-:0}"
  
  # LightDM / Pardus ETA kilit ekrani xauth dosyasini bul
  if [ -z "$XAUTHORITY" ]; then
    for auth in /var/run/lightdm/root/:0 /var/run/lightdm/*/:0 /home/*/.Xauthority /root/.Xauthority; do
      if [ -f "$auth" ]; then
        export XAUTHORITY="$auth"
        break
      fi
    done
  fi
  
  # Yerel erisimi ac
  xhost +local: >/dev/null 2>&1 || true
}

# Tarayici tespiti (Chromium, Chrome veya Firefox)
find_browser() {
  if command -v chromium >/dev/null 2>&1; then
    echo "chromium"
  elif command -v chromium-browser >/dev/null 2>&1; then
    echo "chromium-browser"
  elif command -v google-chrome >/dev/null 2>&1; then
    echo "google-chrome"
  elif command -v firefox >/dev/null 2>&1; then
    echo "firefox"
  else
    echo ""
  fi
}

# Kendini guncelleme kontrolu (Gunde 1 veya her 2 saatte bir uzaktan son kodu ceker)
check_self_update() {
  TMP_NEW="/tmp/agent_new.sh"
  if curl -sSf --max-time 10 "$API_BASE/api/tahta/agent.sh" -o "$TMP_NEW" 2>/dev/null; then
    if [ -s "$TMP_NEW" ] && ! cmp -s "$AGENT_PATH" "$TMP_NEW"; then
      echo "[Tahta Quiz] Yeni ajan surumu tespit edildi, guncelleniyor..."
      chmod +x "$TMP_NEW"
      mv "$TMP_NEW" "$AGENT_PATH"
      exec "$AGENT_PATH"
    fi
    rm -f "$TMP_NEW"
  fi
}

# Tarayiciyi Kapatma
close_browser() {
  if pgrep -f "tahta-quiz" >/dev/null 2>&1; then
    echo "[Tahta Quiz] Soru zamani bitti veya cevaplandi, tarayici kapatiliyor..."
    pkill -f "tahta-quiz" >/dev/null 2>&1 || true
  fi
  rm -f "$PID_FILE"
}

# Tarayiciyi Kiosk Modunda Baslatma
launch_browser() {
  local url="$1"
  local browser=$(find_browser)
  
  if [ -z "$browser" ]; then
    echo "[Tahta Quiz] HATA: Desteklenen bir tarayici (Chromium/Firefox) bulunamadi!"
    return 1
  fi

  find_x11

  # Eger zaten calisiyorsa tekrar baslatma
  if pgrep -f "tahta-quiz" >/dev/null 2>&1; then
    return 0
  fi

  echo "[Tahta Quiz] Soru vakti! Tarayici aciliyor: $url"
  
  # Ses ve dokunmatik ekrani aktif kil, tam ekran Kiosk olarak ac
  if [ "$browser" = "firefox" ]; then
    firefox --kiosk "$url" &
  else
    $browser \\
      --kiosk \\
      --start-fullscreen \\
      --noerrdialogs \\
      --disable-infobars \\
      --disable-features=TranslateUI \\
      --disable-session-crashed-bubble \\
      --autoplay-policy=no-user-gesture-required \\
      --check-for-update-interval=31536000 \\
      --app="$url" &
  fi

  echo $! > "$PID_FILE"
}

# ── ANA DONGU ────────────────────────────────────────────────────────────────
LAST_UPDATE_CHECK=0

while true; do
  NOW=$(date +%s)
  
  # 2 saatte bir kendini guncelle
  if [ $((NOW - LAST_UPDATE_CHECK)) -gt 7200 ]; then
    check_self_update
    LAST_UPDATE_CHECK=$NOW
  fi

  # Sunucudan durum bilgisini cek
  STATUS_URL="$API_BASE/api/tahta/status?okul_kodu=$OKUL_KODU"
  if [ -n "$SINIF" ]; then
    STATUS_URL="\${STATUS_URL}&sinif=\${SINIF}"
  fi

  RESP=$(curl -sSf --max-time 8 "$STATUS_URL" 2>/dev/null)
  
  if [ -n "$RESP" ]; then
    IN_WINDOW=$(echo "$RESP" | grep -o '"in_window":[^,}]*' | cut -d':' -f2 | tr -d ' "')
    ENABLED=$(echo "$RESP" | grep -o '"enabled":[^,}]*' | cut -d':' -f2 | tr -d ' "')
    QUIZ_URL=$(echo "$RESP" | grep -o '"quiz_url":[^,}]*' | cut -d'"' -f4)
    SEC_UNTIL=$(echo "$RESP" | grep -o '"seconds_until_window":[^,}]*' | cut -d':' -f2 | tr -d ' "')

    if [ "$IN_WINDOW" = "true" ] && [ "$ENABLED" = "true" ]; then
      launch_browser "$QUIZ_URL"
      sleep 10
    else
      close_browser
      # Eger baslama vaktine cok varsa biraz uyu (CPU tuketimini sifirla)
      if [ -n "$SEC_UNTIL" ] && [ "$SEC_UNTIL" -gt 60 ] 2>/dev/null; then
        SLEEP_TIME=$((SEC_UNTIL > 300 ? 120 : 30))
        sleep $SLEEP_TIME
      else
        sleep 20
      fi
    fi
  else
    # Sunucuya ulasilamazsa 30 sn bekle
    sleep 30
  fi
done
`;

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
