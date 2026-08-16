import { NextRequest, NextResponse } from "next/server";
import { fetchProductDetails, type ProductDetails } from "@/lib/catalog-source/product-details";
import { createCatalogSourceProvider } from "@/lib/catalog-source/provider";
import { detectVendorFromCatalog } from "@/lib/catalog-source/vendor-detect";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { hasSupabaseAdminEnv, supabaseEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(req: NextRequest) {
  // Accept token from header (admin tool) or query param (one-off curl/MCP).
  const token = req.headers.get("x-admin-token") ?? req.nextUrl.searchParams.get("token");
  if (token && supabaseEnv.adminToken && token === supabaseEnv.adminToken) return true;
  // Vercel Cron Jobs authenticate via `Authorization: Bearer <CRON_SECRET>`,
  // where CRON_SECRET is an env var the project owner sets on Vercel.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}

type StoredTechSpecs = {
  specs?: ProductDetails["specs"];
  colors?: ProductDetails["colors"];
  // Admin's manual מזוודה/טרולי choice — lives inside tech_specs (no DB column).
  category?: string | null;
};

type ItemRow = {
  id: string;
  catalog_number: string | null;
  source_url: string | null;
  tech_specs: StoredTechSpecs | null;
  description: string | null;
};

// Fallback completion from the item's own stored Hebrew description — data an
// editor already curated. Used only for fields the vendor scrape didn't yield,
// so a live scrape always wins.
function extractHebrewSpecs(text: string | null): { volume?: string; material?: string } {
  if (!text) return {};
  const out: { volume?: string; material?: string } = {};
  const vol = /(\d+(?:[.,]\d+)?)\s*ליטר/.exec(text);
  if (vol) out.volume = `${vol[1].replace(",", ".")} ליטר`;
  const materials: Array<[RegExp, string]> = [
    [/פוליקרבונט/, "פוליקרבונט"],
    [/פוליפרופילן/, "פוליפרופילן"],
    [/פוליאמיד/, "פוליאמיד"],
    [/פוליאסטר/, "פוליאסטר"],
    [/ניילון/, "ניילון"],
    [/\bABS\b/, "ABS"],
    [/אלומיניום/, "אלומיניום"],
    [/עור/, "עור"],
  ];
  const hit = materials.find(([re]) => re.test(text));
  if (hit) out.material = hit[1];
  return out;
}

type SpecSections = NonNullable<StoredTechSpecs["specs"]>;

function ensureSpec(specs: SpecSections, heading: string, label: string, value?: string) {
  if (!value) return;
  if (specs.some((s) => s.items.some((i) => i.label === label))) return;
  const section = specs.find((s) => s.heading === heading);
  if (section) section.items.push({ label, value });
  else specs.push({ heading, items: [{ label, value }] });
}

function specCount(ts: StoredTechSpecs | null | undefined) {
  return ts?.specs?.reduce((n, s) => n + s.items.length, 0) ?? 0;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Supabase admin env not configured" }, { status: 500 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const supabase = createSupabaseServiceRoleClient();

  const { data: items, error } = await supabase
    .from("carousel_items")
    .select("id,catalog_number,source_url,tech_specs,description")
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Warm: forced, never-warmed, or warmed-but-empty (a failed earlier scrape
  // stored {specs:[]}, which the old `!tech_specs` check skipped forever).
  const targets = ((items ?? []) as ItemRow[]).filter(
    (it) => (it.source_url || it.catalog_number) && (force || specCount(it.tech_specs) === 0),
  );

  const results = await Promise.allSettled(
    targets.map(async (item) => {
      // Manually-entered products often have no source URL. Recover it from the
      // catalog number via the vendor's own search — the same path the importer
      // uses — and persist it so the next warm skips the lookup.
      let sourceUrl = item.source_url;
      let recoveredUrl = false;
      if (!sourceUrl && item.catalog_number) {
        const provider = createCatalogSourceProvider(detectVendorFromCatalog(item.catalog_number));
        const product = await provider.fetchByCatalogNumber(item.catalog_number);
        sourceUrl = product.sourceUrl;
        recoveredUrl = Boolean(sourceUrl);
      }
      if (!sourceUrl) throw new Error(`no source url for ${item.catalog_number ?? item.id}`);

      const details = await fetchProductDetails(sourceUrl);

      // COMPLETE, never clobber: a fresh scrape wins only where it actually
      // found data; anything the admin entered stays when the scrape came back
      // empty, and the manual category choice is always carried over.
      const existing = item.tech_specs ?? null;
      const merged: StoredTechSpecs = {
        specs: details.specs.length > 0 ? details.specs : existing?.specs ?? [],
        colors: details.colors.length > 0 ? details.colors : existing?.colors ?? [],
        ...(existing?.category ? { category: existing.category } : {}),
      };

      // Whatever the scrape missed, complete from the item's own Hebrew
      // description (e.g. "נפח 32 ליטר", "פוליקרבונט") — curated data we
      // already hold, so vendor pages that omit litres no longer leave נפח
      // empty when the description states it.
      const fromDesc = extractHebrewSpecs(item.description);
      ensureSpec(merged.specs ?? [], "מידות", "נפח", fromDesc.volume);
      ensureSpec(merged.specs ?? [], "הרכב", "חומר", fromDesc.material);

      const update: Record<string, unknown> = { tech_specs: merged };
      if (recoveredUrl) update.source_url = sourceUrl;
      const { error: updateError } = await supabase
        .from("carousel_items")
        .update(update)
        .eq("id", item.id);
      if (updateError) throw updateError;
      return {
        id: item.id,
        catalog: item.catalog_number,
        recoveredUrl,
        sections: merged.specs?.length ?? 0,
        items: specCount(merged),
      };
    }),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  // Name every failure with its catalog number so the admin banner can say
  // exactly which products could not be completed, not just a count.
  const failures = results.flatMap((r, i) =>
    r.status === "rejected"
      ? [{ catalog: targets[i].catalog_number ?? targets[i].id, error: String(r.reason) }]
      : [],
  );

  return NextResponse.json({
    totalActive: items?.length ?? 0,
    targetsAttempted: targets.length,
    succeeded,
    failed: failures.length,
    failures,
    skipped: (items?.length ?? 0) - targets.length,
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
