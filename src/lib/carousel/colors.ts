import type { SourceColorVariant } from "@/lib/catalog-source/types";
import type { CarouselColor, CarouselItem } from "./types";
import { COLOR_HEX, COLOR_HEBREW, extractColorWord, getFamilyKey } from "./color-groups";

// Global Mandarina Duck colour codes — the middle segment of the catalog number
// (P10·QMC01·`465`·TU). The code is stable across every model, so it's the most
// reliable colour key. Derived from the live 28-product catalog; hex is an
// approximate swatch fill. Extend as new codes are observed.
export const MANDARINA_COLOR_CODES: Record<string, { he: string; hex: string }> = {
  "465": { he: "פלדה", hex: "#6e7b8b" }, // steel
  "09K": { he: "טאופ", hex: "#8d7966" }, // taupe
  "024": { he: "פיריט", hex: "#6e7060" }, // pirite
  A74: { he: "אויל", hex: "#3d4a1e" }, // oil
  A89: { he: "לונר", hex: "#b8b8c0" }, // lunar
  "29U": { he: "גרפיט", hex: "#555555" }, // graphite
  "08Q": { he: "כחול", hex: "#1a2d5a" }, // dress blue
  "05J": { he: "צהוב", hex: "#f0c040" }, // duck yellow
  A92: { he: "מוארה", hex: "#6b6f76" }, // moire
  A93: { he: "דיווה", hex: "#a52828" }, // diva
  "651": { he: "שחור", hex: "#1a1a1a" }, // black
  "07X": { he: "כחול עמוק", hex: "#1c3a6e" }, // deep blue
  "02F": { he: "אמרלד", hex: "#2e7d52" }, // emerald
  "24N": { he: "פנינה", hex: "#eae6da" }, // pearl
  A82: { he: "אגוז פקאן", hex: "#8a5a3b" }, // pecan nut
};

// Resolve a Hebrew name + swatch hex from the colour code (preferred, global)
// or the colour word parsed from the title (fallback).
export function resolveColorMeta(
  colorWord: string | null,
  colorCode: string | null,
): { name: string; hex: string | null } {
  const code = colorCode?.toUpperCase() ?? null;
  if (code && MANDARINA_COLOR_CODES[code]) {
    return { name: MANDARINA_COLOR_CODES[code].he, hex: MANDARINA_COLOR_CODES[code].hex };
  }
  const word = colorWord?.toLowerCase() ?? null;
  if (word) {
    return { name: COLOR_HEBREW[word] ?? colorWord!, hex: COLOR_HEX[word] ?? null };
  }
  return { name: code ?? "צבע", hex: null };
}

// Map scraped colour variants → persisted colours, attaching the Supabase-hosted
// cover image uploaded for each variant. Variants without an uploaded cover are
// dropped (a swatch with no image can't drive the image swap).
export function toCarouselColors(
  variants: SourceColorVariant[],
  coverByHandle: Map<string, string>,
): CarouselColor[] {
  const colors: CarouselColor[] = [];
  const seen = new Set<string>();
  for (const variant of variants) {
    const imagePath = coverByHandle.get(variant.handle);
    if (!imagePath) continue;
    const { name, hex } = resolveColorMeta(variant.colorWord, variant.colorCode);
    const key = (variant.colorCode || variant.colorWord || variant.handle).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    colors.push({
      name,
      hex,
      colorCode: variant.colorCode,
      imagePath,
      sourceUrl: variant.sourceUrl,
      catalogNumber: variant.catalogNumber,
    });
  }
  return colors;
}

// ─── UI swatch resolution ────────────────────────────────────────────────────

// A swatch ready to render. `imagePath` non-null ⇒ clicking swaps the displayed
// product image to that colour; null ⇒ a passive colour dot (title fallback).
export interface ResolvedSwatch {
  key: string;
  name: string;
  hex: string | null;
  imagePath: string | null;
  isCurrent: boolean;
}

// Middle segment of a catalog number = the colour code (P10·QMC01·`465`·TU).
export function colorCodeFromCatalog(catalogNumber: string | null | undefined): string | null {
  if (!catalogNumber) return null;
  const parts = catalogNumber.toUpperCase().split(/[-_/]/).filter(Boolean);
  return parts.length >= 2 ? parts[1] : null;
}

// Prefer the scraped per-colour set (real re-hosted photos). Otherwise use the
// sibling swatches built from colour-variant ITEMS already in the catalog — also
// real photos, just reused from existing items (see buildSiblingColorSwatches).
export function resolveItemSwatches(
  item: CarouselItem,
  siblingSwatches?: ResolvedSwatch[],
): ResolvedSwatch[] {
  if (item.colors && item.colors.length > 0) {
    const ownCode = colorCodeFromCatalog(item.catalogNumber);
    return item.colors.map((color) => ({
      key: color.colorCode ?? color.name,
      name: color.name,
      hex: color.hex,
      imagePath: color.imagePath,
      isCurrent:
        ownCode != null && color.colorCode != null && color.colorCode.toUpperCase() === ownCode,
    }));
  }

  return siblingSwatches ?? [];
}

// Build interactive swatches from colour-variant ITEMS already in the catalog,
// reusing each sibling's existing cover photo — no scraping needed. A product
// whose colours are separate catalog items gets a working colour selector for
// free; the colour scraper/warmer only needs to add colours NOT in the catalog.
export function buildSiblingColorSwatches(items: CarouselItem[]): Map<string, ResolvedSwatch[]> {
  const families = new Map<string, CarouselItem[]>();
  for (const item of items) {
    const key = getFamilyKey(item.title);
    if (!families.has(key)) families.set(key, []);
    families.get(key)!.push(item);
  }

  const result = new Map<string, ResolvedSwatch[]>();
  for (const members of families.values()) {
    const seen = new Set<string>();
    const base: Array<{ word: string; name: string; hex: string | null; imagePath: string }> = [];
    for (const member of members) {
      const word = extractColorWord(member.title);
      if (!word || seen.has(word) || !member.coverImagePath) continue;
      seen.add(word);
      base.push({
        word,
        name: COLOR_HEBREW[word] ?? word,
        hex: COLOR_HEX[word] ?? null,
        imagePath: member.coverImagePath,
      });
    }
    if (base.length < 2) continue; // need 2+ colours to form a selector
    for (const member of members) {
      const ownWord = extractColorWord(member.title);
      result.set(
        member.id,
        base.map((b) => ({
          key: b.word,
          name: b.name,
          hex: b.hex,
          imagePath: b.imagePath,
          isCurrent: b.word === ownWord,
        })),
      );
    }
  }
  return result;
}
