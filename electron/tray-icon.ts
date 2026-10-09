import { nativeImage } from 'electron';
import { deflateSync } from 'node:zlib';

/** Raster adaptation of public/slingsip-logo.svg, also used by native window icons. */
export function trayIcon() {
  const size = 32;
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let coverage = 0; const colour = [0, 0, 0];
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      // Work in the SVG's 64-unit viewBox; supersample the 32 px native image.
      const px = (x + (sx + .5) / 4) * 2; const py = (y + (sy + .5) / 4) * 2;
      const angle = Math.atan2(py - 32, px - 32) * 180 / Math.PI;
      const arc = Math.abs(Math.hypot(px - 32, py - 32) - 25) <= 1.75 && angle >= -40 && angle <= 145
        || Math.hypot(px - 51.151, py - 15.930) <= 1.75 || Math.hypot(px - 11.521, py - 46.339) <= 1.75;
      const drop = py >= 10 && py < 36 ? Math.abs(px - 32) <= (py - 10) * 12 / 26
        : py >= 36 && (px - 32) ** 2 + (py - 36) ** 2 <= 144;
      const smileAngle = Math.atan2(py - 36, px - 32) * 180 / Math.PI;
      const smile = Math.abs(Math.hypot(px - 32, py - 36) - 6) <= 1.25 && smileAngle >= 90 && smileAngle <= 180
        || Math.hypot(px - 26, py - 36) <= 1.25 || Math.hypot(px - 32, py - 42) <= 1.25;
      const endpoint = Math.hypot(px - 51.151, py - 15.930) <= 3;
      const sample = endpoint ? [238, 132, 144] : drop && smile ? [11, 17, 24] : drop ? [140, 232, 202] : arc ? [131, 210, 221] : undefined;
      if (sample) { coverage++; for (let channel = 0; channel < 3; channel++) colour[channel] += sample[channel]!; }
    }
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    for (let channel = 0; channel < 3; channel++) rows[offset + channel] = coverage ? Math.round(colour[channel]! / coverage) : 0;
    rows[offset + 3] = Math.round(coverage / 16 * 255);
  }
  const chunk = (type: string, data: Buffer) => {
    const bytes = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, bytes, checksum]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return nativeImage.createFromBuffer(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]));
}
