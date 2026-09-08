import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  const script = `#!/usr/bin/env bash
# ==============================================================================
# Pardus ETA 23 - Akilli Tahta Gunun Sorusu Tek Tikla Kurulum Betigi
# Kullanim: curl -sL ${origin}/api/tahta/kurulum.sh | sudo bash -s OKUL_KODU [SINIF_ADI]
# Ornek:    curl -sL ${origin}/api/tahta/kurulum.sh | sudo bash -s 737454
# ==============================================================================

set -e

if [ "\$(id -u)" -ne 0 ]; then
  echo "HATA: Bu kurulum betigi root (sudo) yetkisiyle calistirilmalidir!"
  echo "Lutfen su sekilde calistirin: curl -sL ${origin}/api/tahta/kurulum.sh | sudo bash -s OKUL_KODU"
  exit 1
fi

OKUL_KODU="\$1"
SINIF="\$2"

if [ -z "$OKUL_KODU" ]; then
  echo "Lutfen okul kodunuzu parametre olarak girin!"
  echo "Ornek: curl -sL ${origin}/api/tahta/kurulum.sh | sudo bash -s 737454"
  exit 1
fi

echo "========================================================"
echo "🎯 Pardus ETA 23 - Akilli Tahta Gunun Sorusu Kuruluyor..."
echo "Okul Kodu: $OKUL_KODU"
if [ -n "$SINIF" ]; then
  echo "Sabit Sinif: $SINIF"
fi
echo "========================================================"

# Gerekli klasor
INSTALL_DIR="/opt/tahta-quiz"
mkdir -p "$INSTALL_DIR"

# Konfigurasyon dosyasi
cat <<EOF > "$INSTALL_DIR/config.env"
OKUL_KODU="$OKUL_KODU"
API_BASE="${origin}"
SINIF="$SINIF"
EOF
chmod 600 "$INSTALL_DIR/config.env"

# Ajani indir
echo "Ajan betigi sunucudan indiriliyor..."
curl -sSf "${origin}/api/tahta/agent.sh" -o "$INSTALL_DIR/agent.sh"
chmod +x "$INSTALL_DIR/agent.sh"

# Gerekli paket kontrolu (curl, xhost, chromium)
echo "Gerekli paketler kontrol ediliyor..."
if ! command -v curl >/dev/null 2>&1 || ! command -v xhost >/dev/null 2>&1; then
  apt-get update -y && apt-get install -y curl x11-xserver-utils
fi

# Systemd Servisi Olustur
echo "Systemd servisi yapilandiriliyor..."
cat <<EOF > /etc/systemd/system/tahta-quiz.service
[Unit]
Description=Pardus ETA 23 Akilli Tahta Gunun Sorusu Ajani
After=graphical.target display-manager.service network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Environment=DISPLAY=:0
ExecStart=/opt/tahta-quiz/agent.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=graphical.target
EOF

# Servisi aktif et ve baslat
systemctl daemon-reload
systemctl enable tahta-quiz.service
systemctl restart tahta-quiz.service

echo ""
echo "========================================================"
echo "✅ TEBRIKLER! Akilli Tahta Kurulumu Basariyla Tamamlandi!"
echo "Servis Durumu: Aktif (Calisiyor)"
echo "Bundan sonra tahtaya tekrar kurulum yapmaniz GEREKMEZ."
echo "Tum saat ve soru ayarlari web panelinizden otomatik cekilecektir."
echo "========================================================"
`;

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
