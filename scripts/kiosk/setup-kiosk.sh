#!/usr/bin/env bash
# NexusPOS — Linux Kiosk Setup Script
# Configures a Linux system for dedicated POS kiosk deployment
# Tested on: Ubuntu 22.04 LTS, Ubuntu 24.04 LTS, Debian 12, Raspberry Pi OS

set -euo pipefail

NEXUSPOS_USER="pos"
NEXUSPOS_HOME="/home/${NEXUSPOS_USER}"
# electron-builder installs to /opt/<productName> (spaces included)
NEXUSPOS_DIR="/opt/NexusPOS Kiosk"
NEXUSPOS_BIN="${NEXUSPOS_DIR}/nexuspos-kiosk"
NEXUSPOS_DATA="${NEXUSPOS_DIR}/data"
SERVICE_FILE="/etc/systemd/system/nexuspos.service"
LIGHTDM_CONF="/etc/lightdm/lightdm.conf.d/50-nexuspos.conf"

log()   { echo "[NexusPOS] $*"; }
error() { echo "[NexusPOS ERROR] $*" >&2; exit 1; }

# ── CHECK ROOT ────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "This script must be run as root"

# ── VALIDATE INSTALL PATH ────────────────────────────────
if [[ ! -f "${NEXUSPOS_BIN}" ]]; then
  error "NexusPOS Kiosk binary not found at '${NEXUSPOS_BIN}'.
  Please install the .deb package first:
    sudo dpkg -i nexuspos-kiosk_*.deb
  Or copy the AppImage to '${NEXUSPOS_BIN}' and chmod +x it."
fi

log "Starting NexusPOS kiosk setup..."

# ── CREATE POS USER ───────────────────────────────────────
log "Creating kiosk user: ${NEXUSPOS_USER}"
if ! id "${NEXUSPOS_USER}" &>/dev/null; then
  useradd \
    --create-home \
    --home-dir "${NEXUSPOS_HOME}" \
    --shell /bin/bash \
    --groups audio,video,input,plugdev,dialout \
    --comment "NexusPOS Kiosk User" \
    "${NEXUSPOS_USER}"
  passwd -l "${NEXUSPOS_USER}"  # Lock password (auto-login only)
fi

# Get actual UID (may not be 1001 on all systems)
POS_UID=$(id -u "${NEXUSPOS_USER}")
log "POS user UID: ${POS_UID}"

# ── INSTALL DEPENDENCIES ──────────────────────────────────
log "Installing dependencies..."
apt-get update -qq
apt-get install -y \
  xorg \
  openbox \
  lightdm \
  lightdm-gtk-greeter \
  unclutter \
  xdotool \
  x11-xserver-utils \
  fonts-noto \
  fonts-noto-cjk \
  libasound2 \
  libgtk-3-0 \
  libnss3 \
  libxss1 \
  libxtst6 \
  xdg-utils \
  libgbm1 \
  libdrm2 \
  cups \
  cups-client \
  printer-driver-escpr \
  udev

# ── CONFIGURE LIGHTDM AUTO-LOGIN ──────────────────────────
log "Configuring auto-login for ${NEXUSPOS_USER}..."
mkdir -p /etc/lightdm/lightdm.conf.d

cat > "${LIGHTDM_CONF}" << EOF
[Seat:*]
autologin-user=${NEXUSPOS_USER}
autologin-user-timeout=0
autologin-session=openbox
user-session=openbox
greeter-show-manual-login=false
greeter-hide-users=true
allow-guest=false
EOF

# ── CONFIGURE OPENBOX AUTOSTART ───────────────────────────
log "Configuring Openbox session..."
mkdir -p "${NEXUSPOS_HOME}/.config/openbox"

# Note: --no-sandbox is required for Chromium/Electron when running
# without user namespaces support (common in embedded/kiosk Linux)
cat > "${NEXUSPOS_HOME}/.config/openbox/autostart" << EOF
#!/bin/bash
# NexusPOS Openbox Autostart

# Disable screen blanking / DPMS
xset s off
xset -dpms
xset s noblank

# Hide cursor after 3 seconds of inactivity
unclutter -idle 3 -root &

# Set background color
xsetroot -solid "#1e293b" &

# Launch NexusPOS in kiosk mode
# --no-sandbox: required for Electron without kernel user namespaces
"${NEXUSPOS_BIN}" --kiosk --no-sandbox --disable-gpu-sandbox &
EOF

chmod +x "${NEXUSPOS_HOME}/.config/openbox/autostart"

# ── OPENBOX RC (disable window decorations, right-click menu) ──
cat > "${NEXUSPOS_HOME}/.config/openbox/rc.xml" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
  <resistance><strength>10</strength></resistance>
  <focus><focusNew>yes</focusNew><followMouse>no</followMouse></focus>
  <theme>
    <name>Clearlooks</name>
    <titleLayout>NLIMC</titleLayout>
  </theme>
  <desktops><number>1</number></desktops>
  <resize><drawContents>yes</drawContents></resize>
  <mouse>
    <dragThreshold>1</dragThreshold>
    <doubleClickTime>200</doubleClickTime>
    <context name="Desktop">
      <!-- Disable right-click menu on desktop -->
    </context>
  </mouse>
  <keyboard>
    <!-- Disable Ctrl+Alt+Backspace to kill X -->
    <keybind key="C-A-BackSpace"><action name="Execute"><command>true</command></action></keybind>
    <!-- Disable Alt+F4 close -->
    <keybind key="A-F4"><action name="Execute"><command>true</command></action></keybind>
    <!-- Disable F11 fullscreen toggle -->
    <keybind key="F11"><action name="Execute"><command>true</command></action></keybind>
  </keyboard>
  <applications>
    <application class="*">
      <maximized>true</maximized>
      <decor>no</decor>
      <focus>yes</focus>
    </application>
  </applications>
</openbox_config>
EOF

# ── INSTALL SYSTEMD SERVICE ────────────────────────────────
log "Installing systemd service..."

# Copy service template from bundled resources
SERVICE_TEMPLATE="$(dirname "$0")/nexuspos.service"
if [[ ! -f "${SERVICE_TEMPLATE}" ]]; then
  error "Service template not found at '${SERVICE_TEMPLATE}'"
fi

cp "${SERVICE_TEMPLATE}" "${SERVICE_FILE}"

# Patch dynamic UID (DBUS and XDG_RUNTIME_DIR depend on the actual user UID)
sed -i "s|POS_UID|${POS_UID}|g" "${SERVICE_FILE}"

systemctl daemon-reload
systemctl enable nexuspos.service

# ── CONFIGURE UDEV RULES (USB devices) ───────────────────
log "Configuring USB device permissions..."
cat > /etc/udev/rules.d/99-nexuspos.rules << 'EOF'
# NexusPOS Hardware Rules

# Receipt printers (Epson TM series)
SUBSYSTEM=="usb", ATTRS{idVendor}=="04b8", MODE="0666", GROUP="plugdev"

# Star Micronics printers
SUBSYSTEM=="usb", ATTRS{idVendor}=="0519", MODE="0666", GROUP="plugdev"

# Generic USB barcode scanners (HID)
SUBSYSTEM=="usb", ATTRS{bInterfaceClass}=="03", MODE="0666", GROUP="plugdev"

# Serial port access
SUBSYSTEM=="tty", ATTRS{idVendor}!="", MODE="0666", GROUP="dialout"

# USB to Serial adapters
SUBSYSTEM=="tty", KERNEL=="ttyUSB*", MODE="0666", GROUP="dialout"
SUBSYSTEM=="tty", KERNEL=="ttyACM*", MODE="0666", GROUP="dialout"
EOF

udevadm control --reload-rules
udevadm trigger

# ── CONFIGURE CUPS PRINTING ───────────────────────────────
log "Configuring CUPS for thermal printing..."
systemctl enable cups
systemctl start cups
usermod -aG lpadmin "${NEXUSPOS_USER}"

# ── CREATE DATA DIRECTORY ─────────────────────────────────
log "Creating application data directory..."
mkdir -p "${NEXUSPOS_DATA}"
chown -R "${NEXUSPOS_USER}:${NEXUSPOS_USER}" "${NEXUSPOS_DATA}"
chmod 750 "${NEXUSPOS_DATA}"

# ── DISABLE POWER MANAGEMENT ──────────────────────────────
log "Disabling sleep/suspend..."
systemctl mask sleep.target
systemctl mask suspend.target
systemctl mask hibernate.target
systemctl mask hybrid-sleep.target

# ── CONFIGURE WATCHDOG ────────────────────────────────────
log "Configuring system watchdog..."
# Only add if not already present (idempotent)
if ! grep -q "RuntimeWatchdogSec" /etc/systemd/system.conf; then
  cat >> /etc/systemd/system.conf << 'EOF'
RuntimeWatchdogSec=30s
ShutdownWatchdogSec=2min
EOF
fi

# ── KERNEL PARAMETERS ─────────────────────────────────────
log "Optimizing kernel parameters..."
cat > /etc/sysctl.d/99-nexuspos.conf << 'EOF'
# NexusPOS performance tuning
vm.swappiness=10
vm.dirty_ratio=60
vm.dirty_background_ratio=2
net.core.rmem_max=2097152
net.core.wmem_max=2097152
EOF

sysctl -p /etc/sysctl.d/99-nexuspos.conf

# ── FIX OWNERSHIP ─────────────────────────────────────────
chown -R "${NEXUSPOS_USER}:${NEXUSPOS_USER}" "${NEXUSPOS_HOME}"

log ""
log "╔══════════════════════════════════════╗"
log "║  NexusPOS Kiosk Setup Complete!      ║"
log "╚══════════════════════════════════════╝"
log ""
log "Installed binary : ${NEXUSPOS_BIN}"
log "Data directory   : ${NEXUSPOS_DATA}"
log "Kiosk user       : ${NEXUSPOS_USER} (UID ${POS_UID})"
log ""
log "Next step: sudo reboot"
log ""
log "After reboot, the system will:"
log "  • Auto-login as '${NEXUSPOS_USER}'"
log "  • Launch NexusPOS in kiosk/fullscreen mode"
log "  • Restart automatically on crash"
log ""
