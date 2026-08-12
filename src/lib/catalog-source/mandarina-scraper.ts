import { CatalogSourceProvider, SourceColorVariant, SourceProduct } from "@/lib/catalog-source/types";
import { extractColorWord } from "@/lib/carousel/color-groups";

const MANDARINA_BASE_URL = "https://mandarinaduck.com";
const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
};
const MAX_IMPORTED_IMAGES = 20;

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function normalizeUrl(url: string) {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${MANDARINA_BASE_URL}${url}`;
  return `${MANDARINA_BASE_URL}/${url}`;
}

function stripHtml(input: string) {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeEscapedUrl(url: string) {
  return url.replace(/\\\//g, "/").replace(/&amp;/g, "&");
}

function canonicalImageUrl(url: string) {
  const normalized = normalizeUrl(decodeEscapedUrl(url));
  const [withoutQuery] = normalized.split("?");
  return withoutQuery
    .replace(/_(\d{2,4})x(\d{2,4})(?=\.(jpg|jpeg|png|webp)$)/i, "")
    .toLowerCase();
}

function uniqueImageUrls(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeUrl(decodeEscapedUrl(value));
    if (!/^https?:\/\//i.test(normalized)) continue;
    const key = canonicalImageUrl(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function isLikelyProductImage(url: string) {
  const normalized = normalizeUrl(decodeEscapedUrl(url));
  if (!normalized.includes("/cdn/shop/files/")) return false;

  const lower = normalized.toLowerCase();
  const blockedPatterns = [
    /\/cdn\/shop\/files\/md_black/i,
    /\/cdn\/shop\/files\/logo(?:_|-|\.)/i,
    /\/cdn\/shop\/files\/[^/]*icon/i,
    /\/cdn\/shop\/files\/[^/]*swatch/i,
    /\/cdn\/shop\/files\/[^/]*sprite/i,
    /\/cdn\/shop\/files\/[^/]*placeholder/i,
    /\/cdn\/shop\/files\/[^/]*favicon/i,
    /\/cdn\/shop\/files\/[^/]*payment/i,
    /\/cdn\/shop\/files\/[^/]*badge/i,
    /\/cdn\/shop\/files\/[^/]*dot-/i,
  ];
  return !blockedPatterns.some((pattern) => pattern.test(lower));
}

function prioritizeByCatalog(urls: string[], catalogNumber: string) {
  const normalizedCatalog = catalogNumber.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!normalizedCatalog) return urls;

  const exactMatches = urls.filter((url) => url.toUpperCase().includes(normalizedCatalog));
  if (exactMatches.length > 0) return exactMatches;

  const prefix = normalizedCatalog.slice(0, 6);
  if (prefix.length >= 4) {
    const prefixMatches = urls.filter((url) => url.toUpperCase().includes(prefix));
    if (prefixMatches.length > 0) return prefixMatches;
  }

  return urls;
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    throw new Error(`Mandarina request failed (${res.status}) for ${url}`);
  }
  return res.text();
}

function extractProductLinks(searchHtml: string) {
  const links: string[] = [];
  const regex = /href="([^"]*\/products\/[^"?#]+[^"]*)"/g;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(searchHtml)) !== null) {
    const url = normalizeUrl(decodeEscapedUrl(match[1]));
    if (url.includes("/products/")) links.push(url);
  }
  return uniqueStrings(links);
}

function extractXmlLocEntries(xml: string) {
  const locs: string[] = [];
  const regex = /<loc>([^<]+)<\/loc>/g;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(xml)) !== null) {
    locs.push(match[1].trim());
  }
  return uniqueStrings(locs);
}

// The product sitemap is the authoritative, complete list of every product
// handle (every colour of every model). Cache the index + each file across calls
// so enumerating many items in one warm/import run fetches each sitemap once.
let sitemapFilesPromise: Promise<string[]> | null = null;
const sitemapXmlCache = new Map<string, Promise<string>>();

async function getProductSitemapFiles(): Promise<string[]> {
  if (!sitemapFilesPromise) {
    sitemapFilesPromise = (async () => {
      try {
        const indexXml = await fetchHtml(`${MANDARINA_BASE_URL}/sitemap.xml`);
        return extractXmlLocEntries(indexXml)
          .filter((loc) => loc.includes("sitemap_products"))
          .slice(0, 64);
      } catch {
        return [];
      }
    })();
  }
  return sitemapFilesPromise;
}

async function fetchSitemapXml(url: string): Promise<string> {
  let cached = sitemapXmlCache.get(url);
  if (!cached) {
    cached = fetchHtml(url).catch(() => "");
    sitemapXmlCache.set(url, cached);
  }
  return cached;
}

// Scan EVERY product sitemap file for product URLs whose handle contains the
// model/catalog token. Deterministic and complete — does not depend on MD's
// /search returning the full colour set.
async function fetchProductLinksFromSitemap(tokenSource: string) {
  const token = tokenSource.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  if (!token) return [];

  const files = await getProductSitemapFiles();
  const productLinks: string[] = [];
  for (const sitemapUrl of files) {
    const xml = await fetchSitemapXml(sitemapUrl);
    if (!xml) continue;
    for (const loc of extractXmlLocEntries(xml)) {
      if (loc.includes("/products/") && loc.toLowerCase().includes(token)) {
        productLinks.push(loc);
      }
    }
  }
  return uniqueStrings(productLinks);
}

function extractJsonLdBlocks(html: string) {
  const blocks: unknown[] = [];
  const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      // ignore invalid structured-data blocks
    }
  }
  return blocks;
}

function extractImageUrlsFromText(input: string) {
  const urls: string[] = [];
  const productImageRegex =
    /(?:(?:https?:)?\\?\/\\?\/[^"'\\\s>]+\/cdn\/shop\/files\/[^"'\\\s>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s>]*)?)/gi;
  let match: RegExpExecArray | null = null;
  while ((match = productImageRegex.exec(input)) !== null) {
    urls.push(normalizeUrl(decodeEscapedUrl(match[0])));
  }
  return urls;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function collectMediaEntries(node: unknown, output: unknown[]) {
  if (Array.isArray(node)) {
    node.forEach((entry) => collectMediaEntries(entry, output));
    return;
  }

  const record = asRecord(node);
  if (!record) return;

  const media = record.media;
  if (Array.isArray(media)) {
    output.push(...media);
  }

  Object.values(record).forEach((value) => collectMediaEntries(value, output));
}

function extractUrlsFromMediaEntries(entries: unknown[]) {
  const urls: string[] = [];

  for (const entry of entries) {
    const record = asRecord(entry);
    if (!record) continue;

    const mediaType = String(record.media_type ?? "").toLowerCase();
    if (mediaType && mediaType !== "image") continue;

    const image = asRecord(record.image);
    const previewImage = asRecord(record.preview_image);
    const featuredImage = asRecord(record.featured_image);

    const candidates = [
      typeof record.src === "string" ? record.src : null,
      typeof record.url === "string" ? record.url : null,
      typeof image?.src === "string" ? image.src : null,
      typeof previewImage?.src === "string" ? previewImage.src : null,
      typeof featuredImage?.src === "string" ? featuredImage.src : null,
      typeof record.image === "string" ? record.image : null,
      typeof record.featured_image === "string" ? record.featured_image : null,
    ].filter((value): value is string => Boolean(value));

    urls.push(...candidates);
  }

  return urls;
}

function parseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractProductMediaUrlsFromJsonScripts(html: string) {
  const urls: string[] = [];
  const scriptRegex = /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null = null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;

    const parsed = parseJson(raw);
    if (!parsed) continue;

    const entries: unknown[] = [];
    collectMediaEntries(parsed, entries);
    urls.push(...extractUrlsFromMediaEntries(entries));
  }

  return urls;
}

function extractProductMediaUrlsFromEmbeddedSections(html: string) {
  const urls: string[] = [];
  const sectionRegex =
    /"media"\s*:\s*\[([\s\S]{0,120000}?)\](?=,\s*"(?:requires_selling_plan|options_with_values|variants|selected_or_first_available_variant|selling_plan_groups|featured_media)|\s*})/gi;
  let match: RegExpExecArray | null = null;

  while ((match = sectionRegex.exec(html)) !== null) {
    urls.push(...extractImageUrlsFromText(match[1]));
  }

  return urls;
}

function extractProductMediaUrlsFromScopedHtml(html: string) {
  const urls: string[] = [];
  const scopedRegex =
    /<[^>]+(?:product__media|product-media|ProductMedia|featured-media)[^>]*>[\s\S]*?<\/[^>]+>/gi;
  let match: RegExpExecArray | null = null;

  while ((match = scopedRegex.exec(html)) !== null) {
    urls.push(...extractImageUrlsFromText(match[0]));
  }

  return urls;
}

function extractImageUrlsFromProductPage(html: string, catalogNumber: string) {
  const jsonScriptMedia = extractProductMediaUrlsFromJsonScripts(html);
  const embeddedMedia = extractProductMediaUrlsFromEmbeddedSections(html);
  const scopedMedia = extractProductMediaUrlsFromScopedHtml(html);

  const merged = uniqueImageUrls([...jsonScriptMedia, ...embeddedMedia, ...scopedMedia]).filter(
    isLikelyProductImage,
  );
  return prioritizeByCatalog(merged, catalogNumber);
}

function extractCatalogNumberFromHtml(html: string, fallbackCatalogNumber: string) {
  const textPatterns = [
    /sku[^A-Za-z0-9]{0,10}([A-Za-z0-9._/\-]{4,64})/i,
    /catalog[^A-Za-z0-9]{0,10}([A-Za-z0-9._/\-]{4,64})/i,
    /item[_\s-]?number[^A-Za-z0-9]{0,10}([A-Za-z0-9._/\-]{4,64})/i,
  ];

  for (const pattern of textPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].trim().toUpperCase();
    }
  }

  return fallbackCatalogNumber.trim().toUpperCase();
}

function extractTitle(html: string) {
  const ogMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
  if (ogMatch?.[1]) return ogMatch[1].trim();
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) return titleMatch[1].trim();
  return "Mandarina Duck Product";
}

function extractProductFromPage(
  catalogNumber: string,
  productUrl: string,
  html: string,
): SourceProduct {
  const jsonLdBlocks = extractJsonLdBlocks(html);
  const productBlock = jsonLdBlocks.find((block) => {
    if (!block || typeof block !== "object") return false;
    const typed = block as { "@type"?: string };
    return typed["@type"] === "Product";
  }) as { name?: string; description?: string; image?: string | string[] } | undefined;

  const jsonLdImages = Array.isArray(productBlock?.image)
    ? productBlock.image
    : productBlock?.image
      ? [productBlock.image]
      : [];

  const fallbackImages = extractImageUrlsFromProductPage(html, catalogNumber);
  const mergedImages = uniqueStrings([
    ...jsonLdImages.map((url) => normalizeUrl(url)),
    ...fallbackImages,
  ])
    .filter((url) => /^https?:\/\//.test(url))
    .filter(isLikelyProductImage);

  if (mergedImages.length === 0) {
    throw new Error("No product gallery images detected on source page");
  }

  const normalizedCatalogNumber = extractCatalogNumberFromHtml(html, catalogNumber);

  return {
    catalogNumber: normalizedCatalogNumber,
    title: productBlock?.name?.trim() || extractTitle(html),
    description:
      productBlock?.description?.trim()
        ? stripHtml(productBlock.description).slice(0, 300) || null
        : null,
    imageUrls: uniqueImageUrls(mergedImages).slice(0, MAX_IMPORTED_IMAGES),
    sourceUrl: productUrl,
  };
}

// Rebuild the canonical dashed Mandarina catalog (P10XXXXX-YYY-TU) from any
// separator style: "P10SZV2405J", "P10-SZV24-05J", "p10 szv24 05j tu"...
// Format: P + 2 digits, 5-char model token, 3-char colour code, optional TU.
// Returns null when the token doesn't fit the format (input used as-is then).
export function canonicalMandarinaCatalog(input: string): string | null {
  const token = input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/TU$/, "");
  const match = /^(P\d{2})([A-Z0-9]{5})([A-Z0-9]{3})$/.exec(token);
  if (!match) return null;
  return `${match[1]}${match[2]}-${match[3]}-TU`;
}

export class MandarinaDuckScraperProvider implements CatalogSourceProvider {
  async fetchByCatalogNumber(catalogNumber: string): Promise<SourceProduct> {
    const rawInput = catalogNumber.trim().toUpperCase();
    if (!rawInput) {
      throw new Error("Catalog number is required");
    }

    // Accept any separator style (P10SZV2405J, P10 SZV24 05J, with/without the
    // -TU suffix) by rebuilding the canonical dashed catalog the site indexes.
    const canonical = canonicalMandarinaCatalog(rawInput);
    const normalizedCatalog = canonical ?? rawInput;
    const alnumCatalog = normalizedCatalog.replace(/[^A-Z0-9]/g, "");
    // Every MD product handle embeds model+colour (…-szv24a83) without the P10
    // prefix or TU suffix — the reliable key for validating links and for the
    // sitemap lookup.
    const slugToken = alnumCatalog
      .replace(/^P\d{2}/, "")
      .replace(/TU$/, "")
      .toLowerCase();

    const searchQueries = uniqueStrings([
      normalizedCatalog,
      rawInput,
      alnumCatalog,
      normalizedCatalog.slice(0, 6),
      normalizedCatalog.slice(0, 5),
    ]).filter((query) => query.length >= 3);

    let productLinks: string[] = [];
    for (const query of searchQueries) {
      const searchUrl = `${MANDARINA_BASE_URL}/search?q=${encodeURIComponent(
        query,
      )}&type=product&options%5Bprefix%5D=last`;
      try {
        const searchHtml = await fetchHtml(searchUrl);
        // The search page renders generic/recommended products when it has no
        // real match, so only links whose handle contains the model+colour
        // token count as results (prevents importing the wrong product).
        const links = extractProductLinks(searchHtml).filter(
          (link) => slugToken.length >= 5 && link.toLowerCase().includes(slugToken),
        );
        if (links.length > 0) {
          productLinks = links;
          break;
        }
      } catch {
        // try next query variant
      }
    }

    if (productLinks.length === 0) {
      productLinks = await fetchProductLinksFromSitemap(slugToken);
    }

    if (productLinks.length === 0) {
      throw new Error("Product not found on Mandarina Duck");
    }

    let bestPage:
      | {
          url: string;
          html: string;
          score: number;
        }
      | undefined;

    for (const url of productLinks.slice(0, 6)) {
      try {
        const html = await fetchHtml(url);
        const includesCatalog = html.toUpperCase().includes(normalizedCatalog) ? 2 : 0;
        const hasStructuredProduct = html.includes("application/ld+json") ? 1 : 0;
        const score = includesCatalog + hasStructuredProduct;
        if (!bestPage || score > bestPage.score) {
          bestPage = { url, html, score };
        }
      } catch {
        // try next candidate
      }
    }

    if (!bestPage) {
      throw new Error("Failed to fetch product page from source");
    }

    return extractProductFromPage(normalizedCatalog, bestPage.url, bestPage.html);
  }
}

// ─── Color-variant enumeration ───────────────────────────────────────────────
//
// On Mandarina Duck every colour of a product is a SEPARATE product page with
// its own handle + catalog number. The handle ends in "<model><colour>" (e.g.
// "qmc01465" = model QMC01 + colour 465) and the colour code is the middle
// segment of the catalog number (P10·QMC01·465·TU). So to list every colour of
// a model we search the 5-char model token — the SAME /search channel the
// single-product scraper already uses in production — and read each sibling
// product page. No bespoke theme-swatch HTML parsing required.

function handleFromUrl(url: string): string {
  const match = url.match(/\/products\/([^/?#]+)/i);
  return match ? match[1].toLowerCase() : "";
}

// Trailing "<model><colour>" token → 5-char model code (drop the 3-char colour).
function modelTokenFromHandle(handle: string): string | null {
  const tail = handle.split("-").pop() ?? "";
  if (tail.length < 6 || !/^[a-z]{2,}[a-z0-9]{3,}$/i.test(tail)) return null;
  return tail.slice(0, -3).toLowerCase();
}

function colorCodeFromHandle(handle: string): string | null {
  const tail = handle.split("-").pop() ?? "";
  if (tail.length < 6) return null;
  return tail.slice(-3).toUpperCase();
}

// The handle's colour word(s) sit between the product-type words and the trailing
// "<model><colour>" token — e.g. "md20-briefcase-deep-blue-qmc0107x". Dropping the
// last segment leaves a phrase that extractColorWord can scan for the colour.
function colorTextFromHandle(handle: string): string {
  const segments = handle.split("-");
  segments.pop();
  return segments.join(" ");
}

// Fallback model token from a catalog number like "P10QMC01-465-TU".
function modelTokenFromCatalog(catalogNumber: string): string | null {
  const head = (catalogNumber.toUpperCase().split(/[-_/]/)[0] ?? "").replace(/^P\d+/, "");
  return head.length >= 4 ? head.toLowerCase() : null;
}

// Minimal input the enumeration needs — usable from a full SourceProduct (import)
// or from a stored item row (warmer).
type ColorEnumerationInput = { sourceUrl: string; catalogNumber?: string | null };

function deriveModelToken(primary: ColorEnumerationInput): string | null {
  const handle = handleFromUrl(primary.sourceUrl);
  return (
    (handle ? modelTokenFromHandle(handle) : null) ??
    (primary.catalogNumber ? modelTokenFromCatalog(primary.catalogNumber) : null)
  );
}

async function fetchVariantHandlesByModel(modelToken: string): Promise<string[]> {
  const token = modelToken.toLowerCase();
  const handles = new Set<string>();

  const searchUrl = `${MANDARINA_BASE_URL}/search?q=${encodeURIComponent(
    modelToken,
  )}&type=product&options%5Bprefix%5D=last`;
  try {
    const html = await fetchHtml(searchUrl);
    for (const link of extractProductLinks(html)) {
      const handle = handleFromUrl(link);
      if (handle.includes(token)) handles.add(handle);
    }
  } catch {
    // fall through to sitemap
  }

  // ALWAYS union with the sitemap — MD's /search frequently returns only a
  // subset (or just the queried colour), so the sitemap is what guarantees the
  // complete same-model colour set.
  try {
    for (const link of await fetchProductLinksFromSitemap(modelToken)) {
      const handle = handleFromUrl(link);
      if (handle.includes(token)) handles.add(handle);
    }
  } catch {
    // tolerate — any search hits still stand
  }

  return [...handles];
}

const MAX_COLOR_VARIANTS = 16;
const MAX_ANGLES_PER_COLOR = 5;

// Does this handle's trailing "<model><colour>" token belong to `model5`? Every
// colour of a model shares the same 5-char model prefix in that token (e.g.
// "qmc01465", "qmc0109k" → model "qmc01"). This is the precise sibling test —
// it excludes "related product" links of OTHER models that share a title word.
function handleBelongsToModel(handle: string, model5: string): boolean {
  const tail = handle.split("-").pop() ?? "";
  const m = model5.toLowerCase();
  return tail.length >= m.length + 2 && tail.toLowerCase().startsWith(m);
}

// Colour code = middle catalog segment (P10·QMC01·`465`·TU). Reliable per-colour key.
function colorCodeFromCatalogNumber(catalog: string | null): string | null {
  if (!catalog) return null;
  const parts = catalog.toUpperCase().split(/[-_/]/).filter(Boolean);
  return parts.length >= 2 ? parts[1] : null;
}

// Pull every same-model sibling handle linked anywhere in a product page (the
// colour-swatch widget renders them as /products/<handle> links). Authoritative
// and complete — no dependence on MD's search returning the full colour set.
function extractSiblingHandles(html: string, model5: string): string[] {
  const handles = new Set<string>();
  const regex = /\/products\/([a-z0-9][a-z0-9-]*)/gi;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(html)) !== null) {
    const handle = match[1].toLowerCase();
    if (handleBelongsToModel(handle, model5)) handles.add(handle);
  }
  return [...handles];
}

// Given the primary product (one colour), discover every colour of that model and
// scrape each colour's full gallery (its rotation angles). Sibling discovery is
// the union of (a) swatch links on the primary page and (b) the model-token search
// — both filtered to the exact 5-char model so a swatch never resolves to a
// different product.
export async function enumerateColorVariants(primary: ColorEnumerationInput): Promise<SourceColorVariant[]> {
  const model5 = deriveModelToken(primary);
  if (!model5) return [];

  const primaryHandle = handleFromUrl(primary.sourceUrl);

  // (a) authoritative sibling links from the primary product page
  let pageHandles: string[] = [];
  try {
    pageHandles = extractSiblingHandles(await fetchHtml(primary.sourceUrl), model5);
  } catch {
    // page unavailable — rely on search fallback
  }

  // (b) model-token search, filtered to the exact model
  const searchHandles = (await fetchVariantHandlesByModel(model5)).filter((h) =>
    handleBelongsToModel(h, model5),
  );

  const handles = [...new Set([primaryHandle, ...pageHandles, ...searchHandles])].filter(Boolean);

  const scraped = await Promise.all(
    handles.slice(0, MAX_COLOR_VARIANTS).map(async (handle): Promise<SourceColorVariant | null> => {
      const sourceUrl = `${MANDARINA_BASE_URL}/products/${handle}`;
      try {
        const html = await fetchHtml(sourceUrl);
        const title = extractTitle(html);
        const catalogNumber = extractCatalogNumberFromHtml(html, "") || null;
        const imageUrls = extractImageUrlsFromProductPage(html, catalogNumber ?? "").slice(
          0,
          MAX_ANGLES_PER_COLOR,
        );
        if (imageUrls.length === 0) return null;
        return {
          colorWord: extractColorWord(title) ?? extractColorWord(colorTextFromHandle(handle)),
          colorCode: colorCodeFromCatalogNumber(catalogNumber) ?? colorCodeFromHandle(handle),
          title,
          catalogNumber,
          sourceUrl,
          handle,
          coverImageUrl: imageUrls[0],
          imageUrls,
        };
      } catch {
        return null;
      }
    }),
  );

  // De-duplicate by colour (code → word → handle), preserving discovery order.
  const seen = new Set<string>();
  const variants: SourceColorVariant[] = [];
  for (const variant of scraped) {
    if (!variant) continue;
    const key = (variant.colorCode || variant.colorWord || variant.handle).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push(variant);
  }
  return variants;
}

// Convenience used by the diagnostic probe: primary fetch + colour enumeration.
export async function scrapeColorVariantsByCatalog(
  catalogNumber: string,
): Promise<{ primary: SourceProduct; modelToken: string | null; variants: SourceColorVariant[] }> {
  const primary = await new MandarinaDuckScraperProvider().fetchByCatalogNumber(catalogNumber);
  const variants = await enumerateColorVariants(primary);
  return { primary, modelToken: deriveModelToken(primary), variants };
}

// Lightweight discovery for diagnostics: derive the model token straight from the
// catalog number and run only the /search step (one request, no per-page fetch),
// so it returns fast. Returns the sibling colour product handles of the model.
export async function discoverColorSiblingsByCatalog(
  catalogNumber: string,
): Promise<{ modelToken: string | null; handles: string[] }> {
  const modelToken = modelTokenFromCatalog(catalogNumber.toUpperCase());
  if (!modelToken) return { modelToken: null, handles: [] };
  const handles = await fetchVariantHandlesByModel(modelToken);
  return { modelToken, handles };
}
