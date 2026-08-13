import type { SourceProduct } from "@/lib/catalog-source/types";
import { fetchShopifyByUrl } from "@/lib/catalog-source/shopify-scraper";
import { fetchEmagByUrl } from "@/lib/catalog-source/emag-scraper";
import { fetchAmazonByUrl } from "@/lib/catalog-source/amazon-scraper";
import { normalizeCatalogKey } from "@/lib/catalog-source/vendor-detect";

// Web-search fallback: given a catalog number the direct sources couldn't find,
// search the whole web (Google Programmable Search / CSE) for it, then run each
// candidate result through the existing product scrapers and keep the first one
// whose scraped catalog actually matches — exactly what a human does manually.
//
// Gated on env: without GOOGLE_CSE_KEY + GOOGLE_CSE_ID it returns null (no
// behaviour change). Google CSE has a free 100-queries/day tier.

const CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";
const MAX_CANDIDATES = 6;

export function hasWebSearch(): boolean {
  return Boolean(process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_ID);
}

async function searchUrls(query: string): Promise<string[]> {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) {
    console.warn("[web-search] missing env", { hasKey: Boolean(key), hasCx: Boolean(cx) });
    return [];
  }
  try {
    const url = `${CSE_ENDPOINT}?key=${key}&cx=${cx}&num=8&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[web-search] CSE error", res.status, body.slice(0, 300));
      return [];
    }
    const data = (await res.json()) as { items?: Array<{ link?: string }> };
    const links = (data.items ?? []).map((i) => i.link).filter((l): l is string => Boolean(l));
    console.warn("[web-search] CSE ok", { query, count: links.length, first: links[0] });
    return links;
  } catch (e) {
    console.warn("[web-search] CSE threw", String(e));
    return [];
  }
}

// Scrape a single candidate URL with whichever scraper fits its host.
async function scrapeCandidate(url: string): Promise<SourceProduct | null> {
  const host = (() => {
    try {
      return new URL(url).host.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (!host) return null;

  if (/(^|\.)amazon\./.test(host)) return fetchAmazonByUrl(url);
  if (/(^|\.)emag\./.test(host)) return fetchEmagByUrl(url);
  // Everything else: try the generic Shopify scraper (only works on a
  // /products/<handle> URL, else returns null).
  if (/\/products\//.test(url)) return fetchShopifyByUrl(url);
  return null;
}

// The scraped product must actually be the one we searched for: its catalog key
// contains (or is contained by) the searched key. Prevents importing a lookalike.
function matchesCatalog(searchedKey: string, scraped: string | null | undefined): boolean {
  const got = normalizeCatalogKey(scraped ?? "");
  if (!got || searchedKey.length < 5) return false;
  return got.includes(searchedKey) || searchedKey.includes(got);
}

export async function findProductByWebSearch(catalog: string): Promise<SourceProduct | null> {
  if (!hasWebSearch()) return null;
  const key = normalizeCatalogKey(catalog);
  if (key.length < 5) return null;

  // Try the raw catalog, then a brand-qualified query, collecting candidate URLs.
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const query of [catalog, `${catalog} bag luggage`]) {
    for (const url of await searchUrls(query)) {
      if (seen.has(url)) continue;
      seen.add(url);
      candidates.push(url);
    }
    if (candidates.length >= MAX_CANDIDATES) break;
  }

  for (const url of candidates.slice(0, MAX_CANDIDATES)) {
    let product: SourceProduct | null = null;
    try {
      product = await scrapeCandidate(url);
    } catch {
      product = null;
    }
    if (product && matchesCatalog(key, product.catalogNumber)) {
      return product;
    }
  }
  return null;
}
