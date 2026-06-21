// Shared shapes for the Shopify product cache. The cache is a flat map keyed by
// the Shopify variant SKU (e.g. "P10QMT4309K"); the frontend derives the same
// key from a product's importer URL (see ./sku.ts) and looks it up to wire the
// "buy" button to a direct cart URL — no per-click round-trip to Shopify.

export interface ShopifyCacheEntry {
  /** Shopify variant SKU — the map key. */
  sku: string;
  /** Numeric Shopify variant id, as a string. */
  variantId: string;
  /** Direct add-to-cart URL on the storefront. */
  cartUrl: string;
  /** Product/variant title (for display / debugging). */
  title: string;
  /** Whether the variant is currently purchasable. */
  inStock: boolean;
  /** ISO timestamp of the last refresh for this entry. */
  updatedAt: string;
}

/** SKU → entry map returned to the browser by /api/shopify/products-cache. */
export type ShopifyProductCacheMap = Record<string, ShopifyCacheEntry>;
