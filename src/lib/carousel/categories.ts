import type { CarouselItem } from "./types";

// Exactly two catalog categories, chosen per-product in the admin.
export type CategoryKey = "suitcase" | "carryon";

export interface CategoryDefinition {
  key: CategoryKey;
  label: string;
}

export const CATEGORIES: readonly CategoryDefinition[] = [
  { key: "suitcase", label: "מזוודה" },
  { key: "carryon", label: "טרולי / Carry-on" },
] as const;

export const DEFAULT_CATEGORY: CategoryKey = "suitcase";

const CATEGORY_KEYS = new Set<string>(CATEGORIES.map((c) => c.key));

export function isCategoryKey(value: string | null | undefined): value is CategoryKey {
  return Boolean(value && CATEGORY_KEYS.has(value));
}

export function parseCategoryParam(raw: string | null | undefined): CategoryKey {
  return isCategoryKey(raw) ? raw : DEFAULT_CATEGORY;
}

// The category chosen in the admin (stored in techSpecs.category) wins. For
// legacy products with no explicit choice, guess from the English title so they
// still land in one of the two buckets — a clear cabin/carry-on marker maps to
// "carryon", everything else defaults to "suitcase". The admin checkbox lets an
// editor correct any guess.
export function categorizeItem(item: CarouselItem): CategoryKey {
  const explicit = item.techSpecs?.category;
  if (isCategoryKey(explicit)) return explicit;
  const t = item.title.toLowerCase();
  if (/\b(cabin|carry[-\s]?on|hand\s*luggage|underseat|trolley\s*case)\b/.test(t)) return "carryon";
  return "suitcase";
}

export function filterByCategory(items: CarouselItem[], category: CategoryKey): CarouselItem[] {
  return items.filter((item) => categorizeItem(item) === category);
}
