// NexusPOS — Electron Builder Configuration
// Cross-platform packaging: Windows (NSIS), Linux (AppImage/deb/rpm), macOS (DMG)

import type { Configuration } from 'electron-builder';

const config: Configuration = {
  appId: 'io.nexuspos.app',
  productName: 'NexusPOS',
  copyright: 'Copyright © 2024 NexusPOS',
  buildVersion: process.env.BUILD_NUMBER ?? '1',

  // ── DIRECTORIES ─────────────────────────────────────────
  directories: {
    output: 'dist-packages',
    buildResources: 'build-resources',
  },

  // ── FILES ───────────────────────────────────────────────
  files: [
    'packages/main/dist/**',
    'packages/renderer/dist/**',
    'packages/database/prisma/schema.prisma',
    'node_modules/.prisma/**',
    '!node_modules/.prisma/client/libquery_engine-*',
    'node_modules/.prisma/client/libquery_engine-${os}-${arch}*',
    '!**/*.ts',
    '!**/*.map',
    '!**/.git/**',
    '!**/node_modules/*/{README,readme,CHANGELOG}.*',
    '!**/node_modules/.bin/**',
  ],

  // ── ASSETS ──────────────────────────────────────────────
  extraResources: [
    {
      from: 'build-resources/assets',
      to: 'assets',
      filter: ['**/*'],
    },
    {
      from: 'packages/database/prisma',
      to: 'prisma',
      filter: ['schema.prisma'],
    },
  ],

  // ── METADATA ────────────────────────────────────────────
  publish: null, // Disable auto-update for now

  // ── WINDOWS ─────────────────────────────────────────────
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64', 'ia32'],
      },
      {
        target: 'portable',
        arch: ['x64'],
      },
    ],
    icon: 'build-resources/icons/icon.ico',
    requestedExecutionLevel: 'asInvoker',
    // Code signing (configure via env vars)
    certificateSubjectName: process.env.WINDOWS_CERT_SUBJECT,
    signingHashAlgorithms: ['sha256'],
    signAndEditExecutable: true,
  },

  nsis: {
    oneClick: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'build-resources/icons/installer.ico',
    uninstallerIcon: 'build-resources/icons/uninstaller.ico',
    installerHeader: 'build-resources/installer-header.bmp',
    installerSidebar: 'build-resources/installer-sidebar.bmp',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'NexusPOS',
    include: 'build-resources/installer.nsh',
    perMachine: false,
    runAfterFinish: true,
    menuCategory: 'NexusPOS',
    deleteAppDataOnUninstall: false,
  },

  // ── LINUX ───────────────────────────────────────────────
  linux: {
    target: [
      {
        target: 'AppImage',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'deb',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'rpm',
        arch: ['x64'],
      },
    ],
    icon: 'build-resources/icons',
    category: 'Office',
    description: 'Enterprise Point of Sale System',
    desktop: {
      Name: 'NexusPOS',
      Comment: 'Point of Sale System',
      Categories: 'Office;Finance;',
      Keywords: 'POS;retail;sales;',
      StartupWMClass: 'nexuspos',
    },
    // Allow USB/serial access
    extraFiles: [
      {
        from: 'scripts/kiosk',
        to: 'kiosk',
        filter: ['*.sh', '*.service', '*.conf'],
      },
    ],
  },

  deb: {
    depends: [
      'libgtk-3-0',
      'libnotify4',
      'libnss3',
      'libxss1',
      'libxtst6',
      'xdg-utils',
      'libatspi2.0-0',
      'libgbm1',
    ],
    recommends: [
      'cups',
      'cups-client',
    ],
    packageCategory: 'misc',
    priority: 'optional',
    maintainer: 'NexusPOS Team <support@nexuspos.io>',
    afterInstall: 'build-resources/linux/postinst',
    afterRemove: 'build-resources/linux/postrm',
  },

  rpm: {
    depends: [
      'gtk3',
      'nss',
      'xdg-utils',
      'libXScrnSaver',
      'at-spi2-atk',
    ],
    packageRequires: [
      'cups',
    ],
  },

  // ── MACOS ───────────────────────────────────────────────
  mac: {
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64', 'universal'],
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64'],
      },
    ],
    icon: 'build-resources/icons/icon.icns',
    category: 'public.app-category.finance',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build-resources/entitlements.mac.plist',
    entitlementsInherit: 'build-resources/entitlements.mac.plist',
    // Code signing via env vars
    identity: process.env.APPLE_IDENTITY,
    notarize: process.env.APPLE_NOTARIZE === 'true'
      ? {
          teamId: process.env.APPLE_TEAM_ID ?? '',
          appleApiKey: process.env.APPLE_API_KEY ?? '',
          appleApiKeyId: process.env.APPLE_API_KEY_ID ?? '',
          appleApiIssuer: process.env.APPLE_API_ISSUER ?? '',
        }
      : false,
    minimumSystemVersion: '10.15',
  },

  dmg: {
    title: 'NexusPOS Installer',
    icon: 'build-resources/icons/icon.icns',
    background: 'build-resources/dmg-background.png',
    window: {
      width: 600,
      height: 400,
    },
    contents: [
      { x: 130, y: 200 },
      { x: 410, y: 200, type: 'link', path: '/Applications' },
    ],
  },

  // ── PERFORMANCE OPTIMIZATIONS ────────────────────────────
  compression: 'maximum',
  removePackageScripts: true,
  nodeGypRebuild: false,
  npmRebuild: true,

  // ── HOOKS ───────────────────────────────────────────────
  afterSign: 'scripts/afterSign.js',
};

export default config;
