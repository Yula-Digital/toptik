import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { getPanelUser } from "@/lib/admin/supabase-server";
import { deleteAdmin, inviteAdmin, listAdminUsers } from "@/lib/admin/users";
import { getPublicOrigin } from "@/lib/admin/origin";

export const runtime = "nodejs";

const inviteSchema = z.object({ email: z.string().email("כתובת מייל לא תקינה") });

async function guard(): Promise<NextResponse | null> {
  const user = await getPanelUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Supabase admin env not configured" }, { status: 500 });
  }
  return null;
}

export async function GET(): Promise<NextResponse> {
  const blocked = await guard();
  if (blocked) return blocked;
  try {
    return NextResponse.json({ users: await listAdminUsers() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const blocked = await guard();
  if (blocked) return blocked;

  const parsed = inviteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "קלט לא תקין" }, { status: 400 });
  }

  try {
    const redirectTo = `${getPublicOrigin(req)}/auth/callback?next=/reset`;
    const invited = await inviteAdmin(parsed.data.email.trim(), redirectTo);
    return NextResponse.json({ ok: true, user: invited });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ההזמנה נכשלה";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const blocked = await guard();
  if (blocked) return blocked;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר מזהה משתמש" }, { status: 400 });

  try {
    await deleteAdmin(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "המחיקה נכשלה";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
