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
    // Trim the flat background border around the product. Threshold 25 trims
    // near-uniform background (white / very light) but preserves the product
    // and its natural shadow. Output stays full-resolution; next/image
    // optimizes the size downstream.
    const trimmed = await sharp(sourceBytes)
      .trim({ threshold: 25 })
      .webp({ quality: 88 })
      .toBuffer();

    return new NextResponse(new Uint8Array(trimmed), {
      headers: {
        ...CACHE_HEADERS,
        "content-type": "image/webp",
      },
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
