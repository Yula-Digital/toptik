import { NextRequest, NextResponse } from "next/server";

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" });

  const result: Record<string, unknown> = { url };

  // 1. Try direct page fetch
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(14000) });
    result.pageStatus = res.status;
    if (res.ok) {
      const html = await res.text();
      result.pageLength = html.length;

      // Look for spec section markers
      const exteriorMatch = html.match(/[\s\S]{0,80}(?:exterior|EXTERIOR|Exterior)[\s\S]{0,500}/);
      result.exteriorSnippet = exteriorMatch?.[0] ?? null;

      // Look for inline product JSON
      result.hasBodyHtml = html.includes('"body_html"');
      result.hasWindowProduct = html.includes("window.product");
      result.hasProductJson = html.includes('type="application/json"');

      // Find body_html content if present
      const bodyHtmlMatch = html.match(/"body_html"\s*:\s*"((?:[^"\\]|\\.){0,8000})"/);
      result.bodyHtmlSnippet = bodyHtmlMatch?.[1]?.slice(0, 3000) ?? null;

      // Find options array if present
      const optionsMatch = html.match(/"options"\s*:\s*(\[[\s\S]{0,2000}?\])/);
      result.optionsSnippet = optionsMatch?.[1] ?? null;

      // Find JSON-LD Product description
      const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
      let m: RegExpExecArray | null;
      const jsonLdDescriptions: string[] = [];
      while ((m = jsonLdRegex.exec(html)) !== null) {
        try {
          const data = JSON.parse(m[1]);
          if (data["@type"] === "Product" && typeof data.description === "string") {
            jsonLdDescriptions.push(data.description.slice(0, 2000));
          }
        } catch {
          /* skip */
        }
      }
      result.jsonLdDescriptions = jsonLdDescriptions;

      // All variant option1 values
      const option1Regex = /"option1"\s*:\s*"([^"]+)"/gi;
      const option1Values = new Set<string>();
      while ((m = option1Regex.exec(html)) !== null) option1Values.add(m[1]);
      result.allOption1Values = [...option1Values];
    }
  } catch (err) {
    result.pageError = (err as Error).message;
  }

  // 2. Try Shopify .json endpoint
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const idx = parts.lastIndexOf("products");
    if (idx !== -1 && parts[idx + 1]) {
      const handle = parts[idx + 1].split("?")[0];
      const jsonUrl = `${parsed.origin}/products/${handle}.json`;
      result.shopifyJsonUrl = jsonUrl;
      const r = await fetch(jsonUrl, {
        headers: { ...HEADERS, accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      result.shopifyJsonStatus = r.status;
      if (r.ok) {
        const data = await r.json();
        result.shopifyHasBodyHtml = !!data?.product?.body_html;
        result.shopifyOptionsCount = data?.product?.options?.length ?? 0;
      }
    }
  } catch (err) {
    result.shopifyError = (err as Error).message;
  }

  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
