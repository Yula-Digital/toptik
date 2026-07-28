import { NextRequest, NextResponse } from "next/server";
import { fetchProductDetails } from "@/lib/catalog-source/product-details";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";

// Persist the parsed spec data back to carousel_items.tech_specs so the next
// request (and the carousel payload itself) can serve it without scraping.
// Failure is swallowed — the modal still gets its data from the live fetch.
async function persistTechSpecs(sourceUrl: string, payload: { specs: unknown; colors: unknown }) {
  if (!hasSupabaseAdminEnv()) return;
  try {
    const supabase = createSupabaseServiceRoleClient();
    await supabase
      .from("carousel_items")
      .update({ tech_specs: payload })
      .eq("source_url", sourceUrl);
  } catch (err) {
    console.warn("[product-details] persist failed", err);
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url || !url.startsWith("http")) {
    return NextResponse.json({ specs: [], colors: [] });
  }

  try {
    const details = await fetchProductDetails(url);
    // Fire-and-forget DB cache write — we don't make the user wait for it.
    void persistTechSpecs(url, details);
    return NextResponse.json(details, {
      headers: {
        // Long edge cache: the catalog rarely changes, and the response is
        // keyed by full URL. Manual refresh via admin still works because
        // /api/admin/import/mandarina writes a new row (different cache key).
        "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=2592000, max-age=86400",
      },
    });
  } catch (err) {
    console.error("[product-details] fetch error", err);
    return NextResponse.json({ specs: [], colors: [], error: "fetch_failed" }, { status: 200 });
  }
}
