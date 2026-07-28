import { NextResponse } from "next/server";
import { getCarouselPayload } from "@/lib/carousel/repository";

export async function GET() {
  try {
    const payload = await getCarouselPayload();
    return NextResponse.json(payload, {
      headers: {
        // Catalog rarely changes; serve from edge for an hour, allow SWR for a day.
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400, max-age=60",
      },
    });
  } catch (error) {
    console.error("GET /api/carousel failed", error);
    return NextResponse.json({ error: "Failed to load carousel" }, { status: 500 });
  }
}
