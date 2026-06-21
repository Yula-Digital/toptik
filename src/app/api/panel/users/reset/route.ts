import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { getPanelUser } from "@/lib/admin/supabase-server";
import { sendResetEmail } from "@/lib/admin/users";
import { getPublicOrigin } from "@/lib/admin/origin";

export const runtime = "nodejs";

const resetSchema = z.object({ email: z.string().email("כתובת מייל לא תקינה") });

/** Admin-initiated password reset: emails a recovery link to an existing admin. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getPanelUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Supabase admin env not configured" }, { status: 500 });
  }

  const parsed = resetSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "קלט לא תקין" }, { status: 400 });
  }

  try {
    const redirectTo = `${getPublicOrigin(req)}/auth/callback?next=/reset`;
    await sendResetEmail(parsed.data.email.trim(), redirectTo);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שליחת האיפוס נכשלה";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
