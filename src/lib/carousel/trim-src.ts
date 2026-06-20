// Wrap a product image URL so it gets whitespace-trimmed via /api/img-trim.
// Supabase storage URLs are routed through the trimmer; local paths pass through.
// `v` is a cache-buster: bump it whenever the trim algorithm changes so the
// edge/immutable cache recomputes existing images (v2 = threshold 12 + fallback).
const TRIM_VERSION = 2;

export function trimmedProductSrc(src: string | null | undefined): string {
  if (!src) return "";
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(src)) {
    return src;
  }
  return `/api/img-trim?u=${encodeURIComponent(src)}&v=${TRIM_VERSION}`;
}
