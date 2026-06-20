import { NextRequest, NextResponse } from "next/server";
import { scrapeColorVariantsByCatalog } from "@/lib/catalog-source/mandarina-scraper";

export const runtime = "nodejs";
export const maxDuration = 120;

// UNAUTHENTICATED debug route (same family as /api/debug-scrape and
// /api/debug-colors) for verifying colour enumeration on a gated preview
// deployment without needing the admin token. Returns the colours scraped for a
// catalog number; persists nothing. Preview deployments are gated by Vercel
// Authentication, so this is not publicly reachable. Safe to delete once the
// scraping accuracy is confirmed.
export async function GET(req: NextRequest) {
  const catalog = req.nextUrl.searchParams.get("catalog")?.trim();
  if (!catalog) {
    return NextResponse.json({ error: "catalog query param required" }, { status: 400 });
  }
  try {
    const { primary, modelToken, variants } = await scrapeColorVariantsByCatalog(catalog);
    return NextResponse.json(
      {
        catalog,
        modelToken,
        primary: {
          title: primary.title,
          catalogNumber: primary.catalogNumber,
          sourceUrl: primary.sourceUrl,
          images: primary.imageUrls.length,
        },
        count: variants.length,
        variants,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
