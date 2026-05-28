// Mirror exactly what next/image emits so a manual <link rel="preload"> can
// resolve to the SAME /_next/image resource the browser renders — turning a
// wasted parallel fetch into a real cache hit. Default deviceSizes + default
// quality (75); keep in sync with next.config if those are ever customised.
const DEVICE_SIZES = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];

export function nextImageUrl(src: string, width: number, quality = 75): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}

export function nextImageSrcset(src: string, quality = 75): string {
  return DEVICE_SIZES.map((w) => `${nextImageUrl(src, w, quality)} ${w}w`).join(", ");
}
