import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
// Cache responses on the Vercel edge essentially forever — each unique source URL
// is trimmed exactly once. Storage objects are content-addressed (per upload UUID),
// so the URL changes when the image changes.
export const revalidate = false;

const ALLOWED_HOSTNAME_SUFFIX = ".supabase.co";
const ALLOWED_PATH_PREFIX = "/storage/v1/object/public/";

const CACHE_HEADERS: HeadersInit = {
  "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable",
};

export async function GET(req: NextRequest) {
  const sourceUrlRaw = req.nextUrl.searchParams.get("u");
  if (!sourceUrlRaw) {
    return NextResponse.json({ error: "missing u" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(sourceUrlRaw);
  } catch {
    return NextResponse.json({ error: "invalid u" }, { status: 400 });
  }

  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname.endsWith(ALLOWED_HOSTNAME_SUFFIX) ||
    !parsed.pathname.startsWith(ALLOWED_PATH_PREFIX)
  ) {
    return NextResponse.json({ error: "forbidden host" }, { status: 403 });
  }

  let sourceBytes: Buffer;
  try {
    const res = await fetch(parsed.toString(), {
      cache: "no-store",
      headers: { accept: "image/*" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `source ${res.status}` }, { status: 502 });
    }
    sourceBytes = Buffer.from(await res.arrayBuffer());
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  try {
    // Threshold 12 removes the flat near-white background WITHOUT eating into
    // light/cream products (which sit only ~15-35 levels off pure white).
    const { data: trimmed, info } = await sharp(sourceBytes)
      .trim({ threshold: 12 })
      .webp({ quality: 88 })
      .toBuffer({ resolveWithObject: true });

    // Keep the tight crop so EVERY colour fills the frame consistently. A product
    // photographed small inside a large white canvas yields a small-but-valid
    // crop that MUST be kept — gating on area ratio (the old behaviour) returned
    // the un-cropped original for those variants, so they showed up small and
    // off-centre next to colours whose source filled the canvas. Only fall back
    // when the crop is DEGENERATE (a near-empty sliver = trim ate a white product).
    const degenerate =
      info.width < 32 ||
      info.height < 32 ||
      info.width / info.height > 4 ||
      info.height / info.width > 4;
    if (!degenerate) {
      return new NextResponse(new Uint8Array(trimmed), {
        headers: { ...CACHE_HEADERS, "content-type": "image/webp" },
      });
    }

    const original = await sharp(sourceBytes).webp({ quality: 88 }).toBuffer();
    return new NextResponse(new Uint8Array(original), {
      headers: { ...CACHE_HEADERS, "content-type": "image/webp" },
    });
  } catch {
    // If trim fails for any reason, pass the original image through so the
    // carousel never breaks. The browser still sees a valid image.
    return new NextResponse(new Uint8Array(sourceBytes), {
      headers: {
        ...CACHE_HEADERS,
        "content-type": "image/webp",
      },
    });
  }
}
