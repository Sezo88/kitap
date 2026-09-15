import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  const script = `#!/usr/bin/env bash
# ==============================================================================
# Pardus ETA 23 - Akilli Tahta Gunun Sorusu Ajani (v2.0 - Dismiss Korumali)
# Kilit Ekrani Uzerinde Calisan, Kullanici Kapattiginda Tekrar Rahatsiz Etmeyen Ajan
# ==============================================================================

CONFIG_FILE="/opt/tahta-quiz/config.env"
AGENT_PATH="/opt/tahta-quiz/agent.sh"
PID_FILE="/tmp/tahta-quiz-browser.pid"
DISMISS_FILE="/tmp/tahta-quiz-dismissed"
LOCK_FILE="/tmp/tahta-quiz-agent.lock"
BROWSER_MARK="tahta-quiz-profile"

# 1. Singleton Kilidi: Ayni anda birden fazla ajanin calismasini engeller
exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "[Tahta Quiz] UYARI: Ajan zaten arka planda calisiyor. Cikiliyor."
  exit 0
fi

if [ -f "$CONFIG_FILE" ]; then
  source "$CONFIG_FILE"
fi

OKUL_KODU="\${OKUL_KODU:-737454}"
API_BASE="\${API_BASE:-${origin}}"
SINIF="\${SINIF:-}"

echo "[Tahta Quiz] Ajan baslatildi. Okul: $OKUL_KODU, API: $API_BASE"

# X11 Ekran ve Yetki Tespiti
find_x11() {
  export DISPLAY="\${DISPLAY:-:0}"
  
  if [ -z "$XAUTHORITY" ]; then
    for auth in /var/run/lightdm/root/:0 /var/run/lightdm/*/:0 /home/*/.Xauthority /root/.Xauthority; do
      if [ -f "$auth" ]; then
        export XAUTHORITY="$auth"
        break
      fi
    done
  fi
  
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

# Tarayici calisiyor mu kontrolu (Hem PID hem proses ismi ile guvenli kontrol)
browser_running() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE" 2>/dev/null | tr -d ' \\r\\n')
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi

  if pgrep -f "$BROWSER_MARK" >/dev/null 2>&1 || pgrep -f "tahta-quiz" >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

# Tarayiciyi Kapatma
close_browser() {
  if browser_running; then
    echo "[Tahta Quiz] Pencere kapatiliyor..."
    pkill -f "$BROWSER_MARK" >/dev/null 2>&1 || true
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

  if browser_running; then
    return 0
  fi

  echo "[Tahta Quiz] Soru vakti! Tarayici aciliyor: $url"
  
  if [ "$browser" = "firefox" ]; then
    firefox --kiosk "$url" &
    echo $! > "$PID_FILE"
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
      --no-sandbox \\
      --ignore-certificate-errors \\
      --user-data-dir=/tmp/\${BROWSER_MARK} \\
      --app="$url" &
    echo $! > "$PID_FILE"
  fi
}

# Kendini guncelleme kontrolu
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
    START_TIME=$(echo "$RESP" | grep -o '"start_time":[^,}]*' | cut -d'"' -f4)
    TODAY_DATE=$(echo "$RESP" | grep -o '"today_date":[^,}]*' | cut -d'"' -f4)
    SEC_UNTIL=$(echo "$RESP" | grep -o '"seconds_until_window":[^,}]*' | cut -d':' -f2 | tr -d ' "')

    # Eger sunucudan tarih gelmezse yerel tarihi al
    if [ -z "$TODAY_DATE" ]; then
      TODAY_DATE=$(date +%Y-%m-%d)
    fi

    # Oturum Anahtari: Gun ve baslangic saati birlikteligi (Orn: 2026-09-15_08:30)
    WINDOW_KEY="\${TODAY_DATE}_\${START_TIME}"

    if [ "$IN_WINDOW" = "true" ] && [ "$ENABLED" = "true" ]; then

      # 1. Kullanici veya sistem bu pencereyi bugun zaten kapatti mi?
      if [ -f "$DISMISS_FILE" ] && [ "$(cat "$DISMISS_FILE" 2>/dev/null | tr -d ' \\r\\n')" = "$WINDOW_KEY" ]; then
        # Bu oturum icin kapatilmis; tekrar tekrar acip dersi bolme!
        sleep 15
        continue
      fi

      # 2. Tarayici su an acik ve calisiyor mu?
      if browser_running; then
        # Zaten acik, dokunma bekle
        sleep 5
        continue
      fi

      # 3. Daha once acilmisti ama artik calismiyor (Kullanici Alt+F4 yapti veya kapatti)
      if [ -f "$PID_FILE" ]; then
        echo "[Tahta Quiz] Pencere kapatildi. Bu soru oturumu icin tekrar acilmayacak."
        echo "$WINDOW_KEY" > "$DISMISS_FILE"
        rm -f "$PID_FILE"
        sleep 15
        continue
      fi

      # 4. Ilk defa aciliyor
      launch_browser "$QUIZ_URL"
      sleep 10

    else
      # Soru vakti disindayiz (saat doldu veya servis kapali)
      close_browser

      # Eger gun degismisse veya oturum bitmisse eski dismiss dosyasini temizle
      if [ -f "$DISMISS_FILE" ] && [ "$(cat "$DISMISS_FILE" 2>/dev/null | tr -d ' \\r\\n')" != "$WINDOW_KEY" ]; then
        rm -f "$DISMISS_FILE"
      fi

      # Baslama vaktine cok varsa biraz uyu (CPU tasarrufu)
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
