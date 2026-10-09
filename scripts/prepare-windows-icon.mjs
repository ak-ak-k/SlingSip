import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';

/** Reuse the native logo rasterizer at installer resolution without launching Electron. */
export async function prepareWindowsIcon(destination) {
  const result = await build({ entryPoints: ['electron/tray-icon.ts'], bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'capture-native-logo', setup(builder) {
      builder.onResolve({ filter: /^electron$/ }, () => ({ path: 'native-logo', namespace: 'native-logo' }));
      builder.onLoad({ filter: /.*/, namespace: 'native-logo' }, () => ({ contents: 'export const nativeImage = { createFromBuffer: bytes => bytes };' }));
    } }] });
  const rasterizer = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
  const png = rasterizer.trayIcon(256);
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  // ICO uses zero in its one-byte dimensions to represent 256 pixels.
  header[6] = 0; header[7] = 0;
  header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
  await writeFile(destination, Buffer.concat([header, png]));
}
