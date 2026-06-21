import { NextResponse } from "next/server";
import { readProductCache } from "@/lib/shopify/cache-store";

// Public read consumed by the gallery on page load: returns the full
// SKU → { variant_id, cart_url, title, in_stock } map. Falls back to an empty
// map when the cache/DB is not configured, so the page never errors.

export async function GET() {
  try {
    const cache = await readProductCache();
    return NextResponse.json(
      { cache },
      {
        headers: {
          // Refreshed daily by the sync job; cache at the edge, allow SWR.
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400, max-age=60",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/shopify/products-cache failed", error);
    return NextResponse.json({ cache: {} }, { status: 200 });
  }
}
