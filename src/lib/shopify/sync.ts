import { fetchAllProducts, isVariantInStock, type ShopifyProduct } from "./admin-client";
import { buildCartUrl } from "./sku";
import { writeProductCache, upsertCacheEntry } from "./cache-store";
import type { ShopifyCacheEntry } from "./types";

// Builds cache entries from raw Shopify products and persists them. Kept
// separate from the route handlers so the mapping rules live in one place.

/** Map a list of Shopify products to cache entries keyed by variant SKU. */
export function buildCacheEntries(products: ShopifyProduct[]): ShopifyCacheEntry[] {
  const now = new Date().toISOString();
  const entries: ShopifyCacheEntry[] = [];
  for (const product of products) {
    for (const variant of product.variants ?? []) {
      const sku = variant.sku?.trim();
      if (!sku) continue; // only variants carrying a SKU are addressable
      entries.push({
        sku,
        variantId: String(variant.id),
        cartUrl: buildCartUrl(String(variant.id)),
        title: variant.title ? `${product.title} — ${variant.title}` : product.title,
        inStock: isVariantInStock(variant),
        updatedAt: now,
      });
    }
  }
  return entries;
}

/** Full refresh: pull all products from Shopify and rewrite the cache. */
export async function syncProductCache(): Promise<{ products: number; entries: number; written: number }> {
  const products = await fetchAllProducts();
  const entries = buildCacheEntries(products);
  const written = await writeProductCache(entries);
  return { products: products.length, entries: entries.length, written };
}

/** Partial refresh from a single product payload (inbound webhook). */
export async function syncSingleProduct(product: ShopifyProduct): Promise<number> {
  const entries = buildCacheEntries([product]);
  for (const entry of entries) {
    await upsertCacheEntry(entry);
  }
  return entries.length;
}
