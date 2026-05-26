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
  // 13.4" x 9.8" x 4.7" → 34 x 24.9 x 11.9 ס"מ
  text = text.replace(
    /(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?)/gi,
    (_, a, b, c) =>
      `${inchesToCm(parseFloat(a))} × ${inchesToCm(parseFloat(b))} × ${inchesToCm(parseFloat(c))} ס"מ`,
  );
  // single inch value
  text = text.replace(/(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?)\b/gi, (_, n) => {
    return `${inchesToCm(parseFloat(n))} ס"מ`;
  });
  // lbs
  text = text.replace(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b/gi, (_, n) => {
    return `${lbsToKg(parseFloat(n))} ק"ג`;
  });
  return text;
}

// ─── Label translation ────────────────────────────────────────────────────────

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
  fabric: "בד",
  dimensions: "מידות",
  measurements: "מידות",
  dimension: "מידות",
  sizes: "מידות",
  size: "מידות",
  features: "מאפיינים",
  details: "פרטים",
  closure: "סגירה",
  strap: "רצועה",
  straps: "רצועות",
  "shoulder strap": "רצועת כתף",
  accessories: "אביזרים",
  weight: "משקל",
  pockets: "כיסים",
  "technical data": "נתונים טכניים",
  specifications: "מפרט",
  spec: "מפרט",
  general: "כללי",
};

function translateSection(heading: string): string {
  const key = heading.trim().toLowerCase();
  return SECTION_MAP[key] ?? heading;
}

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
  color: "צבע",
  "product code": "קוד מוצר",
  sku: "מק\"ט",
  style: "סגנון",
  handle: "ידית",
  handles: "ידיות",
  "top handle": "ידית עליונה",
  "hand strap": "רצועת יד",
  zipper: "רוכסן",
  "magnetic closure": "סגירה מגנטית",
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
  // exact match
  if (COLOR_NAME_MAP[key]) return COLOR_NAME_MAP[key];
  // word-level match for compound names like "Steel Blue"
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
  const words = key.split(/\s+/);
  for (const word of words) {
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

// Extract specs from HTML description blocks
// Handles: <strong>HEADING</strong><br>item<br>item pattern,
//          <h2/h3>Heading</h2> followed by <ul> or <p>,
//          <table> rows, <dl> lists
function extractSpecsFromHtml(html: string): SpecSection[] {
  const sections: SpecSection[] = [];

  // Attempt 1: Strong-heading + line breaks pattern
  // <p><strong>EXTERIOR</strong><br>item1<br>item2</p>
  const strongBlockRegex =
    /<(?:p|div)[^>]*>\s*<strong[^>]*>([^<]{2,60})<\/strong>(?:<br\s*\/?>|\n)([\s\S]*?)<\/(?:p|div)>/gi;
  let match: RegExpExecArray | null;
  const strongSections = new Map<string, string[]>();

  while ((match = strongBlockRegex.exec(html)) !== null) {
    const heading = clean(match[1]);
    if (!heading || heading.length > 60) continue;
    const body = match[2];
    const lines = body
      .split(/<br\s*\/?>/i)
      .map((l) => clean(l))
      .filter((l) => l.length > 1 && l.length < 200);
    if (lines.length > 0) {
      const existing = strongSections.get(heading) ?? [];
      strongSections.set(heading, [...existing, ...lines]);
    }
  }

  for (const [heading, lines] of strongSections) {
    const items = lines.map((line) => {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0 && colonIdx < 40) {
        const label = translateItemLabel(line.slice(0, colonIdx).trim());
        const value = convertMeasurements(line.slice(colonIdx + 1).trim());
        return { label, value };
      }
      return { label: convertMeasurements(line), value: "" };
    });
    sections.push({ heading: translateSection(heading), items });
  }

  if (sections.length > 0) return sections;

  // Attempt 2: heading tags followed by lists
  const headingBlockRegex =
    /<h[23][^>]*>([^<]{2,60})<\/h[23]>\s*([\s\S]*?)(?=<h[23]|$)/gi;
  while ((match = headingBlockRegex.exec(html)) !== null) {
    const heading = clean(match[1]);
    if (!heading || heading.length > 60) continue;
    const body = match[2];

    const items: SpecItem[] = [];
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch: RegExpExecArray | null;
    while ((liMatch = liRegex.exec(body)) !== null) {
      const text = convertMeasurements(clean(liMatch[1]));
      if (!text || text.length > 200) continue;
      const colonIdx = text.indexOf(":");
      if (colonIdx > 0 && colonIdx < 40) {
        items.push({ label: translateItemLabel(text.slice(0, colonIdx).trim()), value: text.slice(colonIdx + 1).trim() });
      } else {
        items.push({ label: text, value: "" });
      }
    }

    if (items.length > 0) {
      sections.push({ heading: translateSection(heading), items });
    }
  }

  if (sections.length > 0) return sections;

  // Attempt 3: definition list <dl><dt>label</dt><dd>value</dd></dl>
  const dlRegex = /<dl[^>]*>([\s\S]*?)<\/dl>/gi;
  while ((match = dlRegex.exec(html)) !== null) {
    const dlContent = match[1];
    const items: SpecItem[] = [];
    const dtRegex = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
    let dtMatch: RegExpExecArray | null;
    while ((dtMatch = dtRegex.exec(dlContent)) !== null) {
      const label = translateItemLabel(clean(dtMatch[1]));
      const value = convertMeasurements(clean(dtMatch[2]));
      if (label && (label.length + value.length) < 200) {
        items.push({ label, value });
      }
    }
    if (items.length > 0) {
      sections.push({ heading: "מפרט", items });
    }
  }

  return sections;
}

// ─── Color extraction ─────────────────────────────────────────────────────────

// Extract color variants from Shopify product JSON embedded in page scripts
function extractColorsFromShopifyJson(html: string): ColorSwatch[] {
  const swatches: ColorSwatch[] = [];

  // Look for Shopify product JSON with variants
  // Pattern: "options":["Color","..."] and "values":["Black","Navy",...]
  const optionNamesRegex = /"option_names"\s*:\s*\[([^\]]+)\]/gi;
  const optionValuesRegex = /"option1"\s*:\s*"([^"]+)"/gi;

  // Find which option index is "Color"
  let colorOptionIndex = 0;
  const optionMatch = /"options"\s*:\s*\[([^\]]{0,500})\]/i.exec(html);
  if (optionMatch) {
    const opts = optionMatch[1].toLowerCase();
    const colorIdx = opts.indexOf('"color"');
    const colourIdx = opts.indexOf('"colour"');
    if (colorIdx >= 0 || colourIdx >= 0) {
      // Count how many options come before color
      const before = opts.slice(0, Math.max(colorIdx, colourIdx));
      colorOptionIndex = (before.match(/"/g) ?? []).length / 2;
    }
  }

  // Extract color values from variants
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

  // Also try swatch images from HTML (Shopify color swatch pattern)
  if (swatches.length === 0) {
    const swatchImgRegex =
      /data-(?:option-value|color-value)="([^"]+)"[^>]*>|<(?:input|button)[^>]*value="([^"]+)"[^>]*(?:data-swatch|swatch)[^>]*>/gi;
    while ((match = swatchImgRegex.exec(html)) !== null) {
      const name = (match[1] ?? match[2] ?? "").trim();
      if (!name || seenColors.has(name.toLowerCase())) continue;
      seenColors.add(name.toLowerCase());
      swatches.push({ name: translateColorName(name), hex: colorToHex(name), swatchUrl: null });
    }
  }

  return swatches;
}

let match: RegExpExecArray | null;

// ─── Main fetcher ─────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(14000),
  });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  return res.text();
}

// Extract product description section from full page HTML
function extractDescriptionHtml(pageHtml: string): string {
  // Try og:description JSON-LD description
  const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  while ((match = jsonLdRegex.exec(pageHtml)) !== null) {
    try {
      const data = JSON.parse(match[1]) as Record<string, unknown>;
      if (data["@type"] === "Product" && typeof data.description === "string" && data.description.length > 30) {
        return data.description;
      }
    } catch {
      // continue
    }
  }

  // Try product description div/section
  const descPatterns = [
    /<div[^>]*(?:class|id)="[^"]*(?:product[_-]?description|product[_-]?details|product[_-]?specs?|tab[_-]?content)[^"]*"[^>]*>([\s\S]{20,5000}?)<\/div>/i,
    /<section[^>]*(?:class|id)="[^"]*product[_-]?description[^"]*"[^>]*>([\s\S]{20,5000}?)<\/section>/i,
    /<div[^>]*itemprop="description"[^>]*>([\s\S]{20,5000}?)<\/div>/i,
  ];

  for (const pattern of descPatterns) {
    const m = pattern.exec(pageHtml);
    if (m?.[1] && m[1].length > 30) return m[1];
  }

  return pageHtml;
}

export async function fetchProductDetails(sourceUrl: string): Promise<ProductDetails> {
  if (!sourceUrl?.startsWith("http")) {
    return { specs: [], colors: [] };
  }

  const html = await fetchHtml(sourceUrl);
  const descHtml = extractDescriptionHtml(html);

  const specs = extractSpecsFromHtml(descHtml);
  const colors = extractColorsFromShopifyJson(html);

  return { specs, colors };
}
