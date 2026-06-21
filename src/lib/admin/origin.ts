import { NextRequest } from "next/server";

/**
 * Resolves the public origin of a request (scheme + host) for building email
 * redirect links. Prefers forwarded headers so links point at the user-facing
 * subdomain rather than an internal Vercel URL.
 */
export function getPublicOrigin(req: NextRequest): string {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
