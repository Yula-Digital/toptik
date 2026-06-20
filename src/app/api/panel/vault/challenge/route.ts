import { NextResponse } from "next/server";
import { getPanelUser, createPanelServerClient } from "@/lib/admin/supabase-server";
import { isVaultConfigured } from "@/lib/admin/vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const head = name.slice(0, 2);
  return `${head}${"•".repeat(Math.max(1, name.length - head.length))}@${domain}`;
}

/** Step 1 of the vault gate — email a fresh 6-digit OTP to the admin. */
export async function POST() {
  const user = await getPanelUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isVaultConfigured()) {
    return NextResponse.json({ error: "כספת הסיסמאות אינה מוגדרת בשרת" }, { status: 503 });
  }
  try {
    const supabase = await createPanelServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, email: maskEmail(user.email) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send verification code";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
