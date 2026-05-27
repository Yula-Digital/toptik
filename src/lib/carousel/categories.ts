import type { CarouselItem } from "./types";

export type CategoryKey = "all" | "bags" | "travel" | "wheeled";

export interface CategoryDefinition {
  key: CategoryKey;
  label: string;
}

export const CATEGORIES: readonly CategoryDefinition[] = [
  { key: "all", label: "כל המוצרים" },
  { key: "bags", label: "תיקים שונים" },
  { key: "travel", label: "תיקי נסיעה" },
  { key: "wheeled", label: "מזוודה / טרולי על גלגלים" },
] as const;

const CATEGORY_KEYS = new Set<string>(CATEGORIES.map((c) => c.key));

export function parseCategoryParam(raw: string | null | undefined): CategoryKey {
  if (raw && CATEGORY_KEYS.has(raw)) return raw as CategoryKey;
  return "all";
}

// Classify an item into exactly one non-"all" category by inspecting the
// English title — robust to new imports since Mandarina's title structure
// is stable (it always names the product type).
//
// Order matters: wheeled wins over travel (a "Trolley Backpack" is wheeled),
// travel wins over bags (a "Travel Crossbody" is travel).
export function categorizeItem(item: CarouselItem): Exclude<CategoryKey, "all"> {
  const t = item.title.toLowerCase();
  if (/\b(trolley|cabin|rolling|spinner|suitcase|luggage)\b/.test(t)) return "wheeled";
  if (/\b(backpack|beauty\s*case|necessaire|toiletry|duffel|carry[-\s]?on|travel)\b/.test(t)) return "travel";
  return "bags";
}

export function filterByCategory(items: CarouselItem[], category: CategoryKey): CarouselItem[] {
  if (category === "all") return items;
  return items.filter((item) => categorizeItem(item) === category);
}
