/**
 * NexusPOS — Kiosk OS Build Configuration
 *
 * Produces a Linux AppImage/deb variant pre-configured for kiosk deployment:
 *  - executableName: nexuspos-kiosk
 *  - .desktop entry launches with --kiosk flag (fullscreen, no frame, locked)
 *  - Bundles kiosk setup scripts inside the package
 *  - systemd + openbox autostart included in extraResources
 *
 * Build command:
 *   npx electron-builder --config electron-builder.kiosk.js --linux
 */

const base = require('./electron-builder.config.js');

/** @type {import('electron-builder').Configuration} */
const kioskConfig = {
  ...base,

  appId: 'io.nexuspos.kiosk',
  productName: 'NexusPOS Kiosk',
  copyright: base.copyright,

  directories: {
    output: 'dist-packages/kiosk',
    buildResources: 'build-resources',
  },

  // Same files as base build
  files: base.files,

  // Extra resources include kiosk scripts
  extraResources: [
    ...base.extraResources,
  ],

  // ── LINUX KIOSK TARGETS ─────────────────────────────────
  linux: {
    target: [
      { target: 'AppImage', arch: ['x64', 'arm64'] },
      { target: 'deb',      arch: ['x64'] },
    ],
    // Different executable name to distinguish from normal build
    executableName: 'nexuspos-kiosk',
    category: 'Office',
    description: 'NexusPOS Kiosk — Point of Sale (Kiosk Mode)',
    // Desktop entry that auto-launches in kiosk mode
    desktop: {
      Name: 'NexusPOS Kiosk',
      Comment: 'Point of Sale — Kiosk Mode',
      // NOTE: Exec is NOT set here — electron-builder generates it from executableName above.
      // Setting Exec here causes: "Please specify executable name as linux.executableName"
      Categories: 'Office;Finance;',
      NoDisplay: 'false',
      StartupNotify: 'false',
      'X-GNOME-Autostart-enabled': 'true',
    },
  },

  deb: {
    ...base.deb,
    // Kiosk-specific post-install script to set up the environment
    afterInstall: 'scripts/kiosk/deb-postinstall.sh',
  },

  // No Windows or macOS targets for kiosk build
  win: undefined,
  mac: undefined,
  nsis: undefined,
  dmg: undefined,

  // Kiosk builds use the same packaging options
  compression: 'normal',
  removePackageScripts: true,
  nodeGypRebuild: false,
  npmRebuild: false,
  publish: null,
};

module.exports = kioskConfig;
