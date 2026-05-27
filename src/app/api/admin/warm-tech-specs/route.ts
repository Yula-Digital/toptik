import { NextRequest, NextResponse } from "next/server";
import { fetchProductDetails } from "@/lib/catalog-source/product-details";
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
    .select("id,source_url,tech_specs")
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const targets = (items ?? []).filter(
    (it: { source_url: string | null; tech_specs: unknown }) =>
      it.source_url && (force || !it.tech_specs),
  );

  const results = await Promise.allSettled(
    targets.map(async (item: { id: string; source_url: string }) => {
      const details = await fetchProductDetails(item.source_url);
      const { error: updateError } = await supabase
        .from("carousel_items")
        .update({ tech_specs: details })
        .eq("id", item.id);
      if (updateError) throw updateError;
      return {
        id: item.id,
        sections: details.specs.length,
        items: details.specs.reduce((n, s) => n + s.items.length, 0),
      };
    }),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    totalActive: items?.length ?? 0,
    targetsAttempted: targets.length,
    succeeded,
    failed,
    skipped: (items?.length ?? 0) - targets.length,
    sample: results
      .slice(0, 5)
      .map((r) => (r.status === "fulfilled" ? r.value : { error: String((r as PromiseRejectedResult).reason) })),
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
