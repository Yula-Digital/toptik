// Central configuration for the Shopify bridge (catalog landing page → Shopify
// store). Everything here is read from env and is OPTIONAL: when a value is
// missing the bridge degrades gracefully (reads return an empty cache, writes
// report "not configured") so the app still builds and runs with no secrets.
//
// This module is self-contained — it does not import from, or affect, any other
// feature area. Env access is centralized here on purpose, mirroring the
// existing `src/lib/supabase/env.ts` boundary.

export const shopifyEnv = {
  /** Admin API host, e.g. "toptikcoil.myshopify.com". */
  storeDomain: process.env.SHOPIFY_STORE_DOMAIN,
  /** Admin API access token (Custom App → Admin API access token). */
  adminApiToken: process.env.SHOPIFY_ADMIN_API_TOKEN,
  /** Admin REST API version. */
  apiVersion: process.env.SHOPIFY_API_VERSION ?? "2024-10",
  /** Public storefront host used to build cart URLs, e.g. "www.toptik.co.il". */
  storefrontDomain: process.env.SHOPIFY_STOREFRONT_DOMAIN ?? "www.toptik.co.il",
  /** Shared secret for verifying inbound webhook HMAC signatures. */
  webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET,
  /** Prefix prepended to the importer SKU suffix to form the Shopify SKU. */
  skuPrefix: process.env.SHOPIFY_SKU_PREFIX ?? "P10",
};

/** True when the Admin API can be queried (sync job prerequisites). */
export function hasShopifyAdminEnv() {
  return Boolean(shopifyEnv.storeDomain && shopifyEnv.adminApiToken);
}

/** True when inbound webhooks can be authenticated. */
export function hasShopifyWebhookEnv() {
  return Boolean(shopifyEnv.webhookSecret);
}
