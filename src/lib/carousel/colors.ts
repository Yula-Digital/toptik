import type { SourceColorVariant } from "@/lib/catalog-source/types";
import type { CarouselColor, CarouselItem } from "./types";
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
// gallery re-hosted for each variant (its rotation angles). Variants whose images
// couldn't be re-hosted are dropped (a swatch with no image can't drive a swap).
export function toCarouselColors(
  variants: SourceColorVariant[],
  galleryByHandle: Map<string, string[]>,
): CarouselColor[] {
  const colors: CarouselColor[] = [];
  const seen = new Set<string>();
  for (const variant of variants) {
    const angles = galleryByHandle.get(variant.handle) ?? [];
    if (angles.length === 0) continue;
    const { name, hex } = resolveColorMeta(variant.colorWord, variant.colorCode);
    const key = (variant.colorCode || variant.colorWord || variant.handle).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    colors.push({
      name,
      hex,
      colorCode: variant.colorCode,
      imagePath: angles[0],
      angles,
      sourceUrl: variant.sourceUrl,
      catalogNumber: variant.catalogNumber,
    });
  }
  return colors;
}

// Bric's colour naming: the colour is a plain English word/phrase from the
// Shopify "Color" option (Ocean, Bordeaux, Cappuccino...), and the colour code
// is the SKU suffix (BOE58117·050). Never consult MANDARINA_COLOR_CODES here —
// Bric's numeric codes can collide with Mandarina's and would resolve to the
// wrong Hebrew name.
function bricsColorMeta(colorWord: string | null): { name: string; hex: string | null } {
  const word = colorWord?.trim().toLowerCase() ?? null;
  if (!word) return { name: "צבע", hex: null };
  if (COLOR_HEBREW[word]) return { name: COLOR_HEBREW[word], hex: COLOR_HEX[word] ?? null };
  const translated = word
    .split(/\s+/)
    .map((w) => COLOR_HEBREW[w] ?? w)
    .join(" ");
  const hex = word.split(/\s+/).map((w) => COLOR_HEX[w]).find(Boolean) ?? null;
  return { name: translated !== word ? translated : colorWord!, hex };
}

export function toBricsCarouselColors(
  variants: SourceColorVariant[],
  galleryByHandle: Map<string, string[]>,
): CarouselColor[] {
  const colors: CarouselColor[] = [];
  const seen = new Set<string>();
  for (const variant of variants) {
    const angles = galleryByHandle.get(variant.handle) ?? [];
    if (angles.length === 0) continue;
    const { name, hex } = bricsColorMeta(variant.colorWord);
    const key = (variant.colorCode || variant.colorWord || variant.handle).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    colors.push({
      name,
      hex,
      colorCode: variant.colorCode,
      imagePath: angles[0],
      angles,
      sourceUrl: variant.sourceUrl,
      catalogNumber: variant.catalogNumber,
    });
  }
  return colors;
}

// Guarantee a product's OWN colour is present — a product always exists at least
// in the colour it was imported in. Uses the item's existing cover so it never
// ends up with zero colours even when sibling scraping fails entirely.
export function ensureOwnColor(
  colors: CarouselColor[],
  item: { catalogNumber: string | null; title?: string | null; coverImagePath: string },
): CarouselColor[] {
  if (!item.coverImagePath) return colors;
  const ownCode = colorCodeFromCatalog(item.catalogNumber);
  const hasOwn =
    (ownCode != null && colors.some((c) => c.colorCode?.toUpperCase() === ownCode)) ||
    colors.some((c) => c.imagePath === item.coverImagePath);
  if (hasOwn) return colors;
  const { name, hex } = resolveColorMeta(item.title ? extractColorWord(item.title) : null, ownCode);
  const own: CarouselColor = {
    name,
    hex,
    colorCode: ownCode,
    imagePath: item.coverImagePath,
    angles: [item.coverImagePath],
    sourceUrl: null,
    catalogNumber: item.catalogNumber,
  };
  return [own, ...colors];
}

// ─── UI swatch resolution ────────────────────────────────────────────────────

// A swatch ready to render. `imagePath` non-null ⇒ clicking swaps the displayed
// product image to that colour; null ⇒ a passive colour dot (title fallback).
export interface ResolvedSwatch {
  key: string;
  name: string;
  hex: string | null;
  imagePath: string | null; // cover (= angles[0])
  angles: string[]; // this colour's full gallery — drives rotation while selected
  isCurrent: boolean;
}

// Middle segment of a catalog number = the colour code. Handles both catalog
// styles: Mandarina dash-separated (P10·QMC01·`465`·TU) and Bric's dot-separated
// (BOE58117·`050`).
export function colorCodeFromCatalog(catalogNumber: string | null | undefined): string | null {
  if (!catalogNumber) return null;
  const parts = catalogNumber.toUpperCase().split(/[-_/.]/).filter(Boolean);
  return parts.length >= 2 ? parts[1] : null;
}

// Model code = first catalog segment minus the P-prefix (P10·`QMC01`·465·TU).
// Every colour of a product shares this code; the colour is the second segment.
export function modelCodeFromCatalog(catalogNumber: string | null | undefined): string | null {
  if (!catalogNumber) return null;
  const head = catalogNumber.toUpperCase().split(/[-_/]/)[0] ?? "";
  const stripped = head.replace(/^P\d+/, "");
  return stripped.length >= 4 ? stripped : null;
}

// Prefer the scraped per-colour set (real re-hosted galleries). Otherwise use the
// in-catalog model-sibling swatches. Each swatch carries the colour's full gallery
// so it stays rotatable; the item's OWN colour shows its curated imported angles.
export function resolveItemSwatches(
  item: CarouselItem,
  modelSiblings?: ResolvedSwatch[],
): ResolvedSwatch[] {
  if (item.colors && item.colors.length > 0) {
    const ownCode = colorCodeFromCatalog(item.catalogNumber);
    const ownAngles =
      item.angles.length > 0
        ? [...item.angles].sort((a, b) => a.angleOrder - b.angleOrder).map((a) => a.imagePath)
        : null;
    return item.colors.map((color) => {
      const isCurrent =
        ownCode != null && color.colorCode != null && color.colorCode.toUpperCase() === ownCode;
      const scraped = color.angles && color.angles.length > 0 ? color.angles : [color.imagePath];
      return {
        key: color.colorCode ?? color.name,
        name: color.name,
        hex: color.hex,
        imagePath: color.imagePath,
        angles: isCurrent && ownAngles ? ownAngles : scraped,
        isCurrent,
      };
    });
  }

  return modelSiblings ?? [];
}

// Fallback swatches (pre-warm) built from colour-variant ITEMS already in the
// catalog, grouped by EXACT model code so only true colour siblings merge — a
// swatch can never resolve to a different product (the wrong-product bug). Each
// swatch carries that sibling's own angle gallery, so colours stay rotatable
// without any scraped data.
export function buildModelSiblingSwatches(items: CarouselItem[]): Map<string, ResolvedSwatch[]> {
  const families = new Map<string, CarouselItem[]>();
  for (const item of items) {
    const model = modelCodeFromCatalog(item.catalogNumber);
    if (!model) continue;
    if (!families.has(model)) families.set(model, []);
    families.get(model)!.push(item);
  }

  const result = new Map<string, ResolvedSwatch[]>();
  for (const members of families.values()) {
    const seen = new Set<string>();
    const base: Array<{ code: string; swatch: Omit<ResolvedSwatch, "isCurrent"> }> = [];
    for (const member of members) {
      const code = (colorCodeFromCatalog(member.catalogNumber) ?? member.id).toUpperCase();
      if (seen.has(code)) continue;
      seen.add(code);
      const { name, hex } = resolveColorMeta(
        extractColorWord(member.title),
        colorCodeFromCatalog(member.catalogNumber),
      );
      const angles =
        member.angles.length > 0
          ? [...member.angles].sort((a, b) => a.angleOrder - b.angleOrder).map((a) => a.imagePath)
          : [member.coverImagePath];
      base.push({ code, swatch: { key: code, name, hex, imagePath: member.coverImagePath, angles } });
    }
    if (base.length < 2) continue; // need 2+ colours to form a selector

    for (const member of members) {
      const ownCode = (colorCodeFromCatalog(member.catalogNumber) ?? member.id).toUpperCase();
      result.set(
        member.id,
        base.map((b) => ({ ...b.swatch, isCurrent: b.code === ownCode })),
      );
    }
  }
  return result;
}
