import { NextRequest, NextResponse } from "next/server";
import { getPanelUser, createPanelServerClient } from "@/lib/admin/supabase-server";
import {
  isVaultConfigured,
  listVaultEntries,
  issueStepUpToken,
  STEP_UP_COOKIE,
  STEP_UP_MAX_AGE,
} from "@/lib/admin/vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Step 2 of the vault gate — verify the OTP, open a short step-up window, and
 *  return the decrypted entries. */
export async function POST(req: NextRequest) {
  const user = await getPanelUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isVaultConfigured()) {
    return NextResponse.json({ error: "כספת הסיסמאות אינה מוגדרת בשרת" }, { status: 503 });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { code?: string };
    const code = String(body.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "יש להזין קוד בן 6 ספרות" }, { status: 400 });
    }
    const supabase = await createPanelServerClient();
    const { error } = await supabase.auth.verifyOtp({ email: user.email, token: code, type: "email" });
    if (error) return NextResponse.json({ error: "קוד שגוי או שפג תוקפו" }, { status: 400 });

    const entries = await listVaultEntries();
    const res = NextResponse.json({ ok: true, entries });
    res.cookies.set(STEP_UP_COOKIE, issueStepUpToken(user.id), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: STEP_UP_MAX_AGE,
    });
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
