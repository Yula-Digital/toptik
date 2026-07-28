import { NextRequest, NextResponse } from "next/server";
import { scrapeColorVariantsByCatalog } from "@/lib/catalog-source/mandarina-scraper";
import { supabaseEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const maxDuration = 120;

// Read-only diagnostic: given a catalog number, scrape Mandarina Duck and return
// every colour variant of that model WITHOUT persisting anything. Lets us verify
// scraping accuracy on real data (on Vercel/local where MD is reachable) before
// the import wires these colours into the catalog. Auth: x-admin-token header or
// ?token= query (mirrors /api/admin/warm-tech-specs).
function isAuthorized(req: NextRequest) {
  const token = req.headers.get("x-admin-token") ?? req.nextUrl.searchParams.get("token");
  return Boolean(token && supabaseEnv.adminToken && token === supabaseEnv.adminToken);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const catalog = req.nextUrl.searchParams.get("catalog")?.trim();
  if (!catalog) {
    return NextResponse.json({ error: "Missing ?catalog= parameter" }, { status: 400 });
  }

  try {
    const { primary, modelToken, variants } = await scrapeColorVariantsByCatalog(catalog);
    return NextResponse.json({
      ok: true,
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Probe failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
