import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createPanelServerClient } from "@/lib/admin/supabase-server";

export const runtime = "nodejs";

/**
 * Handles the link Supabase emails for invites and password recovery.
 * Supports both flows:
 *   - PKCE code exchange (`?code=`) — default email templates.
 *   - One-time token (`?token_hash=&type=`) — works cross-device.
 * On success the session cookie is set and we forward to `next` (default
 * `/reset`, where the user sets a new password).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/reset";
  const safeNext = next.startsWith("/") ? next : "/reset";

  try {
    const supabase = await createPanelServerClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
    }
  } catch {
    // fall through to the error redirect
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
