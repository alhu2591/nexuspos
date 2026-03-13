/**
 * NexusPOS — Electron Builder Configuration (Standard Build)
 * Cross-platform packaging: Windows (NSIS), Linux (AppImage/deb), macOS (DMG)
 */

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: 'io.nexuspos.app',
  productName: 'NexusPOS',
  copyright: 'Copyright © 2024 NexusPOS',

  directories: {
    output: 'dist-packages',
    buildResources: 'build-resources',
  },

  // ── FILES bundled into asar ──────────────────────────────
  files: [
    'packages/main/dist/main.js',
    'packages/main/dist/preload.js',
    'packages/renderer/dist/**',
    'packages/database/prisma/schema.prisma',
    // All node_modules needed at runtime (native + external deps)
    'node_modules/**',
    // Exclude wrong-platform Prisma engines
    '!node_modules/.prisma/client/libquery_engine-*',
    `node_modules/.prisma/client/libquery_engine-\${os}-\${arch}*`,
    // Exclude dev-only / large unnecessary dirs
    '!node_modules/electron/**',
    '!node_modules/.bin/**',
    '!node_modules/**/node_modules/electron/**',
    '!node_modules/electron-builder/**',
    '!node_modules/@electron/packager/**',
    '!**/*.ts',
    '!**/*.map',
    '!**/.git/**',
  ],

  // ── EXTRA RESOURCES (outside asar, accessible via process.resourcesPath) ──
  extraResources: [
    // Prisma schema for production db:push
    {
      from: 'packages/database/prisma/schema.prisma',
      to: 'prisma/schema.prisma',
    },
    // Prisma CLI for production migrations (runs via ELECTRON_RUN_AS_NODE=1)
    {
      from: 'node_modules/prisma/build',
      to: 'prisma-cli',
      filter: ['index.js'],
    },
    // Kiosk setup scripts (Linux only — harmless on other platforms)
    {
      from: 'scripts/kiosk',
      to: 'kiosk',
      filter: ['**/*'],
    },
  ],

  // ── WINDOWS ─────────────────────────────────────────────
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    requestedExecutionLevel: 'asInvoker',
    signingHashAlgorithms: null,
    sign: null,
  },

  nsis: {
    oneClick: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'NexusPOS',
    perMachine: false,
    runAfterFinish: true,
  },

  // ── LINUX ───────────────────────────────────────────────
  linux: {
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb',      arch: ['x64'] },
    ],
    category: 'Office',
    description: 'Enterprise Point of Sale System',
    desktop: {
      Name: 'NexusPOS',
      Comment: 'Point of Sale System',
      Categories: 'Office;Finance;',
      StartupNotify: 'true',
    },
  },

  deb: {
    depends: [
      'libgtk-3-0', 'libnotify4', 'libnss3', 'libxss1',
      'libxtst6', 'xdg-utils', 'libatspi2.0-0', 'libgbm1',
      'libasound2',
    ],
    packageCategory: 'misc',
    priority: 'optional',
    maintainer: 'NexusPOS <support@nexuspos.io>',
  },

  // ── MACOS ───────────────────────────────────────────────
  mac: {
    target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
    category: 'public.app-category.finance',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    identity: process.env.APPLE_IDENTITY || null,
    minimumSystemVersion: '10.15',
  },

  dmg: {
    title: 'NexusPOS Installer',
    contents: [
      { x: 130, y: 200 },
      { x: 410, y: 200, type: 'link', path: '/Applications' },
    ],
  },

  // ── OPTIONS ─────────────────────────────────────────────
  compression: 'normal',
  removePackageScripts: true,
  nodeGypRebuild: false,
  npmRebuild: false,
  publish: null,
};

module.exports = config;
