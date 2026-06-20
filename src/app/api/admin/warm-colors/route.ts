import { NextRequest, NextResponse } from "next/server";
import { enumerateColorVariants } from "@/lib/catalog-source/mandarina-scraper";
import { uploadVariantGalleries } from "@/lib/catalog-source/storage";
import { toCarouselColors } from "@/lib/carousel/colors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { hasSupabaseAdminEnv, supabaseEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";
export const maxDuration = 300;

// Populate carousel_items.colors for active items — enumerate every colour of
// each model on Mandarina Duck, re-host a cover image per colour, and cache the
// result. Mirrors /api/admin/warm-tech-specs (same auth + cron model). Add
// ?force=1 to refresh items that already have colours.
function isAuthorized(req: NextRequest) {
  const token = req.headers.get("x-admin-token") ?? req.nextUrl.searchParams.get("token");
  if (token && supabaseEnv.adminToken && token === supabaseEnv.adminToken) return true;
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}

type ColorWarmRow = {
  id: string;
  catalog_number: string | null;
  source_url: string | null;
  colors: unknown;
};

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Supabase admin env not configured" }, { status: 500 });
  }

  const reset = req.nextUrl.searchParams.get("reset") === "1";
  const force = req.nextUrl.searchParams.get("force") === "1";
  // Re-hosting a full gallery per colour is heavy, so process a bounded batch per
  // call and report `remaining` — callers loop until it reaches 0 (no timeout).
  const limit = Math.min(
    Math.max(parseInt(req.nextUrl.searchParams.get("limit") ?? "6", 10) || 6, 1),
    28,
  );
  const supabase = createSupabaseServiceRoleClient();

  // `?reset=1` clears cached colours so a subsequent warm repopulates every item
  // with the current scraper logic (use once before a full re-warm).
  if (reset) {
    const { error: resetError } = await supabase
      .from("carousel_items")
      .update({ colors: null })
      .eq("is_active", true);
    if (resetError) return NextResponse.json({ error: resetError.message }, { status: 500 });
    return NextResponse.json({ reset: true });
  }

  const { data: items, error } = await supabase
    .from("carousel_items")
    .select("id,catalog_number,source_url,colors")
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const allTargets = (items ?? []).filter(
    (it: ColorWarmRow) => it.source_url && (force || !it.colors),
  );
  const targets = allTargets.slice(0, limit);

  const results = await Promise.allSettled(
    targets.map(async (item: ColorWarmRow) => {
      const variants = await enumerateColorVariants({
        sourceUrl: item.source_url as string,
        catalogNumber: item.catalog_number,
      });
      if (variants.length === 0) throw new Error("no colour variants found");

      const folder = `imports/mandarina/${item.catalog_number ?? item.id}/colors`;
      const galleryByHandle = await uploadVariantGalleries(folder, variants);

      const colors = toCarouselColors(variants, galleryByHandle);
      if (colors.length === 0) throw new Error("no colour galleries could be re-hosted");

      const { error: updateError } = await supabase
        .from("carousel_items")
        .update({ colors })
        .eq("id", item.id);
      if (updateError) throw updateError;

      return { id: item.id, colors: colors.length };
    }),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    totalActive: items?.length ?? 0,
    targetsAttempted: targets.length,
    remaining: allTargets.length - targets.length,
    succeeded,
    failed,
    skipped: (items?.length ?? 0) - allTargets.length,
    sample: results
      .slice(0, 5)
      .map((r) =>
        r.status === "fulfilled" ? r.value : { error: String((r as PromiseRejectedResult).reason) },
      ),
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
