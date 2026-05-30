// TEMPORARY one-shot backfill: for any carousel_item whose cover_image_path
// is empty or not a full http(s) URL, copies the first angle's image_path
// (if it's a valid URL) into cover_image_path. Gated by ADMIN_PANEL_TOKEN.
// Delete this file immediately after running.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";

function isAuthorized(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  return Boolean(token && supabaseEnv.adminToken && token === supabaseEnv.adminToken);
}

function isValidUrl(value: string | null | undefined) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: items, error: itemsErr } = await supabase
    .from("carousel_items")
    .select("id, cover_image_path");
  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  const { data: angles, error: anglesErr } = await supabase
    .from("carousel_item_angles")
    .select("item_id, image_path, angle_order")
    .order("angle_order", { ascending: true });
  if (anglesErr) {
    return NextResponse.json({ error: anglesErr.message }, { status: 500 });
  }

  const firstAngleByItem = new Map<string, string>();
  for (const a of angles ?? []) {
    if (!firstAngleByItem.has(a.item_id) && isValidUrl(a.image_path)) {
      firstAngleByItem.set(a.item_id, a.image_path);
    }
  }

  const updates: { id: string; before: string; after: string }[] = [];
  for (const it of items ?? []) {
    if (isValidUrl(it.cover_image_path)) continue;
    const candidate = firstAngleByItem.get(it.id);
    if (!candidate) continue;
    const { error: upErr } = await supabase
      .from("carousel_items")
      .update({ cover_image_path: candidate })
      .eq("id", it.id);
    if (upErr) {
      return NextResponse.json(
        { error: `update failed on ${it.id}: ${upErr.message}`, updatesSoFar: updates },
        { status: 500 },
      );
    }
    updates.push({ id: it.id, before: it.cover_image_path ?? "", after: candidate });
  }

  return NextResponse.json({
    totalItems: items?.length ?? 0,
    updated: updates.length,
    updates,
  });
}
