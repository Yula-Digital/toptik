import { normalizeCatalogKey } from "@/lib/catalog-source/vendor-detect";

// Per-SKU Shopify checkout URLs — the owner's "Products_urls" sheet
// (2026-08-17). Keys are normalized catalog keys (letters+digits, uppercase,
// Mandarina "-TU" suffix dropped), so "BAH08451.001" and "P10SZV24-05J-TU"
// resolve regardless of dot/dash notation.
const PURCHASE_URLS: Record<string, string> = {
  P10SZV2405J: "https://www.toptik.co.il/checkout?quantity=1&id=42465754808570",
  P10JNV0508Q: "https://www.toptik.co.il/checkout?quantity=1&id=42466128494842",
  P10JNV05465: "https://www.toptik.co.il/checkout?quantity=1&id=42624928415994",
  BAH08451001: "https://www.toptik.co.il/checkout?quantity=1&id=50083958882554",
  BAH08453001: "https://www.toptik.co.il/checkout?quantity=1&id=50083958980858",
  BAH08453006: "https://www.toptik.co.il/checkout?quantity=1&id=50083959046394",
  BAH08453078: "https://www.toptik.co.il/checkout?quantity=1&id=50083959111930",
  BAH08454001: "https://www.toptik.co.il/checkout?quantity=1&id=50083959177466",
  BXL38124078: "https://www.toptik.co.il/checkout?quantity=1&id=50083959243002",
  BXL38124101: "https://www.toptik.co.il/checkout?quantity=1&id=50083959341306",
  BXL58117101: "https://www.toptik.co.il/checkout?quantity=1&id=50083959406842",
  BXL58145050: "https://www.toptik.co.il/checkout?quantity=1&id=50083959505146",
  BXL58145078: "https://www.toptik.co.il/checkout?quantity=1&id=50083959603450",
  BXL58145101: "https://www.toptik.co.il/checkout?quantity=1&id=50083959668986",
  ORI05500024: "https://www.toptik.co.il/checkout?quantity=1&id=50083959767290",
  ORI05500909: "https://www.toptik.co.il/checkout?quantity=1&id=50083959832826",
  P10GXV24A32: "https://www.toptik.co.il/checkout?quantity=1&id=50083959898362",
  P10OUN01A89: "https://www.toptik.co.il/checkout?quantity=1&id=50083959963898",
  P10OUV24A89: "https://www.toptik.co.il/checkout?quantity=1&id=50083959996666",
  P10SZV24A81: "https://www.toptik.co.il/checkout?quantity=1&id=50083960291578",
  P10SZV24A83: "https://www.toptik.co.il/checkout?quantity=1&id=50083960389882",
  P10UJN01A92: "https://www.toptik.co.il/checkout?quantity=1&id=50083960717562",
  P10UJV24A92: "https://www.toptik.co.il/checkout?quantity=1&id=50083960783098",
};

// Checkout URL for an item's catalog number, or null when the product has no
// store listing (callers keep the button inert in that case).
export function purchaseUrlFor(catalogNumber: string | null | undefined): string | null {
  if (!catalogNumber) return null;
  const key = normalizeCatalogKey(catalogNumber).replace(/TU$/, "");
  return PURCHASE_URLS[key] ?? null;
}
