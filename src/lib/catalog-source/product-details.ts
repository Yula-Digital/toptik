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
  // 13.4" x 9.8" x 4.7" → 34 × 24.9 × 11.9 ס"מ
  text = text.replace(
    /(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?)/gi,
    (_, a, b, c) =>
      `${inchesToCm(parseFloat(a))} × ${inchesToCm(parseFloat(b))} × ${inchesToCm(parseFloat(c))} ס"מ`,
  );
  // 12 x 25 x 33 cm
  text = text.replace(
    /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*cm\b/gi,
    (_, a, b, c) => `${a} × ${b} × ${c} ס"מ`,
  );
  // single inch value
  text = text.replace(/(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?)\b/gi, (_, n) => {
    return `${inchesToCm(parseFloat(n))} ס"מ`;
  });
  // lbs
  text = text.replace(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/gi, (_, n) => {
    return `${lbsToKg(parseFloat(n))} ק"ג`;
  });
  // kg (already metric — keep as is with Hebrew unit)
  text = text.replace(/(\d+(?:\.\d+)?)\s*kg\b/gi, (_, n) => `${n} ק"ג`);
  // cm (single value)
  text = text.replace(/(\d+(?:\.\d+)?)\s*cm\b/gi, (_, n) => `${n} ס"מ`);
  return text;
}

// ─── Whitelist — only these sections are allowed ──────────────────────────────

const ALLOWED_SECTION_KEYS = new Set([
  "exterior", "external", "outside", "outer",
  "interior", "internal", "inside", "inner",
  "composition", "materials", "material", "fabric",
  "dimensions", "measurements", "dimension", "sizes",
  "weight",
]);

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

function translateSection(heading: string): string {
  const key = heading.trim().toLowerCase();
  return SECTION_MAP[key] ?? heading;
}

function isAllowedSection(heading: string): boolean {
  return ALLOWED_SECTION_KEYS.has(heading.trim().toLowerCase());
}

// ─── Item filtering ───────────────────────────────────────────────────────────

function isValidSpecItem(text: string): boolean {
  if (!text || text.length < 2) return false;
  // Items longer than 70 chars are usually marketing sentences, not spec values
  if (text.length > 70) return false;
  if (/https?:\/\/|www\./i.test(text)) return false;
  if (/[€$£¥₪]\s*\d|\d+[.,]\d+\s*(eur|usd|gbp)/i.test(text)) return false;
  if (/instagram|facebook|twitter|youtube|tiktok|pinterest/i.test(text)) return false;
  if (/subscribe|follow us|shop now|discover|explore our/i.test(text)) return false;
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

// ─── Color name → Hebrew ──────────────────────────────────────────────────────

const COLOR_NAME_MAP: Record<string, string> = {
  black: "שחור",
  white: "לבן",
  red: "אדום",
  blue: "כחול",
  green: "ירוק",
  yellow: "צהוב",
  orange: "כתום",
  purple: "סגול",
  pink: "ורוד",
  brown: "חום",
  grey: "אפור",
  gray: "אפור",
  navy: "נייבי",
  beige: "בז'",
  taupe: "טאופ",
  camel: "גמל",
  tan: "שזוף",
  khaki: "חאקי",
  ivory: "שנהב",
  cream: "קרם",
  silver: "כסף",
  gold: "זהב",
  steel: "פלדה",
  pirite: "פיריט",
  diva: "דיווה",
  stone: "אבן",
  sand: "חול",
  teal: "טיל",
  wine: "יין",
  bordeaux: "בורדו",
  burgundy: "בורגונדי",
  latte: "לאטה",
  vanilla: "וניל",
  forest: "יער",
  sage: "מרווה",
  coral: "אלמוג",
  rust: "חלודה",
  terracotta: "טרקוטה",
  mustard: "חרדל",
  olive: "זית",
  cobalt: "קובלט",
  turquoise: "טורקיז",
  lilac: "לילך",
  lavender: "לבנדר",
  rose: "ורד",
  copper: "נחושת",
  bronze: "ברונזה",
  charcoal: "פחם",
};

function translateColorName(name: string): string {
  const key = name.trim().toLowerCase();
  if (COLOR_NAME_MAP[key]) return COLOR_NAME_MAP[key];
  const words = key.split(/\s+/);
  const translated = words.map((w) => COLOR_NAME_MAP[w] ?? w).join(" ");
  return translated !== key ? translated : name;
}

const COLOR_HEX_MAP: Record<string, string> = {
  black: "#1a1a1a",
  white: "#f5f5f5",
  red: "#cc2222",
  blue: "#1e4d9c",
  navy: "#1a2d5a",
  green: "#2d6e3a",
  yellow: "#f0c040",
  orange: "#e07020",
  purple: "#6b3fa0",
  pink: "#e8789a",
  brown: "#7a4228",
  grey: "#888888",
  gray: "#888888",
  beige: "#d4c4a8",
  taupe: "#8d7966",
  camel: "#c19a6b",
  tan: "#c4a264",
  khaki: "#8e8060",
  ivory: "#fffff0",
  cream: "#fffdd0",
  silver: "#c0c0c0",
  gold: "#d4a017",
  steel: "#6e7b8b",
  pirite: "#6e7060",
  diva: "#a52828",
  stone: "#9e9e8e",
  sand: "#d4b896",
  teal: "#2e8b8b",
  wine: "#6b1a2c",
  bordeaux: "#7c1c2c",
  burgundy: "#800020",
  latte: "#c4a882",
  vanilla: "#f3e5ab",
  coral: "#e07060",
  rust: "#b74e1a",
  mustard: "#c8a028",
  olive: "#6b7028",
  cobalt: "#0050a0",
  charcoal: "#3c3c3c",
};

function colorToHex(name: string): string | null {
  const key = name.trim().toLowerCase();
  if (COLOR_HEX_MAP[key]) return COLOR_HEX_MAP[key];
  for (const word of key.split(/\s+/)) {
    if (COLOR_HEX_MAP[word]) return COLOR_HEX_MAP[word];
  }
  return null;
}

// ─── HTML parsing helpers ─────────────────────────────────────────────────────

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

// ─── Spec extraction ──────────────────────────────────────────────────────────

function extractSpecsFromHtml(html: string): SpecSection[] {
  const sections: SpecSection[] = [];

  // Attempt 1: <strong>HEADING</strong><br>item<br>item pattern (Mandarina Duck body_html style)
  const strongBlockRegex =
    /<(?:p|div)[^>]*>\s*<strong[^>]*>([^<]{2,60})<\/strong>(?:<br\s*\/?>|\n)([\s\S]*?)<\/(?:p|div)>/gi;
  let match: RegExpExecArray | null;
  const strongSections = new Map<string, string[]>();

  while ((match = strongBlockRegex.exec(html)) !== null) {
    const heading = clean(match[1]);
    if (!heading || !isAllowedSection(heading)) continue;
    const body = match[2];
    const lines = body
      .split(/<br\s*\/?>/i)
      .map((l) => convertMeasurements(clean(l)))
      .filter(isValidSpecItem);
    if (lines.length > 0) {
      const existing = strongSections.get(heading) ?? [];
      strongSections.set(heading, [...existing, ...lines]);
    }
  }

  for (const [heading, lines] of strongSections) {
    const items = lines.map((line) => {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0 && colonIdx < 35) {
        const label = translateItemLabel(line.slice(0, colonIdx).trim());
        const value = line.slice(colonIdx + 1).trim();
        return { label, value };
      }
      return { label: line, value: "" };
    });
    sections.push({ heading: translateSection(heading), items });
  }

  if (sections.length > 0) return sections;

  // Attempt 2: heading tags followed by lists (only whitelisted headings)
  const headingBlockRegex =
    /<h[23][^>]*>([^<]{2,60})<\/h[23]>\s*([\s\S]*?)(?=<h[23]|$)/gi;
  while ((match = headingBlockRegex.exec(html)) !== null) {
    const heading = clean(match[1]);
    if (!heading || !isAllowedSection(heading)) continue;
    const body = match[2];

    const items: SpecItem[] = [];
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

    if (items.length > 0) {
      sections.push({ heading: translateSection(heading), items });
    }
  }

  return sections;
}

// ─── Color extraction ─────────────────────────────────────────────────────────

function extractColorsFromShopifyJson(html: string): ColorSwatch[] {
  const swatches: ColorSwatch[] = [];

  // Find which option index is "Color"
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

// Try Shopify product JSON endpoint — returns clean body_html without page noise
async function tryShopifyProductJson(sourceUrl: string): Promise<string | null> {
  try {
    const url = new URL(sourceUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const productsIdx = parts.lastIndexOf("products");
    if (productsIdx === -1 || !parts[productsIdx + 1]) return null;
    const handle = parts[productsIdx + 1].split("?")[0];
    const jsonUrl = `${url.origin}/products/${handle}.json`;
    const res = await fetch(jsonUrl, {
      headers: DEFAULT_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { product?: { body_html?: string } };
    return data?.product?.body_html ?? null;
  } catch {
    return null;
  }
}

// Extract product description HTML from full page (JSON-LD and specific containers only)
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

  // Try product description containers (narrow patterns only)
  const containerPatterns = [
    /<div[^>]*itemprop="description"[^>]*>([\s\S]{20,3000}?)<\/div>/i,
    /<div[^>]*class="[^"]*product[_-]?description[^"]*"[^>]*>([\s\S]{20,3000}?)<\/div>/i,
    /<section[^>]*class="[^"]*product[_-]?description[^"]*"[^>]*>([\s\S]{20,3000}?)<\/section>/i,
  ];

  for (const pattern of containerPatterns) {
    const m = pattern.exec(pageHtml);
    if (m?.[1] && m[1].length > 30) return m[1];
  }

  return null; // Never fall through to full page
}

export async function fetchProductDetails(sourceUrl: string): Promise<ProductDetails> {
  if (!sourceUrl?.startsWith("http")) {
    return { specs: [], colors: [] };
  }

  const pageHtml = await fetchHtml(sourceUrl);
  const colors = extractColorsFromShopifyJson(pageHtml);

  // Priority: Shopify JSON endpoint (clean body_html) → JSON-LD → specific containers
  const bodyHtml = (await tryShopifyProductJson(sourceUrl)) ?? extractDescriptionFromPage(pageHtml);
  const specs = bodyHtml ? extractSpecsFromHtml(bodyHtml) : [];

  return { specs, colors };
}
