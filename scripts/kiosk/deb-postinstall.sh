#!/bin/bash
# NexusPOS Kiosk — Debian post-install script
# Runs automatically after: dpkg -i nexuspos-kiosk.deb

set -euo pipefail

INSTALL_DIR="/opt/NexusPOS Kiosk"
KIOSK_SCRIPTS="${INSTALL_DIR}/resources/kiosk"

echo "[NexusPOS] Post-install: kiosk package installed"
echo "[NexusPOS] To set up the kiosk environment, run:"
echo "  sudo bash \"${KIOSK_SCRIPTS}/setup-kiosk.sh\""
echo ""
echo "[NexusPOS] Or start manually with:"
echo "  nexuspos-kiosk --kiosk"

# Copy systemd service to a reachable location
if [ -f "${KIOSK_SCRIPTS}/nexuspos.service" ]; then
  cp "${KIOSK_SCRIPTS}/nexuspos.service" /tmp/nexuspos-kiosk.service
  echo "[NexusPOS] Systemd service template copied to /tmp/nexuspos-kiosk.service"
fi

exit 0
