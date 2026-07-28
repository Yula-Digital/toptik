import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { getPanelUser } from "@/lib/admin/supabase-server";
import { deleteAdmin, createAdminWithPassword, listAdminUsers } from "@/lib/admin/users";
import { isPanelDemo, DEMO_USERS } from "@/lib/admin/demo";

export const runtime = "nodejs";

const createSchema = z.object({
  email: z.string().email("כתובת מייל לא תקינה"),
  password: z.string().min(10, "הסיסמה חייבת להכיל לפחות 10 תווים"),
});

async function guard(): Promise<NextResponse | null> {
  const user = await getPanelUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Supabase admin env not configured" }, { status: 500 });
  }
  return null;
}

export async function GET(): Promise<NextResponse> {
  if (isPanelDemo()) return NextResponse.json({ users: DEMO_USERS });
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

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "קלט לא תקין" }, { status: 400 });
  }

  try {
    const created = await createAdminWithPassword(parsed.data.email.trim(), parsed.data.password);
    return NextResponse.json({ ok: true, user: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "יצירת המנהל נכשלה";
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
