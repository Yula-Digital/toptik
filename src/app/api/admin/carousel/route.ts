import { NextRequest, NextResponse } from "next/server";
import { getCarouselPayload, saveCarouselPayload } from "@/lib/carousel/repository";
import { isAdminApiAuthorized } from "@/lib/admin/api-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!(await isAdminApiAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await getCarouselPayload({ includeInactive: true });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("GET /api/admin/carousel failed", error);
    return NextResponse.json({ error: "Failed to load admin data" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await isAdminApiAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    await saveCarouselPayload(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/admin/carousel failed", error);
    const message = error instanceof Error ? error.message : "Failed to save carousel data";
    const status = message.includes("Missing Supabase admin env vars") ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
