import { NextResponse } from "next/server";
import { getCarouselPayload } from "@/lib/carousel/repository";
import { buildItemColorGroups, extractColorWord, getFamilyKey } from "@/lib/carousel/color-groups";

export async function GET() {
  const payload = await getCarouselPayload();
  const activeItems = payload.items.filter(i => i.isActive);
  const colorGroups = buildItemColorGroups(activeItems);

  const itemDebug = activeItems.map(item => ({
    id: item.id,
    title: item.title,
    colorWord: extractColorWord(item.title),
    familyKey: getFamilyKey(item.title),
    hasColorGroup: colorGroups.has(item.id),
    swatches: colorGroups.get(item.id) ?? [],
  }));

  return NextResponse.json({
    totalItems: activeItems.length,
    itemsWithColors: itemDebug.filter(i => i.hasColorGroup).length,
    items: itemDebug,
  }, { headers: { "cache-control": "no-store" } });
}
