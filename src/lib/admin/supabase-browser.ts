"use client";

import { createBrowserClient } from "@supabase/ssr";
import { hasSupabasePublicEnv, supabaseEnv } from "@/lib/supabase/env";

/**
 * Cookie-bound Supabase client for Client Components (sign-in, sign-out,
 * password recovery). Writes the same session cookies the server reads, so a
 * sign-in immediately authenticates SSR requests.
 */
export function createPanelBrowserClient() {
  if (!hasSupabasePublicEnv()) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createBrowserClient(supabaseEnv.publicUrl!, supabaseEnv.publicAnonKey!);
}
