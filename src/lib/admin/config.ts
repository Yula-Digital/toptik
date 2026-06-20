// Central configuration for the TOPTIK admin panel (the `admin.toptik.co.il`
// subdomain surface). Values are overridable via env so previews / staging can
// point elsewhere, but production defaults are baked in.

/** Host that serves the admin panel. The landing page lives on `landing.toptik.co.il`. */
export const ADMIN_HOST = (process.env.NEXT_PUBLIC_ADMIN_HOST ?? "admin.toptik.co.il").toLowerCase();

/** Hard cap on the number of admin accounts (product requirement: up to 3). */
export const MAX_ADMIN_USERS = 3;

/** Public landing page (menu shortcut #3). */
export const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? "https://landing.toptik.co.il";

/** Shopify storefront — the apex was returned to Shopify on 2026-06-20 (menu shortcut #4). */
export const SHOPIFY_STORE_URL = process.env.NEXT_PUBLIC_SHOPIFY_URL ?? "https://toptik.co.il";

/**
 * URL path prefixes that belong to the admin panel surface. `proxy.ts` uses
 * these to (a) refresh the Supabase session and (b) keep the panel on its
 * subdomain. Keep in sync with the routes under `src/app/(panel)` + the auth
 * callback route handler.
 */
export const PANEL_PREFIXES = [
  "/login",
  "/setup",
  "/reset",
  "/dashboard",
  "/settings",
  "/auth",
] as const;

/** Panel paths that are reachable without an authenticated session. */
export const PUBLIC_PANEL_PREFIXES = ["/login", "/setup", "/reset", "/auth"] as const;
