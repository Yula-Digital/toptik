import { NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { getPanelUser } from "@/lib/admin/supabase-server";

/**
 * Authorization for the admin write APIs. Accepts EITHER:
 *  1. A valid Supabase panel session (the new cookie-based auth), or
 *  2. The legacy static `ADMIN_PANEL_TOKEN` (header `x-admin-token` or `?token=`),
 *     kept for back-compat (cron, scripts, MCP one-offs).
 */
export async function isAdminApiAuthorized(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("x-admin-token") ?? req.nextUrl.searchParams.get("token");
  if (token && supabaseEnv.adminToken && token === supabaseEnv.adminToken) {
    return true;
  }
  const user = await getPanelUser();
  return Boolean(user);
}
