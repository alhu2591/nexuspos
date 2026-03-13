// esbuild bundle script for Electron main process
import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Packages that must NOT be bundled (native modules or Electron internals)
const external = [
  'electron',
  // Prisma needs to stay external (native bindings)
  '@prisma/client',
  '.prisma/client',
  'prisma',
  'prisma/build/index.js',
  // Node.js built-ins
  'path', 'fs', 'os', 'crypto', 'events', 'stream', 'util',
  'net', 'http', 'https', 'url', 'child_process', 'worker_threads',
  'buffer', 'assert', 'tty', 'zlib', 'readline',
  // Native addons
  'serialport', '@serialport/bindings-cpp',
  'node-hid', 'usb',
  // Electron modules
  'electron-updater',
];

async function bundle() {
  // Bundle main.ts
  await build({
    entryPoints: [resolve(__dirname, 'src/main.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: resolve(__dirname, 'dist/main.js'),
    external,
    sourcemap: true,
    minify: false,
    tsconfig: resolve(__dirname, 'tsconfig.json'),
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  // Bundle preload.ts separately (different context)
  await build({
    entryPoints: [resolve(__dirname, 'src/preload.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: resolve(__dirname, 'dist/preload.js'),
    external,
    sourcemap: true,
    tsconfig: resolve(__dirname, 'tsconfig.json'),
  });

  console.log('✅ Main process bundled successfully');
}

bundle().catch(err => {
  console.error('Bundle failed:', err);
  process.exit(1);
});
