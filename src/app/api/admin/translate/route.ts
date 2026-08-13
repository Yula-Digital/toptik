import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { translateToHebrew } from "@/lib/catalog-source/translate";
import { supabaseEnv } from "@/lib/supabase/env";

// Translate a free-text description to Hebrew using the SAME engine the scraper
// uses (Google translate endpoint, chunked + Hebrew-verified). Lets the admin
// paste an English description in manual entry and get it translated exactly
// like an auto-imported product.
export const runtime = "nodejs";
export const maxDuration = 60;

const translateSchema = z.object({
  text: z.string().trim().min(1).max(4000),
});

function isAuthorized(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  return Boolean(token && supabaseEnv.adminToken && token === supabaseEnv.adminToken);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { text } = translateSchema.parse(body);
    const translated = await translateToHebrew(text);
    return NextResponse.json({ text: translated ?? text });
  } catch (error) {
    console.error("POST /api/admin/translate failed", error);
    const message = error instanceof Error ? error.message : "Translate failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
