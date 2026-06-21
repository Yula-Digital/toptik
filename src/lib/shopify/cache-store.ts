import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { hasSupabaseAdminEnv, hasSupabasePublicEnv } from "@/lib/supabase/env";
import type { ShopifyCacheEntry, ShopifyProductCacheMap } from "./types";

// Persistence boundary for the Shopify product cache. Reuses the existing
// centralized Supabase clients (read-only import — nothing else is modified).
// Backed by the `shopify_product_cache` table (one row per SKU).
//
// Graceful degradation: with no Supabase env, reads return an empty map and
// writes throw a clear "not configured" error — the app still builds and runs.

const TABLE = "shopify_product_cache";

interface CacheRow {
  sku: string;
  variant_id: string;
  cart_url: string;
  title: string;
  in_stock: boolean;
  updated_at: string;
}

function rowToEntry(row: CacheRow): ShopifyCacheEntry {
  return {
    sku: row.sku,
    variantId: row.variant_id,
    cartUrl: row.cart_url,
    title: row.title,
    inStock: row.in_stock,
    updatedAt: row.updated_at,
  };
}

function entryToRow(entry: ShopifyCacheEntry): CacheRow {
  return {
    sku: entry.sku,
    variant_id: entry.variantId,
    cart_url: entry.cartUrl,
    title: entry.title,
    in_stock: entry.inStock,
    updated_at: entry.updatedAt,
  };
}

/** Read the full SKU → entry map. Returns {} when Supabase is not configured. */
export async function readProductCache(): Promise<ShopifyProductCacheMap> {
  if (!hasSupabasePublicEnv()) return {};
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("sku,variant_id,cart_url,title,in_stock,updated_at");
  if (error) throw new Error(error.message);

  const map: ShopifyProductCacheMap = {};
  for (const row of (data ?? []) as CacheRow[]) {
    map[row.sku] = rowToEntry(row);
  }
  return map;
}

/** Replace/insert many entries in one upsert. Returns the number written. */
export async function writeProductCache(entries: ShopifyCacheEntry[]): Promise<number> {
  if (!hasSupabaseAdminEnv()) {
    throw new Error("Supabase admin env not configured");
  }
  if (entries.length === 0) return 0;
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from(TABLE)
    .upsert(entries.map(entryToRow), { onConflict: "sku" });
  if (error) throw new Error(error.message);
  return entries.length;
}

/** Upsert a single entry (used by the inbound webhook). */
export async function upsertCacheEntry(entry: ShopifyCacheEntry): Promise<void> {
  await writeProductCache([entry]);
}
