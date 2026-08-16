import type { CarouselItem, CachedTechSpecs } from "./types";
import { categorizeItem } from "./categories";
import { detectVendorFromCatalog, normalizeCatalogKey } from "@/lib/catalog-source/vendor-detect";
import { trimmedProductSrc } from "./trim-src";

// Builds the Shopify-shaped product sheet: ONE ROW PER SKU (a colour variant is
// its own SKU), variants of the same product tied together by `Product_Key`.
//
// Several columns are intentionally emitted empty: the catalog scrapers never
// captured commercial data (price, cost, stock, barcode) and `Collection` is a
// merchandising decision, not something stored here. They are kept in the sheet
// so the file matches the agreed import schema and can be filled in by hand.

// Widest tier /api/img-trim accepts. `withoutEnlargement` keeps it a ceiling, so
// smaller sources are served at their own size rather than upscaled.
const EXPORT_IMG_WIDTH = 2048;

// The two catalog buckets, in the exact vocabulary the import expects.
const TYPE_LABEL: Record<string, string> = {
  suitcase: "מזוודה",
  carryon: "טרולי",
};

// Brand names as they should land in Shopify's Vendor field.
const VENDOR_LABEL: Record<string, string> = {
  mandarina: "mandarinaduck",
  brics: "BRICS",
};

export interface ShopifyExportRow {
  SKU: string;
  Product_Key: string;
  Title_HE: string;
  Title_EN: string;
  Description_HE: string;
  Vendor: string;
  Type: string;
  Color: string;
  Size: string;
  Price: string;
  Quantity: string;
  Status: string;
  Image_1_URL: string;
  Image_2_URL: string;
  Barcode: string;
  // Numeric so the cell lands in the sheet as a real number, not text.
  Weight_kg: number | "";
  Collection: string;
  Tags: string;
  Material: string;
  Volume: string;
  Compare_At_Price: string;
  Cost: string;
}

// Authoritative column order — passed to json_to_sheet as its `header` so the
// sheet never depends on object key-insertion order.
export const SHOPIFY_EXPORT_COLUMNS: Array<keyof ShopifyExportRow> = [
  "SKU",
  "Product_Key",
  "Title_HE",
  "Title_EN",
  "Description_HE",
  "Vendor",
  "Type",
  "Color",
  "Size",
  "Price",
  "Quantity",
  "Status",
  "Image_1_URL",
  "Image_2_URL",
  "Barcode",
  "Weight_kg",
  "Collection",
  "Tags",
  "Material",
  "Volume",
  "Compare_At_Price",
  "Cost",
];

// Same order as SHOPIFY_EXPORT_COLUMNS.
export const SHOPIFY_EXPORT_COLUMN_WIDTHS = [
  22, 20, 60, 60, 90, 16, 12, 18, 26, 10, 10, 10, 80, 80, 14, 12, 20, 40, 30, 14, 18, 10,
];

// Spec labels are stored already translated (see catalog-source/product-details),
// so look them up by their Hebrew label with a few known synonyms.
function specValue(techSpecs: CachedTechSpecs | null | undefined, labels: string[]): string {
  if (!techSpecs?.specs) return "";
  const wanted = new Set(labels.map((l) => l.trim()));
  for (const section of techSpecs.specs) {
    for (const spec of section.items ?? []) {
      if (wanted.has(spec.label?.trim())) return spec.value?.trim() ?? "";
    }
  }
  return "";
}

// "3.5 ק״ג" → 3.5; "2,6 ק״ג" → 2.6; "850 גרם" → 0.85. Units and the European
// decimal comma are stripped so the cell is a bare number, which is what an
// import expects. Returns "" when no number is present.
function weightKg(raw: string): number | "" {
  if (!raw) return "";
  const match = raw.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) return "";
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return "";
  const isGrams = /גרם|\bg\b|\bgr\b/i.test(raw) && !/ק["״']?ג|\bkg\b/i.test(raw);
  const kg = isGrams ? value / 1000 : value;
  return Math.round(kg * 100) / 100;
}

// Titles are stored as the vendor wrote them; only the DESCRIPTION is translated
// on import. So a title counts as Hebrew only if it actually contains Hebrew
// letters (i.e. an editor rewrote it) — otherwise Title_HE is left blank and the
// source name goes to Title_EN, making the rows still needing a Hebrew name
// obvious instead of shipping English text in a column labelled Hebrew.
function splitTitle(title: string): { he: string; en: string } {
  const value = title?.trim() ?? "";
  return /[֐-׿]/.test(value) ? { he: value, en: "" } : { he: "", en: value };
}

// Absolute, publicly fetchable URL of an image AFTER the background trim — the
// same pipeline the catalog renders. Absolute against `origin` (the landing
// domain, which serves /api/img-trim) rather than the current page origin, so a
// sheet exported from a local dev run still holds usable URLs.
function publicImageUrl(path: string | null | undefined, origin: string): string {
  const trimmed = trimmedProductSrc(path, EXPORT_IMG_WIDTH);
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? `${origin.replace(/\/$/, "")}${trimmed}` : trimmed;
}

function tagsFor(vendor: string, type: string, color: string): string {
  return [vendor, type, color].filter(Boolean).join(", ");
}

// SKU for a colour that was scraped without its own catalog number. Mandarina
// catalogs carry the colour in their middle segment (P10QMC01-465-TU), so swap
// that segment for this colour's code rather than appending it — appending
// would leave the parent's colour code in a SKU belonging to another colour.
function deriveVariantSku(baseCatalog: string, colorCode: string | null): string {
  if (!baseCatalog || !colorCode) return baseCatalog;
  const segments = baseCatalog.split("-");
  if (segments.length >= 2) {
    segments[1] = colorCode;
    return segments.join("-");
  }
  return `${baseCatalog}-${colorCode}`;
}

// First two DISTINCT images of a gallery. Some products repeat the cover as
// their first angle; sending it twice would create a duplicate Shopify image.
function firstTwoImages(gallery: Array<string | null | undefined>, origin: string) {
  const urls: string[] = [];
  for (const path of gallery) {
    const url = publicImageUrl(path, origin);
    if (url && !urls.includes(url)) urls.push(url);
    if (urls.length === 2) break;
  }
  return { first: urls[0] ?? "", second: urls[1] ?? "" };
}

export function buildShopifyExportRows(items: CarouselItem[], origin: string): ShopifyExportRow[] {
  const rows: ShopifyExportRow[] = [];

  for (const item of [...items].sort((a, b) => a.displayOrder - b.displayOrder)) {
    const baseCatalog = item.catalogNumber?.trim() ?? "";
    // Every variant of a product shares the parent's catalog key. Items imported
    // without a catalog number fall back to their row id, which is just as stable.
    const productKey = normalizeCatalogKey(baseCatalog) || item.id;
    // detectVendorFromCatalog defaults to Bric's for anything that is not a
    // Mandarina pattern — including an empty string. Only claim a brand when
    // there is actually a catalog number to judge.
    const vendor = baseCatalog ? VENDOR_LABEL[detectVendorFromCatalog(baseCatalog)] ?? "" : "";
    const type = TYPE_LABEL[categorizeItem(item)] ?? "";
    const title = splitTitle(item.title);
    const description = item.description?.trim() ?? "";
    const size = specValue(item.techSpecs, ["מידות", "גודל"]);
    const material = specValue(item.techSpecs, ["חומר", "חומרים", "הרכב"]);
    const volume = specValue(item.techSpecs, ["נפח", "קיבולת"]);
    const weight = weightKg(specValue(item.techSpecs, ["משקל"]));

    const shared = {
      Product_Key: productKey,
      Title_HE: title.he,
      Title_EN: title.en,
      Description_HE: description,
      Vendor: vendor,
      Type: type,
      Size: size,
      Price: "",
      Quantity: "",
      // Always draft: these rows are NEW products in the target store, and
      // importing straight to active would publish them before anyone reviews
      // price and stock. `isActive` is deliberately NOT used here — it governs
      // visibility in the landing-page carousel, which is a separate concern
      // from a storefront's publication state.
      Status: "draft",
      Barcode: "",
      Weight_kg: weight,
      Collection: "",
      Material: material,
      Volume: volume,
      Compare_At_Price: "",
      Cost: "",
    };

    const colors = item.colors ?? [];

    if (colors.length === 0) {
      // Single-SKU product: cover image first, then the first rotation angle.
      const images = firstTwoImages(
        [item.coverImagePath, ...item.angles.map((a) => a.imagePath)],
        origin,
      );
      rows.push({
        SKU: baseCatalog,
        ...shared,
        Color: "",
        Image_1_URL: images.first,
        Image_2_URL: images.second,
        Tags: tagsFor(vendor, type, ""),
      });
      continue;
    }

    for (const color of colors) {
      // A colour's own gallery is the SKU's image set; its cover is angles[0].
      const images = firstTwoImages(
        color.angles?.length ? color.angles : [color.imagePath],
        origin,
      );
      // Colours scraped without their own catalog number get one derived from the
      // parent + the global colour code, so the SKU column is never blank.
      const sku = color.catalogNumber?.trim() || deriveVariantSku(baseCatalog, color.colorCode);
      rows.push({
        SKU: sku,
        ...shared,
        Color: color.name ?? "",
        Image_1_URL: images.first,
        Image_2_URL: images.second,
        Tags: tagsFor(vendor, type, color.name ?? ""),
      });
    }
  }

  return rows;
}
