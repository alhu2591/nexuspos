/**
 * NexusPOS — Electron Builder Configuration
 * Cross-platform packaging: Windows (NSIS), Linux (AppImage/deb), macOS (DMG)
 */

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: 'io.nexuspos.app',
  productName: 'NexusPOS',
  copyright: 'Copyright © 2024 NexusPOS',

  // ── ENTRY POINT ─────────────────────────────────────────
  // Matches the "main" field in package.json
  // electron-builder will look for this inside the asar

  // ── DIRECTORIES ─────────────────────────────────────────
  directories: {
    output: 'dist-packages',
    buildResources: 'build-resources',
  },

  // ── FILES to bundle into asar ───────────────────────────
  files: [
    // Bundled main process (all deps inlined by esbuild, no node_modules needed)
    'packages/main/dist/main.js',
    'packages/main/dist/preload.js',
    // Renderer
    'packages/renderer/dist/**',
    // Prisma JS client (kept external from esbuild, must be in asar)
    'node_modules/@prisma/client/**',
    // Prisma native engine for target platform
    'packages/database/prisma/schema.prisma',
    'node_modules/.prisma/**',
    '!node_modules/.prisma/client/libquery_engine-*',
    `node_modules/.prisma/client/libquery_engine-\${os}-\${arch}*`,
    // Electron-updater (kept external, needs node_modules)
    'node_modules/electron-updater/**',
    'node_modules/builder-util-runtime/**',
    // Exclude noise
    '!**/*.ts',
    '!**/*.map',
    '!**/.git/**',
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
    },
  },

  deb: {
    depends: ['libgtk-3-0', 'libnotify4', 'libnss3', 'libxss1', 'libxtst6', 'xdg-utils', 'libatspi2.0-0', 'libgbm1'],
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
