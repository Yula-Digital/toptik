import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { getPanelUser } from "@/lib/admin/supabase-server";
import {
  getAdminSettings,
  saveAdminSettings,
  toPublicSettings,
  type WhatsappConfig,
} from "@/lib/admin/settings";

export const runtime = "nodejs";

const settingsSchema = z.object({
  whatsappEnabled: z.boolean(),
  whatsapp: z.object({
    provider: z.enum(["", "whatsapp_cloud", "twilio", "custom"]),
    phoneNumber: z.string().max(40),
    phoneNumberId: z.string().max(160),
    // Blank/absent → keep the stored token (never overwrite a secret with "").
    accessToken: z.string().max(4000).optional(),
    systemPrompt: z.string().max(6000),
    autoReply: z.boolean(),
    businessHoursOnly: z.boolean(),
  }),
});

export async function GET(): Promise<NextResponse> {
  const user = await getPanelUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const settings = await getAdminSettings();
    return NextResponse.json({ settings: toPublicSettings(settings), configured: hasSupabaseAdminEnv() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const user = await getPanelUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Supabase admin env not configured" }, { status: 500 });
  }

  const parsed = settingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "קלט לא תקין" }, { status: 400 });
  }

  try {
    const existing = await getAdminSettings();
    const incomingToken = parsed.data.whatsapp.accessToken?.trim();
    const whatsapp: WhatsappConfig = {
      ...parsed.data.whatsapp,
      accessToken: incomingToken ? incomingToken : existing.whatsapp.accessToken,
    };

    await saveAdminSettings({ whatsappEnabled: parsed.data.whatsappEnabled, whatsapp }, user.email ?? null);
    const next = await getAdminSettings();
    return NextResponse.json({ ok: true, settings: toPublicSettings(next) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שמירת ההגדרות נכשלה";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
