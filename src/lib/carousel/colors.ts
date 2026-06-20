import type { SourceColorVariant } from "@/lib/catalog-source/types";
import type { CarouselColor, CarouselItem } from "./types";
import type { ColorSwatch } from "@/lib/catalog-source/product-details";
import { COLOR_HEX, COLOR_HEBREW, extractColorWord } from "./color-groups";

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

// Prefer the scraped per-colour set (interactive, image-backed). Fall back to
// the title-derived sibling grouping (passive dots) when no colours are cached.
export function resolveItemSwatches(
  item: CarouselItem,
  fallback: ColorSwatch[] | undefined,
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

  if (fallback && fallback.length > 0) {
    const ownWord = extractColorWord(item.title);
    return fallback.map((swatch) => {
      const word =
        Object.entries(COLOR_HEBREW).find(([, value]) => value === swatch.name)?.[0] ??
        swatch.name.toLowerCase();
      return {
        key: swatch.name,
        name: swatch.name,
        hex: swatch.hex,
        imagePath: null,
        isCurrent: ownWord ? word === ownWord : false,
      };
    });
  }

  return [];
}
