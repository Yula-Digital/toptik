import { CatalogSourceProvider, SourceProduct } from "@/lib/catalog-source/types";

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

async function fetchProductLinksFromSitemap(catalogNumber: string) {
  const token = catalogNumber.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  if (!token) return [];

  const indexXml = await fetchHtml(`${MANDARINA_BASE_URL}/sitemap.xml`);
  const sitemapUrls = extractXmlLocEntries(indexXml)
    .filter((loc) => loc.includes("sitemap_products"))
    .slice(0, 8);

  const productLinks: string[] = [];
  for (const sitemapUrl of sitemapUrls) {
    try {
      const sitemapXml = await fetchHtml(sitemapUrl);
      const links = extractXmlLocEntries(sitemapXml).filter(
        (loc) => loc.includes("/products/") && loc.toLowerCase().includes(token),
      );
      productLinks.push(...links);
      if (productLinks.length > 0) break;
    } catch {
      // continue to next sitemap file
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

function extractDescription(html: string) {
  const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
  if (metaMatch?.[1]) return metaMatch[1].trim();
  return null;
}

function extractColor(html: string) {
  const match = html.match(/variant-option[^>]*>Color:\s*([^<]+)</i);
  return match?.[1]?.trim() || null;
}

function extractAccordionSections(html: string) {
  const matches = [...html.matchAll(/accordion__content[^>]*>([\s\S]*?)<\/div>/gi)];
  return matches.map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractDimensionsFromAccordion(html: string) {
  const sections = extractAccordionSections(html);
  const dimSection = sections.find((s) => /\d+[x×X]\d+[x×X]\d+/.test(s) && /cm|inc/i.test(s));
  if (dimSection) {
    const match = dimSection.match(/(\d+[x×X]\d+[x×X]\d+(?:\/\d+(?:[.,]\d+)?)?)\s*cm/i);
    if (match) return `${match[1].replace(/[×X]/g, "x")} cm`;
  }
  const breadcrumbMatch = html.match(
    /(?:cm\s+)?(\d{2,3}\s*[xX×]\s*\d{2,3}\s*[xX×]\s*\d{2,3}(?:\s*\/\s*\d{2,3}(?:[.,]\d+)?)?)\s*(?:cm)?/i,
  );
  if (breadcrumbMatch) {
    const raw = breadcrumbMatch[0].trim();
    const normalized = raw.replace(/[×X]/g, "x").replace(/\s+/g, " ").replace(/^cm\s+/i, "").trim();
    return normalized.endsWith("cm") ? normalized : `${normalized} cm`;
  }
  return null;
}

function extractWeight(html: string) {
  const sections = extractAccordionSections(html);
  const dimSection = sections.find((s) => /kg/i.test(s));
  if (dimSection) {
    const match = dimSection.match(/(\d+[.,]\d+)\s*KG/i);
    if (match) return `${match[1].replace(",", ".")} kg`;
  }
  return null;
}

function extractAvailableColors(html: string) {
  const tooltips = [...html.matchAll(/data-tooltip="([^"]+)"/gi)];
  const colors = tooltips
    .map((m) => m[1].trim())
    .filter((c) => c.length > 1 && c.length < 40);
  return [...new Set(colors)];
}

function extractSizes(html: string) {
  const sizeLabels: string[] = [];
  const sizeButtonMatches = [...html.matchAll(
    /(?:class="[^"]*size[^"]*"[^>]*>|size-button[^>]*>)\s*([^<]{2,20})\s*</gi,
  )];
  for (const m of sizeButtonMatches) {
    const label = m[1].trim();
    if (label && !label.includes("{") && !label.includes("<")) {
      sizeLabels.push(label);
    }
  }
  if (sizeLabels.length === 0) {
    const cmLabels = [...html.matchAll(/(\d{2,3}\s*cm(?:\s*EXP)?)/gi)];
    const unique = [...new Set(cmLabels.map((m) => m[1].trim()))];
    if (unique.length > 0 && unique.length <= 6) return unique;
  }
  return [...new Set(sizeLabels)];
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
        ? stripHtml(productBlock.description)
        : extractDescription(html),
    imageUrls: uniqueImageUrls(mergedImages).slice(0, MAX_IMPORTED_IMAGES),
    sourceUrl: productUrl,
    color: extractColor(html),
    dimensions: extractDimensionsFromAccordion(html),
    weight: extractWeight(html),
    sizes: extractSizes(html),
    availableColors: extractAvailableColors(html),
  };
}

export class MandarinaDuckScraperProvider implements CatalogSourceProvider {
  async fetchByCatalogNumber(catalogNumber: string): Promise<SourceProduct> {
    const normalizedCatalog = catalogNumber.trim().toUpperCase();
    if (!normalizedCatalog) {
      throw new Error("Catalog number is required");
    }

    const fullToken = normalizedCatalog.replace(/[^A-Z0-9]/g, "");
    const searchQueries = uniqueStrings([
      normalizedCatalog,
      fullToken,
      fullToken.length >= 8 ? fullToken.slice(0, 8) : "",
      normalizedCatalog.slice(0, 6),
    ]).filter((query) => query.length >= 3);

    let allProductLinks: string[] = [];
    for (const query of searchQueries) {
      const searchUrl = `${MANDARINA_BASE_URL}/search?q=${encodeURIComponent(
        query,
      )}&type=product&options%5Bprefix%5D=last`;
      try {
        const searchHtml = await fetchHtml(searchUrl);
        const links = extractProductLinks(searchHtml);
        allProductLinks.push(...links);
        if (allProductLinks.length > 0 && query === normalizedCatalog) break;
      } catch {
        // try next query variant
      }
    }

    allProductLinks = uniqueStrings(allProductLinks);

    if (allProductLinks.length === 0) {
      allProductLinks = await fetchProductLinksFromSitemap(normalizedCatalog);
    }

    if (allProductLinks.length === 0) {
      throw new Error("Product not found on Mandarina Duck");
    }

    const catalogSlug = fullToken.toLowerCase();
    const rankedLinks = [...allProductLinks].sort((a, b) => {
      const aHasCatalog = a.toLowerCase().includes(catalogSlug) ? 1 : 0;
      const bHasCatalog = b.toLowerCase().includes(catalogSlug) ? 1 : 0;
      return bHasCatalog - aHasCatalog;
    });

    let bestPage:
      | {
          url: string;
          html: string;
          score: number;
        }
      | undefined;

    for (const url of rankedLinks.slice(0, 8)) {
      try {
        const html = await fetchHtml(url);
        const upperHtml = html.toUpperCase();
        const hasExactCatalog = upperHtml.includes(normalizedCatalog) ? 10 : 0;
        const hasFullToken = upperHtml.includes(fullToken) ? 5 : 0;
        const slugBonus = url.toLowerCase().includes(catalogSlug) ? 3 : 0;
        const hasStructuredProduct = html.includes("application/ld+json") ? 1 : 0;
        const score = hasExactCatalog + hasFullToken + slugBonus + hasStructuredProduct;
        if (!bestPage || score > bestPage.score) {
          bestPage = { url, html, score };
        }
        if (hasExactCatalog) break;
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
