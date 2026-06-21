import { shopifyEnv } from "./config";

// Pure helpers — no I/O, no side effects. Safe to import on the client too.

/**
 * Derive the Shopify SKU from a Mandarina Duck importer product URL.
 *
 * Example:
 *   https://mandarinaduck.com/en-us/products/md20-crossover-taupe-qmt4309k
 *     → slug   = "md20-crossover-taupe-qmt4309k"
 *     → suffix = "QMT4309K"  (last "-" segment, upper-cased)
 *     → sku    = "P10QMT4309K"  (prefix + suffix)
 *
 * Returns null for inputs that don't contain a "/products/<slug>" segment.
 */
export function extractSku(importerUrl: string, prefix = shopifyEnv.skuPrefix): string | null {
  if (!importerUrl) return null;
  const afterProducts = importerUrl.split("/products/")[1];
  if (!afterProducts) return null;
  const slug = afterProducts.split("?")[0].split("#")[0].replace(/\/+$/, "");
  if (!slug) return null;
  const suffix = slug.split("-").slice(-1)[0]?.toUpperCase();
  if (!suffix) return null;
  return `${prefix}${suffix}`;
}

/** Build a direct add-to-cart URL for a Shopify variant. */
export function buildCartUrl(
  variantId: string,
  quantity = 1,
  storefrontDomain = shopifyEnv.storefrontDomain,
): string {
  return `https://${storefrontDomain}/cart/${variantId}:${quantity}`;
}
