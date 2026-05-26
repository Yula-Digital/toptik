const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
};

export interface SpecItem {
  label: string;
  value: string;
}

export interface SpecSection {
  heading: string;
  items: SpecItem[];
}

export interface ColorSwatch {
  name: string;
  hex: string | null;
  swatchUrl: string | null;
}

export interface ProductDetails {
  specs: SpecSection[];
  colors: ColorSwatch[];
}

// ─── Measurement conversion ──────────────────────────────────────────────────

function inchesToCm(inches: number) {
  return Math.round(inches * 2.54 * 10) / 10;
}

function lbsToKg(lbs: number) {
  return Math.round(lbs * 0.453592 * 100) / 100;
}

function convertMeasurements(text: string): string {
  text = text.replace(
    /(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?)/gi,
    (_, a, b, c) =>
      `${inchesToCm(parseFloat(a))} × ${inchesToCm(parseFloat(b))} × ${inchesToCm(parseFloat(c))} ס"מ`,
  );
  text = text.replace(
    /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*cm\b/gi,
    (_, a, b, c) => `${a} × ${b} × ${c} ס"מ`,
  );
  text = text.replace(/(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?)\b/gi, (_, n) => {
    return `${inchesToCm(parseFloat(n))} ס"מ`;
  });
  text = text.replace(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/gi, (_, n) => {
    return `${lbsToKg(parseFloat(n))} ק"ג`;
  });
  text = text.replace(/(\d+(?:\.\d+)?)\s*kg\b/gi, (_, n) => `${n} ק"ג`);
  text = text.replace(/(\d+(?:\.\d+)?)\s*cm\b/gi, (_, n) => `${n} ס"מ`);
  return text;
}

// ─── Section whitelist + Hebrew translation ───────────────────────────────────

const ALLOWED_SECTION_KEYS = [
  "exterior", "external", "outside", "outer",
  "interior", "internal", "inside", "inner",
  "composition", "materials", "material", "fabric",
  "dimensions", "measurements", "dimension", "sizes",
  "weight",
];

const SECTION_MAP: Record<string, string> = {
  exterior: "חיצוני",
  external: "חיצוני",
  outside: "חיצוני",
  outer: "חיצוני",
  interior: "פנימי",
  internal: "פנימי",
  inside: "פנימי",
  inner: "פנימי",
  materials: "הרכב",
  material: "הרכב",
  composition: "הרכב",
  fabric: "הרכב",
  dimensions: "מידות",
  measurements: "מידות",
  dimension: "מידות",
  sizes: "מידות",
  weight: "משקל",
};

// Lenient match: accept heading if it contains any allowed key (e.g. "Exterior Features")
function isAllowedSection(heading: string): boolean {
  const key = heading.trim().toLowerCase();
  return ALLOWED_SECTION_KEYS.some((allowed) => key === allowed || key.includes(allowed));
}

function translateSection(heading: string): string {
  const key = heading.trim().toLowerCase();
  if (SECTION_MAP[key]) return SECTION_MAP[key];
  for (const [src, hebrew] of Object.entries(SECTION_MAP)) {
    if (key.includes(src)) return hebrew;
  }
  return heading;
}

// ─── Item content filter ─────────────────────────────────────────────────────

function isValidSpecItem(text: string): boolean {
  if (!text || text.length < 2) return false;
  if (text.length > 70) return false;
  if (/https?:\/\/|www\./i.test(text)) return false;
  if (/[€$£¥₪]\s*\d|\d+[.,]\d+\s*(eur|usd|gbp)/i.test(text)) return false;
  if (/instagram|facebook|twitter|youtube|tiktok|pinterest/i.test(text)) return false;
  if (/subscribe|follow us|shop now|discover|explore our|newsletter/i.test(text)) return false;
  return true;
}

// ─── Label translation ────────────────────────────────────────────────────────

const ITEM_LABEL_MAP: Record<string, string> = {
  weight: "משקל",
  closure: "סגירה",
  "shoulder strap": "רצועת כתף",
  strap: "רצועה",
  "strap length": "אורך רצועה",
  pocket: "כיס",
  pockets: "כיסים",
  "front pocket": "כיס קדמי",
  "back pocket": "כיס אחורי",
  "exterior pockets": "כיסים חיצוניים",
  "interior pockets": "כיסים פנימיים",
  dimensions: "מידות",
  material: "חומר",
  lining: "בטנה",
  external: "חיצוני",
  internal: "פנימי",
  zipper: "רוכסן",
};

function translateItemLabel(label: string): string {
  const key = label.trim().toLowerCase();
  return ITEM_LABEL_MAP[key] ?? label;
}

// ─── Color name → Hebrew + hex ────────────────────────────────────────────────

const COLOR_NAME_MAP: Record<string, string> = {
  black: "שחור", white: "לבן", red: "אדום", blue: "כחול", green: "ירוק",
  yellow: "צהוב", orange: "כתום", purple: "סגול", pink: "ורוד", brown: "חום",
  grey: "אפור", gray: "אפור", navy: "נייבי", beige: "בז'", taupe: "טאופ",
  camel: "גמל", tan: "שזוף", khaki: "חאקי", ivory: "שנהב", cream: "קרם",
  silver: "כסף", gold: "זהב", steel: "פלדה", pirite: "פיריט", diva: "דיווה",
  stone: "אבן", sand: "חול", teal: "טיל", wine: "יין", bordeaux: "בורדו",
  burgundy: "בורגונדי", latte: "לאטה", vanilla: "וניל", forest: "יער",
  sage: "מרווה", coral: "אלמוג", rust: "חלודה", terracotta: "טרקוטה",
  mustard: "חרדל", olive: "זית", cobalt: "קובלט", turquoise: "טורקיז",
  lilac: "לילך", lavender: "לבנדר", rose: "ורד", copper: "נחושת",
  bronze: "ברונזה", charcoal: "פחם",
};

function translateColorName(name: string): string {
  const key = name.trim().toLowerCase();
  if (COLOR_NAME_MAP[key]) return COLOR_NAME_MAP[key];
  const words = key.split(/\s+/);
  const translated = words.map((w) => COLOR_NAME_MAP[w] ?? w).join(" ");
  return translated !== key ? translated : name;
}

const COLOR_HEX_MAP: Record<string, string> = {
  black: "#1a1a1a", white: "#f5f5f5", red: "#cc2222", blue: "#1e4d9c",
  navy: "#1a2d5a", green: "#2d6e3a", yellow: "#f0c040", orange: "#e07020",
  purple: "#6b3fa0", pink: "#e8789a", brown: "#7a4228", grey: "#888888",
  gray: "#888888", beige: "#d4c4a8", taupe: "#8d7966", camel: "#c19a6b",
  tan: "#c4a264", khaki: "#8e8060", ivory: "#fffff0", cream: "#fffdd0",
  silver: "#c0c0c0", gold: "#d4a017", steel: "#6e7b8b", pirite: "#6e7060",
  diva: "#a52828", stone: "#9e9e8e", sand: "#d4b896", teal: "#2e8b8b",
  wine: "#6b1a2c", bordeaux: "#7c1c2c", burgundy: "#800020", latte: "#c4a882",
  vanilla: "#f3e5ab", coral: "#e07060", rust: "#b74e1a", mustard: "#c8a028",
  olive: "#6b7028", cobalt: "#0050a0", charcoal: "#3c3c3c",
};

function colorToHex(name: string): string | null {
  const key = name.trim().toLowerCase();
  if (COLOR_HEX_MAP[key]) return COLOR_HEX_MAP[key];
  for (const word of key.split(/\s+/)) {
    if (COLOR_HEX_MAP[word]) return COLOR_HEX_MAP[word];
  }
  return null;
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function clean(text: string): string {
  return decodeHtmlEntities(stripTags(text)).trim();
}

// ─── Spec extraction (scans HTML for whitelisted sections) ────────────────────

function extractSpecsFromHtml(html: string): SpecSection[] {
  const sections: SpecSection[] = [];
  let match: RegExpExecArray | null;

  // Pattern A: <strong>HEADING</strong><br>item<br>item (Mandarina Duck Shopify body_html style)
  const strongBlockRegex =
    /<(?:p|div)[^>]*>\s*<strong[^>]*>([^<]{2,60})<\/strong>(?:<br\s*\/?>|\n|\s)+([\s\S]*?)<\/(?:p|div)>/gi;
  const strongSections = new Map<string, string[]>();
  while ((match = strongBlockRegex.exec(html)) !== null) {
    const heading = clean(match[1]);
    if (!heading || !isAllowedSection(heading)) continue;
    const lines = match[2]
      .split(/<br\s*\/?>|<\/?li[^>]*>|<\/?p[^>]*>|\n/i)
      .map((l) => convertMeasurements(clean(l)))
      .filter(isValidSpecItem);
    if (lines.length > 0) {
      const existing = strongSections.get(heading) ?? [];
      strongSections.set(heading, [...existing, ...lines].slice(0, 12));
    }
  }
  for (const [heading, lines] of strongSections) {
    const items = lines.map((line) => {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0 && colonIdx < 35) {
        return {
          label: translateItemLabel(line.slice(0, colonIdx).trim()),
          value: line.slice(colonIdx + 1).trim(),
        };
      }
      return { label: line, value: "" };
    });
    sections.push({ heading: translateSection(heading), items });
  }
  if (sections.length > 0) return sections;

  // Pattern B: <h2>/<h3> heading followed by content
  const headingBlockRegex =
    /<h[23][^>]*>([^<]{2,60})<\/h[23]>\s*([\s\S]*?)(?=<h[23]|$)/gi;
  while ((match = headingBlockRegex.exec(html)) !== null) {
    const heading = clean(match[1]);
    if (!heading || !isAllowedSection(heading)) continue;
    const body = match[2];
    const items: SpecItem[] = [];
    // Try <li> items
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch: RegExpExecArray | null;
    while ((liMatch = liRegex.exec(body)) !== null) {
      const text = convertMeasurements(clean(liMatch[1]));
      if (!isValidSpecItem(text)) continue;
      const colonIdx = text.indexOf(":");
      if (colonIdx > 0 && colonIdx < 35) {
        items.push({ label: translateItemLabel(text.slice(0, colonIdx).trim()), value: text.slice(colonIdx + 1).trim() });
      } else {
        items.push({ label: text, value: "" });
      }
    }
    // Fallback: <br>-separated lines
    if (items.length === 0) {
      const lines = body.split(/<br\s*\/?>|\n/i).map((l) => convertMeasurements(clean(l))).filter(isValidSpecItem);
      for (const line of lines) {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0 && colonIdx < 35) {
          items.push({ label: translateItemLabel(line.slice(0, colonIdx).trim()), value: line.slice(colonIdx + 1).trim() });
        } else {
          items.push({ label: line, value: "" });
        }
      }
    }
    if (items.length > 0) {
      sections.push({ heading: translateSection(heading), items: items.slice(0, 12) });
    }
  }

  return sections;
}

// ─── Color extraction from page HTML (Shopify variant pattern) ────────────────

function extractColorsFromPageHtml(html: string): ColorSwatch[] {
  const swatches: ColorSwatch[] = [];
  let colorOptionIndex = 0;
  const optionMatch = /"options"\s*:\s*\[([^\]]{0,500})\]/i.exec(html);
  if (optionMatch) {
    const opts = optionMatch[1].toLowerCase();
    const colorIdx = opts.indexOf('"color"');
    const colourIdx = opts.indexOf('"colour"');
    if (colorIdx >= 0 || colourIdx >= 0) {
      const before = opts.slice(0, Math.max(colorIdx, colourIdx));
      colorOptionIndex = (before.match(/"/g) ?? []).length / 2;
    }
  }
  const seenColors = new Set<string>();
  const variantOptionKey = colorOptionIndex === 0 ? "option1" : colorOptionIndex === 1 ? "option2" : "option3";
  const variantRegex = new RegExp(`"${variantOptionKey}"\\s*:\\s*"([^"]+)"`, "gi");
  let variantMatch: RegExpExecArray | null;
  while ((variantMatch = variantRegex.exec(html)) !== null) {
    const colorName = variantMatch[1].trim();
    if (!colorName || seenColors.has(colorName.toLowerCase())) continue;
    seenColors.add(colorName.toLowerCase());
    swatches.push({
      name: translateColorName(colorName),
      hex: colorToHex(colorName),
      swatchUrl: null,
    });
  }
  return swatches;
}

// ─── Fetchers ────────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(14000),
  });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  return res.text();
}

function buildShopifyJsonUrls(sourceUrl: string): string[] {
  try {
    const url = new URL(sourceUrl);
    const urls = new Set<string>();
    // Variant 1: append .json to current path (preserves locale prefix)
    urls.add(`${url.origin}${url.pathname.replace(/\/$/, "")}.json`);
    // Variant 2: /products/<handle>.json without locale
    const parts = url.pathname.split("/").filter(Boolean);
    const productsIdx = parts.lastIndexOf("products");
    if (productsIdx !== -1 && parts[productsIdx + 1]) {
      const handle = parts[productsIdx + 1].split("?")[0];
      urls.add(`${url.origin}/products/${handle}.json`);
    }
    return [...urls];
  } catch {
    return [];
  }
}

interface ShopifyProduct {
  body_html?: string;
  options?: Array<{ name?: string; values?: string[] }>;
}

async function tryShopifyProductData(sourceUrl: string): Promise<{ bodyHtml: string | null; colors: ColorSwatch[] }> {
  for (const jsonUrl of buildShopifyJsonUrls(sourceUrl)) {
    try {
      const res = await fetch(jsonUrl, {
        headers: { ...DEFAULT_HEADERS, accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { product?: ShopifyProduct };
      const product = data?.product;
      if (!product) continue;

      // Extract colors from the Color option's full values list
      const colors: ColorSwatch[] = [];
      const colorOption = product.options?.find((o) => /colou?r/i.test(o?.name ?? ""));
      if (colorOption?.values?.length) {
        const seen = new Set<string>();
        for (const value of colorOption.values) {
          const v = String(value).trim();
          const key = v.toLowerCase();
          if (!v || seen.has(key)) continue;
          seen.add(key);
          colors.push({ name: translateColorName(v), hex: colorToHex(v), swatchUrl: null });
        }
      }
      return { bodyHtml: product.body_html ?? null, colors };
    } catch {
      continue;
    }
  }
  return { bodyHtml: null, colors: [] };
}

function extractDescriptionFromPage(pageHtml: string): string | null {
  // Try JSON-LD Product schema
  const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = jsonLdRegex.exec(pageHtml)) !== null) {
    try {
      const data = JSON.parse(match[1]) as Record<string, unknown>;
      if (data["@type"] === "Product" && typeof data.description === "string" && data.description.length > 30) {
        return data.description;
      }
    } catch {
      continue;
    }
  }
  const containerPatterns = [
    /<div[^>]*itemprop="description"[^>]*>([\s\S]{20,5000}?)<\/div>/i,
    /<div[^>]*class="[^"]*product[_-]?description[^"]*"[^>]*>([\s\S]{20,5000}?)<\/div>/i,
    /<section[^>]*class="[^"]*product[_-]?description[^"]*"[^>]*>([\s\S]{20,5000}?)<\/section>/i,
  ];
  for (const pattern of containerPatterns) {
    const m = pattern.exec(pageHtml);
    if (m?.[1] && m[1].length > 30) return m[1];
  }
  return null;
}

export async function fetchProductDetails(sourceUrl: string): Promise<ProductDetails> {
  if (!sourceUrl?.startsWith("http")) {
    return { specs: [], colors: [] };
  }

  // Layer 1: Shopify .json endpoint (cleanest source)
  const shopify = await tryShopifyProductData(sourceUrl);

  // Layer 2: page HTML (for sites that don't expose .json or for fallback)
  let pageHtml = "";
  try {
    pageHtml = await fetchHtml(sourceUrl);
  } catch {
    // Page fetch may fail; rely on Shopify data if available
  }

  // body_html source priority:
  //   Shopify .json body_html → JSON-LD description → product-description container → full page
  // Whitelist + content filter ensures only relevant data survives even from full page.
  const bodyHtml = shopify.bodyHtml ?? extractDescriptionFromPage(pageHtml) ?? pageHtml;
  const specs = bodyHtml ? extractSpecsFromHtml(bodyHtml) : [];

  // colors: prefer Shopify .json (has all variants), fall back to page scan
  const colors = shopify.colors.length > 0 ? shopify.colors : extractColorsFromPageHtml(pageHtml);

  return { specs, colors };
}
