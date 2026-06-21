import { hasShopifyAdminEnv, shopifyEnv } from "./config";

// Thin wrapper over the Shopify Admin REST API. No SDK dependency — plain fetch,
// so it adds nothing to the bundle and stays isolated from the rest of the app.

export interface ShopifyVariant {
  id: number;
  sku: string | null;
  title: string | null;
  inventory_quantity?: number | null;
  inventory_management?: string | null;
  inventory_policy?: string | null;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  status?: string;
  variants: ShopifyVariant[];
}

/** True when a variant should be treated as purchasable. */
export function isVariantInStock(variant: ShopifyVariant): boolean {
  // Untracked inventory is always sellable; tracked inventory needs stock unless
  // the store allows overselling (inventory_policy === "continue").
  if (!variant.inventory_management) return true;
  if (variant.inventory_policy === "continue") return true;
  return (variant.inventory_quantity ?? 0) > 0;
}

function parseNextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) {
      try {
        return new URL(match[1]).searchParams.get("page_info");
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Fetch every product (all variants) from the store, following cursor
 * pagination. Throws if the Admin API env is not configured.
 */
export async function fetchAllProducts(): Promise<ShopifyProduct[]> {
  if (!hasShopifyAdminEnv()) {
    throw new Error("Shopify Admin API not configured (SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_API_TOKEN)");
  }

  const base = `https://${shopifyEnv.storeDomain}/admin/api/${shopifyEnv.apiVersion}/products.json`;
  const products: ShopifyProduct[] = [];
  let pageInfo: string | null = null;

  // Hard cap on pages as a safety valve against unexpected pagination loops.
  for (let page = 0; page < 100; page++) {
    const url = new URL(base);
    url.searchParams.set("limit", "250");
    if (pageInfo) {
      // page_info is mutually exclusive with most filters; only limit is allowed.
      url.searchParams.set("page_info", pageInfo);
    } else {
      url.searchParams.set("fields", "id,title,status,variants");
    }

    const res = await fetch(url.toString(), {
      headers: {
        "X-Shopify-Access-Token": shopifyEnv.adminApiToken!,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Shopify Admin API ${res.status}: ${await res.text()}`);
    }

    const body = (await res.json()) as { products: ShopifyProduct[] };
    products.push(...(body.products ?? []));

    pageInfo = parseNextPageInfo(res.headers.get("link"));
    if (!pageInfo) break;
  }

  return products;
}
