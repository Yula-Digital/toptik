import { NextRequest, NextResponse } from "next/server";
import { listVaultEntries, createVaultEntry } from "@/lib/admin/vault";
import { authStepUp, parseVaultInput } from "@/lib/admin/vault-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const gate = await authStepUp();
  if ("res" in gate) return gate.res;
  try {
    return NextResponse.json({ entries: await listVaultEntries() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await authStepUp();
  if ("res" in gate) return gate.res;
  const input = parseVaultInput(await req.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "יש להזין לפחות שם וסיסמה" }, { status: 400 });
  try {
    await createVaultEntry(input, gate.user.id);
    return NextResponse.json({ entries: await listVaultEntries() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
