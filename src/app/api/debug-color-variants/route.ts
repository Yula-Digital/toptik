import { NextRequest, NextResponse } from "next/server";
import {
  discoverColorSiblingsByCatalog,
  scrapeColorVariantsByCatalog,
} from "@/lib/catalog-source/mandarina-scraper";
import { MANDARINA_COLOR_CODES } from "@/lib/carousel/colors";

export const runtime = "nodejs";
export const maxDuration = 120;

// UNAUTHENTICATED debug route (same family as /api/debug-scrape and
// /api/debug-colors) for verifying colour enumeration on a gated preview without
// the admin token. Persists nothing. Preview deployments are gated by Vercel
// Authentication, so this is not publicly reachable. Safe to delete once
// scraping accuracy is confirmed.
//
//   default (fast): one /search request → the model's sibling colour handles.
//   ?full=1 (slow):  full enumeration with a re-hosted cover image per colour.

function colorCodeFromHandle(handle: string): string | null {
  const tail = handle.split("-").pop() ?? "";
  return tail.length >= 6 ? tail.slice(-3).toUpperCase() : null;
}

export async function GET(req: NextRequest) {
  const catalog = req.nextUrl.searchParams.get("catalog")?.trim();
  if (!catalog) {
    return NextResponse.json({ error: "catalog query param required" }, { status: 400 });
  }

  if (req.nextUrl.searchParams.get("full") === "1") {
    try {
      const { primary, modelToken, variants } = await scrapeColorVariantsByCatalog(catalog);
      return NextResponse.json(
        {
          mode: "full",
          catalog,
          modelToken,
          primary: { title: primary.title, sourceUrl: primary.sourceUrl, images: primary.imageUrls.length },
          count: variants.length,
          variants,
        },
        { headers: { "cache-control": "no-store" } },
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "failed" },
        { status: 400 },
      );
    }
  }

  try {
    const { modelToken, handles } = await discoverColorSiblingsByCatalog(catalog);
    const siblings = handles.map((handle) => {
      const code = colorCodeFromHandle(handle);
      const meta = code ? MANDARINA_COLOR_CODES[code] : undefined;
      return { handle, colorCode: code, name: meta?.he ?? null };
    });
    return NextResponse.json(
      { mode: "fast", catalog, modelToken, count: siblings.length, siblings },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed" },
      { status: 400 },
    );
  }
}
