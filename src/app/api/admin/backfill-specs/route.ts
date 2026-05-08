import { NextRequest, NextResponse } from "next/server";
import { createCatalogSourceProvider } from "@/lib/catalog-source/provider";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";

function isAuthorized(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  return Boolean(token && supabaseEnv.adminToken && token === supabaseEnv.adminToken);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: items } = await supabase
    .from("carousel_items")
    .select("id, catalog_number")
    .not("catalog_number", "is", null);

  if (!items || items.length === 0) {
    return NextResponse.json({ message: "No items with catalog numbers" });
  }

  const provider = createCatalogSourceProvider();
  const results: Array<{ id: string; catalog: string; status: string }> = [];

  for (const item of items) {
    const catalog = item.catalog_number as string;
    try {
      const product = await provider.fetchByCatalogNumber(catalog);

      const { error } = await supabase
        .from("carousel_items")
        .update({
          color: product.color || null,
          dimensions: product.dimensions || null,
          weight: product.weight || null,
          sizes: product.sizes?.length ? product.sizes : null,
          available_colors: product.availableColors?.length ? product.availableColors : null,
        })
        .eq("id", item.id);

      if (error) {
        results.push({ id: item.id, catalog, status: `db error: ${error.message}` });
      } else {
        results.push({ id: item.id, catalog, status: "updated" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      results.push({ id: item.id, catalog, status: `scrape error: ${msg}` });
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  return NextResponse.json({ total: items.length, results });
}
