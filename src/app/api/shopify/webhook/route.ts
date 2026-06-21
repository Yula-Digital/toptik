import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { hasShopifyWebhookEnv, shopifyEnv } from "@/lib/shopify/config";
import { syncSingleProduct } from "@/lib/shopify/sync";
import type { ShopifyProduct } from "@/lib/shopify/admin-client";

// Inbound webhook for near-real-time updates between daily syncs. Register this
// URL in Shopify for the products/create, products/update, products/delete
// topics. Authenticated by HMAC over the raw body (X-Shopify-Hmac-Sha256).
//
// Optional: the daily /api/shopify/sync job already keeps the cache fresh; this
// endpoint only tightens the refresh window.

export const runtime = "nodejs";

function verifyHmac(rawBody: string, headerHmac: string | null): boolean {
  if (!headerHmac || !shopifyEnv.webhookSecret) return false;
  const digest = crypto
    .createHmac("sha256", shopifyEnv.webhookSecret)
    .update(rawBody, "utf8")
    .digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(headerHmac);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!hasShopifyWebhookEnv()) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  // Raw body is required for an accurate HMAC; read it once as text.
  const rawBody = await req.text();
  if (!verifyHmac(rawBody, req.headers.get("x-shopify-hmac-sha256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let product: ShopifyProduct;
  try {
    product = JSON.parse(rawBody) as ShopifyProduct;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only product-shaped payloads carry variants/SKUs we can map; ignore others.
  if (!product?.id || !Array.isArray(product.variants)) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  try {
    const updated = await syncSingleProduct(product);
    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    console.error("POST /api/shopify/webhook failed", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
