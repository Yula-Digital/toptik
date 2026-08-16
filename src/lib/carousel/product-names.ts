// Hebrew storefront titles per SKU, keyed by the normalized catalog key
// (letters+digits, uppercase, "-TU" dropped — what shopify-export's catalogKey
// produces). Composed for the Shopify store on 2026-08-16: model + size + colour
// name from the colour-code tables in colors.ts.
export const HEBREW_TITLES: Record<string, string> = {
  BAH08451001: 'טרולי עלייה למטוס Bric\'s Taormina 55 ס"מ מתרחב – שחור',
  BAH08453001: 'מזוודה Bric\'s Taormina 69 ס"מ מתרחבת – שחור',
  BAH08453006: 'מזוודה Bric\'s Taormina 69 ס"מ מתרחבת – כחול',
  BAH08453078: 'מזוודה Bric\'s Taormina 69 ס"מ מתרחבת – זית',
  BAH08454001: 'מזוודה גדולה Bric\'s Taormina 82 ס"מ מתרחבת – שחור',
  BXL38124078: "תיק פיילוט Bric's X-Collection – זית",
  BXL38124101: "תיק פיילוט Bric's X-Collection – שחור",
  BXL58117101: 'טרולי עלייה למטוס Bric\'s X-Collection 55 ס"מ – שחור',
  BXL58145050: 'מזוודה Bric\'s X-Collection 70 ס"מ – נייבי',
  BXL58145078: 'מזוודה Bric\'s X-Collection 70 ס"מ – זית',
  BXL58145101: 'מזוודה Bric\'s X-Collection 70 ס"מ – שחור',
  ORI05500024: 'טרולי Porsche Design Roadster 55 ס"מ – צהוב רייסינג',
  ORI05500909: 'טרולי Porsche Design Roadster 55 ס"מ – שחור מבריק',
  P10GXV24A32: "טרולי עלייה למטוס מנדרינה דאק Logoduck+ Glitter – טורקיז נצנצים",
  P10JNV0508Q: "תיק-טרולי מנדרינה דאק Smile & Go – כחול",
  P10JNV05465: "תיק-טרולי מנדרינה דאק Smile & Go – פלדה",
  P10OUN01A89: "ביוטי קייס מנדרינה דאק Logoduck+ Metal – לונר",
  P10OUV24A89: "טרולי עלייה למטוס מנדרינה דאק Logoduck+ Metal מתרחב – לונר",
  P10SZV2405J: "טרולי עלייה למטוס מנדרינה דאק Logoduck+ מתרחב – צהוב",
  P10SZV24A81: "טרולי עלייה למטוס מנדרינה דאק Logoduck+ מתרחב – מוקה לבן",
  P10SZV24A83: "טרולי עלייה למטוס מנדרינה דאק Logoduck+ מתרחב – שוקולד",
  P10UJN01A92: "ביוטי קייס מנדרינה דאק Logoduck+ Moire – מוארה",
  P10UJV24A92: "טרולי עלייה למטוס מנדרינה דאק Logoduck+ Moire מתרחב – מוארה",
};
