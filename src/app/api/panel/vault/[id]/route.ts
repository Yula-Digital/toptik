import { NextRequest, NextResponse } from "next/server";
import { listVaultEntries, updateVaultEntry, deleteVaultEntry } from "@/lib/admin/vault";
import { authStepUp, parseVaultInput } from "@/lib/admin/vault-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await authStepUp();
  if ("res" in gate) return gate.res;
  const { id } = await ctx.params;
  const input = parseVaultInput(await req.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "יש להזין לפחות שם וסיסמה" }, { status: 400 });
  try {
    await updateVaultEntry(id, input);
    return NextResponse.json({ entries: await listVaultEntries() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await authStepUp();
  if ("res" in gate) return gate.res;
  const { id } = await ctx.params;
  try {
    await deleteVaultEntry(id);
    return NextResponse.json({ entries: await listVaultEntries() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
