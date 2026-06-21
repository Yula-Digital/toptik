// Wrap a product image URL so it gets whitespace-trimmed via /api/img-trim.
// Supabase storage URLs are routed through the trimmer; local paths pass through.
//
// The trimmer now ALSO resizes to `width` and returns the final, display-ready
// WebP. Callers render this directly with <Image unoptimized>, so there is a
// SINGLE image pipeline (no /_next/image AVIF re-encode on top). Always pass the
// width tier the element renders at so preloads resolve to the exact same URL.
//
// `v` is a cache-buster: bump it whenever the trim algorithm changes so the
// edge/immutable cache recomputes existing images.
// v2 = threshold 12 + area-ratio fallback; v3 = keep tight crop (degenerate-only
// fallback) so small-in-canvas colours fill the frame; v4 = resize-before-trim +
// single pipeline (served directly, no next/image optimizer pass).
const TRIM_VERSION = 4;

// Width tiers. CARD = catalog grid thumbnail (small slot); MODAL = product modal
// gallery (the large zoomed view + every angle/colour we preload for it).
export const CARD_IMG_WIDTH = 720;
export const MODAL_IMG_WIDTH = 1280;

export function trimmedProductSrc(
  src: string | null | undefined,
  width?: number,
): string {
  if (!src) return "";
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(src)) {
    return src;
  }
  const widthParam = width ? `&w=${width}` : "";
  return `/api/img-trim?u=${encodeURIComponent(src)}${widthParam}&v=${TRIM_VERSION}`;
}
