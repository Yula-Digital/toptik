import type { SourceProduct } from "@/lib/catalog-source/types";

// eMAG (emag.hu / .ro / .bg / .pl) product-page scraper for the URL-import flow.
// eMAG exposes clean schema.org Product JSON-LD (name, mpn = the real catalog
// number, description, gallery images on the akamaized CDN), so this reads that
// rather than scraping the DOM. Every step fails soft (null) so the caller can
// report "couldn't extract" instead of importing junk.

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};
const MAX_IMPORTED_IMAGES = 20;

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(html: string) {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

type JsonLdProduct = {
  "@type"?: string;
  name?: string;
  sku?: string;
  mpn?: string;
  description?: string;
  image?: string | string[];
};

function findProductJsonLd(html: string): JsonLdProduct | null {
  const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const blocks: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
    for (const block of blocks) {
      if (block && typeof block === "object" && (block as JsonLdProduct)["@type"] === "Product") {
        return block as JsonLdProduct;
      }
      // eMAG sometimes nests the product in @graph
      const graph = (block as { "@graph"?: unknown[] })?.["@graph"];
      if (Array.isArray(graph)) {
        for (const node of graph) {
          if (node && typeof node === "object" && (node as JsonLdProduct)["@type"] === "Product") {
            return node as JsonLdProduct;
          }
        }
      }
    }
  }
  return null;
}

// The JSON-LD usually lists only the cover; the full gallery lives in the HTML
// under the same /products/<a>/<b>/images/ folder. Collect both, drop the CDN
// resize query so each is the full-size original, and dedupe.
function collectImages(html: string, jsonLdImage: string | string[] | undefined): string[] {
  const fromJsonLd = (Array.isArray(jsonLdImage) ? jsonLdImage : jsonLdImage ? [jsonLdImage] : [])
    .map((u) => decodeEntities(u));

  const seed = fromJsonLd.find((u) => /\/products\/.*\/images\//.test(u));
  const folderPrefix = seed ? seed.split("/images/")[0] + "/images/" : null;

  const fromHtml: string[] = [];
  if (folderPrefix) {
    const escaped = folderPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${escaped}res_[a-f0-9]+\\.jpe?g`, "gi");
    let m: RegExpExecArray | null = null;
    while ((m = re.exec(html)) !== null) fromHtml.push(m[0]);
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of [...fromJsonLd, ...fromHtml]) {
    const base = raw.split("?")[0];
    if (!/^https:\/\//i.test(base)) continue;
    if (seen.has(base)) continue;
    seen.add(base);
    result.push(base);
  }
  return result.slice(0, MAX_IMPORTED_IMAGES);
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

export async function fetchEmagByUrl(url: string): Promise<SourceProduct | null> {
  let html: string;
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const product = findProductJsonLd(html);
  if (!product?.name) return null;

  const images = collectImages(html, product.image);
  if (images.length === 0) return null;

  const description = product.description ? stripTags(product.description) : null;
  const catalog = (product.mpn || product.sku || "").toUpperCase();
  const pageText = stripTags(html).slice(0, 20000);

  return {
    catalogNumber: catalog || `EMAG-${url.split("/pd/")[1]?.split("/")[0] ?? ""}`,
    title: stripTags(product.name),
    description,
    imageUrls: images,
    sourceUrl: url.split("?")[0],
    color: null,
    dimensions:
      extractDimensionsCm(description ?? "") ?? extractDimensionsCm(pageText),
    weight: extractWeightKg(description ?? "") ?? extractWeightKg(pageText),
    sizes: [],
    availableColors: [],
  };
}
