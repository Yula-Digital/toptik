import { NextRequest, NextResponse } from "next/server";
import { hasShopifyAdminEnv } from "@/lib/shopify/config";
import { syncProductCache } from "@/lib/shopify/sync";
import { supabaseEnv } from "@/lib/supabase/env";

// Daily refresh: pull all products from Shopify, rebuild the SKU → cart-url
// cache. Trigger via Vercel Cron (Authorization: Bearer $CRON_SECRET) or
// manually with x-admin-token / ?token=.

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token") ?? req.nextUrl.searchParams.get("token");
  if (token && supabaseEnv.adminToken && token === supabaseEnv.adminToken) return true;
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasShopifyAdminEnv()) {
    return NextResponse.json({ error: "Shopify Admin API not configured" }, { status: 503 });
  }

  try {
    const result = await syncProductCache();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("POST /api/shopify/sync failed", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
