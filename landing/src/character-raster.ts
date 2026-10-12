export type RasterLayer = { url: string; x: number; y: number; width: number; height: number };
type CutSet = { cuts: Record<string, { path: string }>; eyes: string[]; rope?: string };

/** Cache approved artwork partitions once. Animated SVG images then have no
 * live luminance masks to rerasterize during a transformed scroll frame. */
export async function rasterizeCharacter(image: HTMLImageElement, config: CutSet, ownUrl: (url: string) => void,
  signal: AbortSignal, layerReady: (key: string, part: RasterLayer) => void, rasterSize: number) {
  const size = 1000, scale = rasterSize / size;
  const source = document.createElement('canvas'), mask = document.createElement('canvas');
  source.width = source.height = mask.width = mask.height = rasterSize;
  const draw = source.getContext('2d', { willReadFrequently: true })!;
  const stencil = mask.getContext('2d', { willReadFrequently: true })!;
  stencil.setTransform(scale, 0, 0, scale, 0, 0);
  const order = ['scarf', 'legs', 'head', 'grip', 'free'];
  const results = new Map<string, RasterLayer>();
  async function layer(key: string, prepare: () => void) {
    signal.throwIfAborted();
    stencil.clearRect(0, 0, size, size); stencil.globalCompositeOperation = 'source-over';
    stencil.fillStyle = '#fff'; stencil.strokeStyle = '#fff'; prepare();
    draw.setTransform(scale, 0, 0, scale, 0, 0);
    draw.globalCompositeOperation = 'source-over'; draw.clearRect(0, 0, size, size);
    draw.drawImage(image, 0, 0, size, size);
    if (config.rope) { draw.globalCompositeOperation = 'destination-out'; draw.fill(new Path2D(config.rope)); }
    draw.setTransform(1, 0, 0, 1, 0, 0);
    draw.globalCompositeOperation = 'destination-in'; draw.drawImage(mask, 0, 0);
    const pixels = draw.getImageData(0, 0, rasterSize, rasterSize).data;
    let left = rasterSize, top = rasterSize, right = 0, bottom = 0;
    for (let y = 0; y < rasterSize; y++) for (let x = 0; x < rasterSize; x++) {
      if (!pixels[(y * rasterSize + x) * 4 + 3]) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    const crop = document.createElement('canvas');
    crop.width = Math.max(1, right - left + 1); crop.height = Math.max(1, bottom - top + 1);
    if (left < rasterSize) crop.getContext('2d')!.drawImage(source, left, top, crop.width, crop.height, 0, 0, crop.width, crop.height);
    const blob = await new Promise<Blob>((resolve, reject) => crop.toBlob(value => value ? resolve(value) : reject(new Error('Character partition cache failed')), 'image/png'));
    signal.throwIfAborted();
    const url = URL.createObjectURL(blob); ownUrl(url);
    const decoded = new Image(); decoded.src = url; await decoded.decode();
    signal.throwIfAborted();
    const part = { url, x: left < rasterSize ? left / scale : 0, y: top < rasterSize ? top / scale : 0,
      width: crop.width / scale, height: crop.height / scale };
    results.set(key, part); layerReady(key, part);
    crop.width = crop.height = 1;
  }
  try {
    await layer('body', () => {
      stencil.fillRect(0, 0, size, size);
      for (const joint of order) {
        const path = new Path2D(config.cuts[joint].path);
        stencil.globalCompositeOperation = 'destination-out'; stencil.fill(path);
        stencil.globalCompositeOperation = 'source-over'; stencil.lineWidth = 12; stencil.lineJoin = 'round'; stencil.stroke(path);
      }
    });
    for (const [index, joint] of order.entries()) await layer(joint, () => {
      stencil.fill(new Path2D(config.cuts[joint].path));
      stencil.globalCompositeOperation = 'destination-out';
      for (const next of order.slice(index + 1)) stencil.fill(new Path2D(config.cuts[next].path));
      if (joint === 'head') for (const eye of config.eyes) stencil.fill(new Path2D(eye));
    });
    for (const [i, eye] of config.eyes.entries()) await layer(`eye-${i}`, () => stencil.fill(new Path2D(eye)));
    return results;
  } finally { source.width = source.height = mask.width = mask.height = 1; }
}
