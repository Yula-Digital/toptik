// Supplier price & stock list — source: the "בריקס קטלוג" sheet supplied by the
// owner on 2026-08-16. Prices are per unit INCLUDING VAT (ILS); quantity is the
// stock bought from the supplier. Keys are normalized catalog keys (letters and
// digits only, uppercase, Mandarina "-TU" suffix dropped) — the same form
// `catalogKey` in shopify-export produces, so "BAH08453.001" and
// "P10SZV24-05J-TU" both match the supplier's dot-less notation.
export interface SupplierPriceEntry {
  price: number;
  quantity: number;
}

export const SUPPLIER_PRICE_LIST: Record<string, SupplierPriceEntry> = {
  BAH08451001: { price: 1690, quantity: 2 },
  BAH08453001: { price: 1790, quantity: 3 },
  BAH08453006: { price: 1790, quantity: 3 },
  BAH08453078: { price: 1790, quantity: 4 },
  BAH08454001: { price: 1890, quantity: 1 },
  BXL58117101: { price: 1300, quantity: 1 },
  BXL38124101: { price: 1450, quantity: 1 },
  BXL38124078: { price: 1450, quantity: 6 },
  BXL58145101: { price: 1550, quantity: 2 },
  BXL58145050: { price: 1550, quantity: 3 },
  BXL58145078: { price: 1550, quantity: 4 },
  P10SZV2405J: { price: 1058, quantity: 15 },
  P10SZV24A83: { price: 1134, quantity: 1 },
  P10SZV24A81: { price: 1134, quantity: 3 },
  P10UJV24A92: { price: 1235, quantity: 5 },
  P10OUV24A89: { price: 1166, quantity: 3 },
  P10OUN01A89: { price: 605, quantity: 5 },
  P10UJN01A92: { price: 630, quantity: 1 },
  P10JNV05465: { price: 850, quantity: 4 },
  P10JNV0508Q: { price: 850, quantity: 8 },
  P10GXV24A32: { price: 1330, quantity: 4 },
  ORI05500909: { price: 2960, quantity: 1 },
  ORI05500024: { price: 2960, quantity: 1 },
};
