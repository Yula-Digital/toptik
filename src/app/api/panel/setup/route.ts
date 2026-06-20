import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabaseAdminEnv, supabaseEnv } from "@/lib/supabase/env";
import { countAdminUsers, createPrimaryAdmin } from "@/lib/admin/users";

export const runtime = "nodejs";

const setupSchema = z.object({
  email: z.string().email("כתובת מייל לא תקינה"),
  password: z.string().min(10, "סיסמה חייבת לפחות 10 תווים"),
  token: z.string().optional(),
});

/** GET → whether first-time setup is still available (no accounts yet). */
export async function GET(): Promise<NextResponse> {
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ available: false, reason: "env" });
  }
  try {
    const count = await countAdminUsers();
    return NextResponse.json({ available: count === 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ available: false, reason: message }, { status: 500 });
  }
}

/** POST → create the primary admin (guarded by the one-time setup token). */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Supabase admin env not configured" }, { status: 500 });
  }

  const parsed = setupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "קלט לא תקין" }, { status: 400 });
  }

  const providedToken = parsed.data.token ?? req.headers.get("x-admin-token") ?? "";
  if (!supabaseEnv.adminToken || providedToken !== supabaseEnv.adminToken) {
    return NextResponse.json({ error: "טוקן הקמה שגוי" }, { status: 401 });
  }

  try {
    await createPrimaryAdmin(parsed.data.email.trim(), parsed.data.password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ההקמה נכשלה";
    const status = message.includes("הקמה כבר בוצעה") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
