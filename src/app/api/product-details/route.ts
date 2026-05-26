import { NextRequest, NextResponse } from "next/server";
import { fetchProductDetails } from "@/lib/catalog-source/product-details";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url || !url.startsWith("http")) {
    return NextResponse.json({ specs: [], colors: [] });
  }

  try {
    const details = await fetchProductDetails(url);
    return NextResponse.json(details, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (err) {
    console.error("[product-details] fetch error", err);
    return NextResponse.json({ specs: [], colors: [], error: "fetch_failed" }, { status: 200 });
  }
}
