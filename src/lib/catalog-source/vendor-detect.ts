import type { CatalogVendor } from "@/lib/catalog-source/provider";

// Client-safe, pure helpers — imported by the admin UI as well as server code.

// Canonical comparison key for catalog numbers: letters+digits only, uppercase.
// "P10SZV24-05J-TU", "P10SZV2405J" and "p10 szv24 05j" all collapse to the
// same key prefix, so duplicate checks survive any separator style.
export function normalizeCatalogKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Identify the vendor from the catalog number itself, so imports route
// correctly no matter which admin section (or Excel file) they came from.
// Mandarina Duck catalogs always start with P + 2 digits (P10QMC01-465-TU);
// Bric's SKUs start with letter groups like BXL/BAH/BBG/BOE/ORI.
export function detectVendorFromCatalog(catalogNumber: string): CatalogVendor {
  const token = normalizeCatalogKey(catalogNumber);
  return /^P\d{2}/.test(token) ? "mandarina" : "brics";
}
