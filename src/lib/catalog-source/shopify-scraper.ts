import type { SourceProduct } from "@/lib/catalog-source/types";

// Generic Shopify product-page scraper for the URL-import flow. Any Shopify
// storefront exposes a product's data at `<origin>/products/<handle>.json`, so
// this reads that directly — no per-retailer code. Used as the fallback in the
// URL-import route so ANY Shopify store (premiumbags, luggagepros, …) works out
// of the box. Fails soft to null when the URL isn't a Shopify product page.

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept: "application/json,text/html;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};
const MAX_IMPORTED_IMAGES = 20;

type ShopifyVariant = {
  id?: number;
  sku?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
};
type ShopifyProduct = {
  title: string;
  handle: string;
  vendor?: string | null;
  body_html?: string | null;
  options?: Array<{ name: string; values: string[] }>;
  variants?: ShopifyVariant[];
  images?: Array<{ src: string }>;
};

function stripHtml(input: string) {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function isDefault(value: string | null | undefined) {
  return !value || /^default title$/i.test(value.trim());
}

function optionIndex(product: ShopifyProduct, re: RegExp) {
  return (product.options ?? []).findIndex((o) => re.test(o.name));
}

function optionValueForVariant(variant: ShopifyVariant, index: number) {
  if (index < 0) return null;
  const key = `option${index + 1}` as "option1" | "option2" | "option3";
  return variant[key] ?? null;
}

function extractDimensionsCm(text: string): string | null {
  const m =
    /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*cm/i.exec(text);
  if (!m) return null;
  const n = (s: string) => s.replace(",", ".");
  return `${n(m[1])}x${n(m[2])}x${n(m[3])} cm`;
}

function extractWeightKg(text: string): string | null {
  const m = /(\d+(?:[.,]\d+)?)\s*kg\b/i.exec(text);
  return m ? `${m[1].replace(",", ".")} kg` : null;
}

export async function fetchShopifyByUrl(url: string): Promise<SourceProduct | null> {
  let origin: string;
  let handle: string;
  let variantId: number | null = null;
  try {
    const parsed = new URL(url);
    origin = parsed.origin;
    const match = parsed.pathname.match(/\/products\/([^/?#]+)/);
    if (!match) return null;
    handle = match[1];
    const raw = parsed.searchParams.get("variant");
    if (raw && /^\d+$/.test(raw)) variantId = Number.parseInt(raw, 10);
  } catch {
    return null;
  }

  let product: ShopifyProduct | null = null;
  try {
    const res = await fetch(`${origin}/products/${handle}.json`, {
      headers: HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { product?: ShopifyProduct };
    product = data?.product ?? null;
  } catch {
    return null;
  }
  if (!product?.title) return null;

  const images = (product.images ?? [])
    .map((i) => i.src)
    .filter((s) => /^https?:\/\//i.test(s))
    .slice(0, MAX_IMPORTED_IMAGES);
  if (images.length === 0) return null;

  const variants = product.variants ?? [];
  const variant =
    (variantId ? variants.find((v) => v.id === variantId) : null) ??
    variants.find((v) => v.sku?.trim()) ??
    variants[0];

  const colorIdx = optionIndex(product, /colou?r/i);
  const sizeIdx = optionIndex(product, /size|größe|méret/i);
  const color = variant ? optionValueForVariant(variant, colorIdx) : null;
  const availableColors = (colorIdx >= 0 ? product.options?.[colorIdx]?.values ?? [] : []).filter(
    (v) => !isDefault(v),
  );
  const sizeValues = sizeIdx >= 0 ? product.options?.[sizeIdx]?.values ?? [] : [];
  const currentSize = variant ? optionValueForVariant(variant, sizeIdx) : null;
  const sizes = sizeValues
    .filter((v) => !isDefault(v))
    .map((v) => (currentSize && v.toLowerCase() === currentSize.toLowerCase() ? `*${v}` : v));

  const sku = variant?.sku?.trim();
  const body = product.body_html ? stripHtml(product.body_html) : null;

  return {
    catalogNumber: (sku || product.handle).toUpperCase(),
    title: product.title.trim(),
    description: body,
    imageUrls: images,
    sourceUrl: `${origin}/products/${handle}`,
    color: isDefault(color) ? null : color,
    dimensions: extractDimensionsCm(body ?? ""),
    weight: extractWeightKg(body ?? ""),
    sizes,
    availableColors,
  };
}
