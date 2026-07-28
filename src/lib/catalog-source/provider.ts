import { CatalogSourceProvider } from "@/lib/catalog-source/types";
import { MandarinaDuckScraperProvider } from "@/lib/catalog-source/mandarina-scraper";
import { BricsStoreScraperProvider } from "@/lib/catalog-source/brics-scraper";

export type CatalogVendor = "mandarina" | "brics";

export const CATALOG_VENDORS: CatalogVendor[] = ["mandarina", "brics"];

export function isCatalogVendor(value: string): value is CatalogVendor {
  return (CATALOG_VENDORS as string[]).includes(value);
}

export function createCatalogSourceProvider(
  vendor: CatalogVendor = "mandarina",
): CatalogSourceProvider {
  switch (vendor) {
    case "brics":
      return new BricsStoreScraperProvider();
    case "mandarina":
    default:
      return new MandarinaDuckScraperProvider();
  }
}
