import type { CarouselItem } from "./types";
import type { ColorSwatch } from "../catalog-source/product-details";

export const COLOR_HEX: Record<string, string> = {
  black: "#1a1a1a", white: "#f5f5f5", red: "#cc2222", blue: "#1e4d9c",
  navy: "#1a2d5a", green: "#2d6e3a", yellow: "#f0c040", orange: "#e07020",
  purple: "#6b3fa0", pink: "#e8789a", brown: "#7a4228", grey: "#888888",
  gray: "#888888", beige: "#d4c4a8", taupe: "#8d7966", camel: "#c19a6b",
  tan: "#c4a264", khaki: "#8e8060", ivory: "#fffff0", cream: "#fffdd0",
  silver: "#c0c0c0", gold: "#d4a017", steel: "#6e7b8b", pirite: "#6e7060",
  diva: "#a52828", stone: "#9e9e8e", sand: "#d4b896", teal: "#2e8b8b",
  wine: "#6b1a2c", bordeaux: "#7c1c2c", burgundy: "#800020", latte: "#c4a882",
  coral: "#e07060", rust: "#b74e1a", mustard: "#c8a028", olive: "#6b7028",
  cobalt: "#0050a0", charcoal: "#3c3c3c", graphite: "#555555",
  lunar: "#b8b8c0", oil: "#3d4a1e", aqua: "#00b2b2", petrol: "#1c4f5e",
  midnight: "#191970", vanilla: "#f3e5ab", forest: "#2d5a2d",
};

export const COLOR_HEBREW: Record<string, string> = {
  black: "שחור", white: "לבן", red: "אדום", blue: "כחול", green: "ירוק",
  yellow: "צהוב", orange: "כתום", purple: "סגול", pink: "ורוד", brown: "חום",
  grey: "אפור", gray: "אפור", navy: "נייבי", beige: "בז'", taupe: "טאופ",
  camel: "גמל", tan: "שזוף", khaki: "חאקי", ivory: "שנהב", cream: "קרם",
  silver: "כסף", gold: "זהב", steel: "פלדה", pirite: "פיריט", diva: "דיווה",
  stone: "אבן", sand: "חול", teal: "טיל", wine: "יין", bordeaux: "בורדו",
  burgundy: "בורגונדי", latte: "לאטה", vanilla: "וניל", forest: "יער",
  coral: "אלמוג", rust: "חלודה", mustard: "חרדל", olive: "זית",
  cobalt: "קובלט", charcoal: "פחם", graphite: "גרפיט",
  lunar: "לונר", oil: "אויל", aqua: "אקווה", petrol: "פטרול",
  midnight: "חצות", "dress blue": "כחול",
};

const COLOR_WORDS = new Set(Object.keys(COLOR_HEX));

function normalizeForFamily(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*-?\s*mandarina duck\b/gi, "")
    .replace(/[+\-–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractColorWord(title: string): string | null {
  const t = normalizeForFamily(title);
  if (t.includes("dress blue")) return "dress blue";
  for (const token of t.split(/\s+/)) {
    if (COLOR_WORDS.has(token)) return token;
  }
  return null;
}

export function getFamilyKey(title: string): string {
  const normalized = normalizeForFamily(title);
  const color = extractColorWord(title);
  if (!color) return normalized;
  return normalized.replace(new RegExp(`\\b${color.replace(" ", "\\s+")}\\b`, "gi"), "").replace(/\s+/g, " ").trim();
}

export function buildItemColorGroups(items: CarouselItem[]): Map<string, ColorSwatch[]> {
  const families = new Map<string, Array<{ id: string; colorWord: string | null }>>();
  for (const item of items) {
    const key = getFamilyKey(item.title);
    const colorWord = extractColorWord(item.title);
    if (!families.has(key)) families.set(key, []);
    families.get(key)!.push({ id: item.id, colorWord });
  }

  const result = new Map<string, ColorSwatch[]>();
  for (const [, members] of families) {
    const seen = new Set<string>();
    const swatches: ColorSwatch[] = members
      .filter(m => m.colorWord && !seen.has(m.colorWord) && (seen.add(m.colorWord), true))
      .map(m => ({
        name: COLOR_HEBREW[m.colorWord!] ?? m.colorWord!,
        hex: COLOR_HEX[m.colorWord!] ?? null,
        swatchUrl: null,
      }));
    if (swatches.length < 1) continue;
    for (const { id } of members) {
      result.set(id, swatches);
    }
  }
  return result;
}
