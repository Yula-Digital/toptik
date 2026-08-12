import type { SourceProduct } from "@/lib/catalog-source/types";

// Amazon.de fallback for Mandarina Duck models that mandarinaduck.com no
// longer lists. LAST in the source-priority chain (official manufacturer site
// first) — used only when the official site has no match. Amazon serves
// bot-gate pages intermittently, so every step fails soft: a null return lets
// the caller report "not found" instead of importing a wrong product.

const AMAZON_BASE_URL = "https://www.amazon.de";
const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "de-DE,de;q=0.9,en;q=0.8",
  "cache-control": "no-cache",
};
const MAX_CANDIDATE_PAGES = 3;
const MAX_IMPORTED_IMAGES = 20;

function normalizeKey(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(html: string) {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: DEFAULT_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Bot gate / captcha page — treat as unavailable rather than parsing junk.
    if (/captcha|robot check|automatisierte zugriffe/i.test(html)) return null;
    return html;
  } catch {
    return null;
  }
}

function extractSearchAsins(searchHtml: string): string[] {
  const asins: string[] = [];
  const regex = /data-asin="([A-Z0-9]{10})"/g;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(searchHtml)) !== null) {
    if (!asins.includes(match[1])) asins.push(match[1]);
  }
  return asins;
}

function extractTitle(html: string): string | null {
  const match = /<span[^>]*id="productTitle"[^>]*>([\s\S]*?)<\/span>/.exec(html);
  return match ? stripTags(match[1]) : null;
}

function extractImages(html: string): string[] {
  const urls: string[] = [];
  const push = (url: string) => {
    const clean = url.replace(/\\\//g, "/");
    if (/^https:\/\//.test(clean) && !urls.includes(clean)) urls.push(clean);
  };
  for (const m of html.matchAll(/"hiRes"\s*:\s*"(https:[^"]+)"/g)) push(m[1]);
  if (urls.length === 0) {
    for (const m of html.matchAll(/"large"\s*:\s*"(https:[^"]+)"/g)) push(m[1]);
  }
  return urls.slice(0, MAX_IMPORTED_IMAGES);
}

function extractBullets(html: string): string {
  const block = /<div[^>]*id="feature-bullets"[^>]*>([\s\S]*?)<\/div>/.exec(html);
  if (!block) return "";
  const items = [...block[1].matchAll(/<span[^>]*class="[^"]*a-list-item[^"]*"[^>]*>([\s\S]*?)<\/span>/g)]
    .map((m) => stripTags(m[1]))
    .filter((text) => text.length > 2);
  return items.join(". ");
}

function extractDimensionsCm(text: string): string | null {
  const m =
    /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*cm/i.exec(text);
  if (!m) return null;
  const n = (s: string) => s.replace(",", ".");
  return `${n(m[1])}x${n(m[2])}x${n(m[3])} cm`;
}

function extractWeightKg(text: string): string | null {
  const kg = /(\d+(?:[.,]\d+)?)\s*(?:kg|kilogramm)\b/i.exec(text);
  if (kg) return `${kg[1].replace(",", ".")} kg`;
  const grams = /(\d+(?:[.,]\d+)?)\s*(?:g|gramm)\b/i.exec(text);
  if (grams) {
    const value = Math.round((parseFloat(grams[1].replace(",", ".")) / 1000) * 100) / 100;
    return value > 0 ? `${value} kg` : null;
  }
  return null;
}

function extractColor(html: string): string | null {
  const row =
    /Farbe\s*<\/(?:td|th|span)>[\s\S]{0,200}?<(?:td|span)[^>]*>\s*([^<]{2,40})</i.exec(html) ??
    /"color_name"[\s\S]{0,200}?"value"\s*:\s*"([^"]{2,40})"/i.exec(html);
  return row ? stripTags(row[1]) : null;
}

function extractModelNumber(html: string): string | null {
  const row =
    /(?:Herstellernummer|Modellnummer|Item model number|Artikelnummer)[\s\S]{0,260}?<(?:td|span)[^>]*>\s*([A-Za-z0-9._\/\-]{4,40})\s*</i.exec(
      html,
    );
  return row ? row[1].trim().toUpperCase() : null;
}

function asinFromUrl(url: string): string | null {
  const match = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i.exec(url);
  return match ? match[1].toUpperCase() : null;
}

// Import straight from a user-supplied Amazon product URL — no search, no
// brand gate (the human picked the exact page). Returns null only when the
// page can't be fetched/parsed (bot gate, no images).
export async function fetchAmazonByUrl(url: string): Promise<SourceProduct | null> {
  const asin = asinFromUrl(url);
  if (!asin) return null;
  let host = "www.amazon.de";
  try {
    host = new URL(url).host;
  } catch {
    // keep default
  }
  const productUrl = `https://${host}/dp/${asin}`;

  const html = await fetchHtml(productUrl);
  if (!html) return null;

  const title = extractTitle(html);
  const imageUrls = extractImages(html);
  if (!title || imageUrls.length === 0) return null;

  const bullets = extractBullets(html);
  const pageText = stripTags(html);

  return {
    catalogNumber: extractModelNumber(html) ?? asin,
    title,
    description: bullets || null,
    imageUrls,
    sourceUrl: productUrl,
    color: extractColor(html),
    dimensions: extractDimensionsCm(bullets) ?? extractDimensionsCm(pageText),
    weight: extractWeightKg(bullets) ?? extractWeightKg(pageText),
    sizes: [],
    availableColors: [],
  };
}

// Search amazon.de for the catalog number, then verify each candidate product
// page actually belongs to that model (brand mentioned + the model/colour token
// present) before trusting it — Amazon search happily returns lookalikes.
export async function fetchMandarinaFromAmazon(
  canonicalCatalog: string,
): Promise<SourceProduct | null> {
  const catalogKey = normalizeKey(canonicalCatalog);
  // Model+colour token without the P10 prefix / TU suffix (gxv24a32) — the
  // most reliable marker to appear somewhere on the listing.
  const slugToken = catalogKey.replace(/^P\d{2}/, "").replace(/TU$/, "");

  const queries = [canonicalCatalog, `Mandarina Duck ${slugToken}`];
  const asins: string[] = [];
  for (const query of queries) {
    const searchHtml = await fetchHtml(
      `${AMAZON_BASE_URL}/s?k=${encodeURIComponent(query)}`,
    );
    if (!searchHtml) continue;
    for (const asin of extractSearchAsins(searchHtml)) {
      if (!asins.includes(asin)) asins.push(asin);
    }
    if (asins.length > 0) break;
  }

  for (const asin of asins.slice(0, MAX_CANDIDATE_PAGES)) {
    const productUrl = `${AMAZON_BASE_URL}/dp/${asin}`;
    const html = await fetchHtml(productUrl);
    if (!html) continue;

    const pageKey = normalizeKey(html);
    const isMandarina = /mandarina\s*duck/i.test(html);
    const hasToken = slugToken.length >= 5 && pageKey.includes(slugToken);
    if (!isMandarina || !hasToken) continue;

    const title = extractTitle(html);
    const imageUrls = extractImages(html);
    if (!title || imageUrls.length === 0) continue;

    const bullets = extractBullets(html);
    const pageText = stripTags(html);

    return {
      catalogNumber: canonicalCatalog,
      title,
      description: bullets || null,
      imageUrls,
      sourceUrl: productUrl,
      color: extractColor(html),
      dimensions: extractDimensionsCm(bullets) ?? extractDimensionsCm(pageText),
      weight: extractWeightKg(bullets) ?? extractWeightKg(pageText),
      sizes: [],
      availableColors: [],
    };
  }

  return null;
}
