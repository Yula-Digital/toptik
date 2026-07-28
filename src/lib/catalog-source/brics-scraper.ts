import { CatalogSourceProvider, SourceColorVariant, SourceProduct } from "@/lib/catalog-source/types";

const BRICS_BASE_URL = "https://bricstore.com";
const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
};
const MAX_IMPORTED_IMAGES = 20;
const MAX_CATALOG_PAGES = 6;
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

type ShopifyOption = {
  name: string;
  position: number;
  values: string[];
};

type ShopifyVariant = {
  id?: number;
  sku?: string | null;
  title?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
};

type ShopifyImage = {
  src: string;
  position?: number;
};

type ShopifyProduct = {
  title: string;
  handle: string;
  body_html?: string | null;
  options?: ShopifyOption[];
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
};

let catalogCache: { products: ShopifyProduct[]; fetchedAt: number } | null = null;

function normalizeSku(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function stripHtml(input: string) {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(url: string) {
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`Brics request failed (${res.status}) for ${url}`);
  }
  return res;
}

async function fetchCatalogProducts(): Promise<ShopifyProduct[]> {
  if (catalogCache && Date.now() - catalogCache.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return catalogCache.products;
  }

  const products: ShopifyProduct[] = [];
  for (let page = 1; page <= MAX_CATALOG_PAGES; page += 1) {
    const res = await fetchWithTimeout(
      `${BRICS_BASE_URL}/products.json?limit=250&page=${page}`,
    );
    const data = (await res.json()) as { products?: ShopifyProduct[] };
    const batch = data.products ?? [];
    products.push(...batch);
    if (batch.length < 250) break;
  }

  if (products.length > 0) {
    catalogCache = { products, fetchedAt: Date.now() };
  }
  return products;
}

function findProductBySku(products: ShopifyProduct[], catalogNumber: string) {
  const target = normalizeSku(catalogNumber);
  if (!target) return null;

  let prefixMatch: { product: ShopifyProduct; variant: ShopifyVariant } | null = null;

  for (const product of products) {
    for (const variant of product.variants ?? []) {
      const sku = variant.sku?.trim();
      if (!sku) continue;
      const normalized = normalizeSku(sku);
      if (normalized === target) {
        return { product, variant };
      }
      if (!prefixMatch && (normalized.startsWith(target) || target.startsWith(normalized))) {
        prefixMatch = { product, variant };
      }
    }
  }

  return prefixMatch;
}

function findProductByHandle(products: ShopifyProduct[], handle: string) {
  return products.find((product) => product.handle === handle) ?? null;
}

function handleFromSourceUrl(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl) return null;
  const match = sourceUrl.match(/\/products\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function optionIndex(product: ShopifyProduct, optionName: string) {
  return (product.options ?? []).findIndex(
    (option) => option.name.toLowerCase() === optionName.toLowerCase(),
  );
}

function optionValueForVariant(
  product: ShopifyProduct,
  variant: ShopifyVariant,
  optionName: string,
) {
  const index = optionIndex(product, optionName);
  if (index === -1) return null;
  const key = `option${index + 1}` as "option1" | "option2" | "option3";
  return variant[key] ?? null;
}

function optionValues(product: ShopifyProduct, optionName: string) {
  const option = (product.options ?? []).find(
    (entry) => entry.name.toLowerCase() === optionName.toLowerCase(),
  );
  return option?.values ?? [];
}

// SKU suffix = the colour code (BOE58117·`050`).
function colorCodeFromSku(sku: string | null | undefined): string | null {
  if (!sku) return null;
  const segments = sku.split(".");
  return segments.length > 1 ? segments[segments.length - 1].toUpperCase() : null;
}

function baseSkuOf(sku: string) {
  const segments = sku.split(".");
  return segments.length > 1 ? segments.slice(0, -1).join(".") : sku;
}

function imageFileName(url: string) {
  const [withoutQuery] = url.split("?");
  const segments = withoutQuery.split("/");
  return (segments[segments.length - 1] ?? "").toUpperCase();
}

// Bric's image files are named `<baseSku>.<colorCode>.<viewIndex>.jpg`, so a
// variant's full rotation gallery is every image whose name starts with its SKU.
function selectVariantImages(product: ShopifyProduct, variantSku: string | null) {
  const images = (product.images ?? [])
    .map((image) => image.src)
    .filter((src) => /^https?:\/\//i.test(src));

  if (variantSku) {
    const exactPrefix = `${variantSku.toUpperCase()}.`;
    const variantImages = images.filter((src) => imageFileName(src).startsWith(exactPrefix));
    if (variantImages.length > 0) return variantImages;

    const basePrefix = `${baseSkuOf(variantSku).toUpperCase()}.`;
    const familyImages = images.filter((src) => imageFileName(src).startsWith(basePrefix));
    if (familyImages.length > 0) return familyImages;
  }

  return images;
}

type SpecBlock = {
  dimensions: string | null;
  weight: string | null;
};

function inchesToCm(value: number) {
  return Math.round(value * 2.54);
}

function lbsToKg(value: number) {
  return Math.round(value * 0.45359237 * 10) / 10;
}

function parseSpecBlocks(html: string): SpecBlock[] {
  const text = stripHtml(html);
  const blocks: SpecBlock[] = [];
  const dimensionRegex =
    /Dimensions:\s*([\d.]+)\s*(?:"|in(?:ch(?:es)?)?)?\s*w?\s*[x×]\s*([\d.]+)\s*(?:"|in(?:ch(?:es)?)?)?\s*h?\s*[x×]\s*([\d.]+)\s*(?:"|in(?:ch(?:es)?)?)?\s*d?/gi;

  let match: RegExpExecArray | null = null;
  while ((match = dimensionRegex.exec(text)) !== null) {
    const [w, h, d] = [match[1], match[2], match[3]].map((raw) => Number.parseFloat(raw));
    const dimensions =
      Number.isFinite(w) && Number.isFinite(h) && Number.isFinite(d)
        ? `${inchesToCm(w)}x${inchesToCm(h)}x${inchesToCm(d)} cm`
        : null;

    const tail = text.slice(match.index, match.index + 260);
    const weightMatch = tail.match(/Weight:\s*([\d.]+)\s*(lbs?|kg)/i);
    let weight: string | null = null;
    if (weightMatch) {
      const value = Number.parseFloat(weightMatch[1]);
      if (Number.isFinite(value)) {
        weight = weightMatch[2].toLowerCase().startsWith("kg")
          ? `${value} kg`
          : `${lbsToKg(value)} kg`;
      }
    }

    blocks.push({ dimensions, weight });
  }

  if (blocks.length === 0) {
    const weightMatch = text.match(/Weight:\s*([\d.]+)\s*(lbs?|kg)/i);
    if (weightMatch) {
      const value = Number.parseFloat(weightMatch[1]);
      blocks.push({
        dimensions: null,
        weight: Number.isFinite(value)
          ? weightMatch[2].toLowerCase().startsWith("kg")
            ? `${value} kg`
            : `${lbsToKg(value)} kg`
          : null,
      });
    }
  }

  return blocks;
}

function pickSpecBlock(blocks: SpecBlock[], sizeValues: string[], currentSize: string | null) {
  if (blocks.length === 0) return { dimensions: null, weight: null };
  if (currentSize && sizeValues.length > 1) {
    const sizeIndex = sizeValues.findIndex(
      (value) => value.toLowerCase() === currentSize.toLowerCase(),
    );
    if (sizeIndex >= 0 && sizeIndex < blocks.length) {
      return blocks[sizeIndex];
    }
  }
  return blocks[0];
}

// ─── Colour variant enumeration (same product, per-colour SKUs) ──────────────

export interface BricsColorEnumerationInput {
  sourceUrl: string | null;
  catalogNumber: string | null;
}

// Unlike Mandarina (a separate product page per colour), Bric's keeps every
// colour as a variant of ONE Shopify product, so enumeration is a lookup in the
// already-cached catalog — no extra page fetches.
export async function enumerateBricsColorVariants(
  input: BricsColorEnumerationInput,
): Promise<SourceColorVariant[]> {
  const products = await fetchCatalogProducts();

  let product: ShopifyProduct | null = null;
  if (input.catalogNumber) {
    product = findProductBySku(products, input.catalogNumber)?.product ?? null;
  }
  if (!product) {
    const handle = handleFromSourceUrl(input.sourceUrl);
    if (handle) product = findProductByHandle(products, handle);
  }
  if (!product) return [];

  const colorIdx = optionIndex(product, "color");
  if (colorIdx === -1) return [];
  const optionKey = `option${colorIdx + 1}` as "option1" | "option2" | "option3";

  const variants: SourceColorVariant[] = [];
  const seenColors = new Set<string>();

  for (const variant of product.variants ?? []) {
    const colorValue = variant[optionKey]?.trim();
    const sku = variant.sku?.trim();
    if (!colorValue || !sku) continue;
    const colorKey = colorValue.toLowerCase();
    if (seenColors.has(colorKey)) continue;

    const imageUrls = selectVariantImages(product, sku).slice(0, MAX_IMPORTED_IMAGES);
    if (imageUrls.length === 0) continue;

    seenColors.add(colorKey);
    const colorCode = colorCodeFromSku(sku);
    variants.push({
      colorWord: colorValue.toLowerCase(),
      colorCode,
      title: `${product.title} ${colorValue}`,
      catalogNumber: sku.toUpperCase(),
      sourceUrl: `${BRICS_BASE_URL}/products/${product.handle}${variant.id ? `?variant=${variant.id}` : ""}`,
      // Unique per colour; also used as the storage subfolder name, so keep it
      // path-safe.
      handle: `${product.handle}-${(colorCode ?? colorKey).toLowerCase().replace(/[^a-z0-9-]/g, "")}`,
      coverImageUrl: imageUrls[0],
      imageUrls,
    });
  }

  return variants;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export class BricsStoreScraperProvider implements CatalogSourceProvider {
  async fetchByCatalogNumber(catalogNumber: string): Promise<SourceProduct> {
    const normalizedInput = catalogNumber.trim().toUpperCase();
    if (!normalizedInput) {
      throw new Error("Catalog number is required");
    }

    const products = await fetchCatalogProducts();
    if (products.length === 0) {
      throw new Error("Failed to load Brics catalog");
    }

    const match = findProductBySku(products, normalizedInput);
    if (!match) {
      throw new Error("Product not found on Bric's store");
    }

    const { product, variant } = match;
    const variantSku = variant.sku?.trim() || null;
    const sourceUrl = `${BRICS_BASE_URL}/products/${product.handle}`;

    const imageUrls = selectVariantImages(product, variantSku).slice(0, MAX_IMPORTED_IMAGES);
    if (imageUrls.length === 0) {
      throw new Error("No product gallery images detected on source page");
    }

    const color = optionValueForVariant(product, variant, "color");
    const availableColors = optionValues(product, "color");
    const sizeValues = optionValues(product, "size");
    const currentSize = optionValueForVariant(product, variant, "size");
    const sizes = sizeValues.map((value) =>
      currentSize && value.toLowerCase() === currentSize.toLowerCase() ? `*${value}` : value,
    );

    let dimensions: string | null = null;
    let weight: string | null = null;
    try {
      const pageRes = await fetchWithTimeout(sourceUrl);
      const pageHtml = await pageRes.text();
      const specBlocks = parseSpecBlocks(pageHtml);
      const spec = pickSpecBlock(specBlocks, sizeValues, currentSize);
      dimensions = spec.dimensions;
      weight = spec.weight;
    } catch {
      // specs are best-effort; the import should not fail because of them
    }

    return {
      catalogNumber: variantSku?.toUpperCase() || normalizedInput,
      title: product.title?.trim() || `Bric's ${normalizedInput}`,
      description: product.body_html ? stripHtml(product.body_html) : null,
      imageUrls,
      sourceUrl,
      color,
      dimensions,
      weight,
      sizes,
      availableColors,
    };
  }
}
