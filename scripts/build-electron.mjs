import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

export async function buildElectron() {
  const options = {
    bundle: true,
    platform: 'node',
    target: 'node22',
    external: ['electron'],
    sourcemap: true,
    logLevel: 'info',
  };
  // electron-store's dependencies use CommonJS Node built-ins. Load them natively from ESM.
  // Neither output is replaced when either source fails to compile.
  const results = await Promise.all([
    build({ ...options, write: false, external: ['electron', 'electron-store', 'electron-updater', 'js-yaml'], entryPoints: ['electron/main.ts'], outfile: 'dist/electron/main.mjs', format: 'esm' }),
    build({ ...options, write: false, entryPoints: ['electron/preload.ts'], outfile: 'dist/electron/preload.cjs', format: 'cjs' }),
  ]);
  await mkdir('dist/electron', { recursive: true });
  await Promise.all(results.flatMap(result => result.outputFiles.map(file => writeFile(file.path, file.contents))));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildElectron();
}
