import { CatalogSourceProvider, SourceColorImage, SourceProduct } from "@/lib/catalog-source/types";

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

function optionValueForVariant(
  product: ShopifyProduct,
  variant: ShopifyVariant,
  optionName: string,
) {
  const index = (product.options ?? []).findIndex(
    (option) => option.name.toLowerCase() === optionName.toLowerCase(),
  );
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

function baseSkuOf(sku: string) {
  const segments = sku.split(".");
  return segments.length > 1 ? segments.slice(0, -1).join(".") : sku;
}

function imageFileName(url: string) {
  const [withoutQuery] = url.split("?");
  const segments = withoutQuery.split("/");
  return (segments[segments.length - 1] ?? "").toUpperCase();
}

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

function collectOtherColorImages(
  product: ShopifyProduct,
  currentColor: string | null,
): SourceColorImage[] {
  const colorIndex = (product.options ?? []).findIndex(
    (option) => option.name.toLowerCase() === "color",
  );
  if (colorIndex === -1) return [];
  const optionKey = `option${colorIndex + 1}` as "option1" | "option2" | "option3";

  const result: SourceColorImage[] = [];
  const seenColors = new Set<string>(currentColor ? [currentColor.toLowerCase()] : []);

  for (const variant of product.variants ?? []) {
    const variantColor = variant[optionKey]?.trim();
    const variantSku = variant.sku?.trim();
    if (!variantColor || !variantSku) continue;
    if (seenColors.has(variantColor.toLowerCase())) continue;

    const [firstImage] = selectVariantImages(product, variantSku);
    if (!firstImage) continue;

    seenColors.add(variantColor.toLowerCase());
    result.push({ color: variantColor, imageUrl: firstImage });
  }

  return result;
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
      catalogNumber: variantSku || normalizedInput,
      title: product.title?.trim() || `Bric's ${normalizedInput}`,
      description: product.body_html ? stripHtml(product.body_html) : null,
      imageUrls,
      sourceUrl,
      color,
      dimensions,
      weight,
      sizes,
      availableColors,
      colorImages: collectOtherColorImages(product, color),
    };
  }
}
