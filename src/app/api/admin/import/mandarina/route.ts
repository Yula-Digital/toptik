import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCatalogSourceProvider } from "@/lib/catalog-source/provider";
import { fetchProductDetails } from "@/lib/catalog-source/product-details";
import { enumerateColorVariants } from "@/lib/catalog-source/mandarina-scraper";
import { uploadRemoteImageToStorage } from "@/lib/catalog-source/storage";
import { toCarouselColors } from "@/lib/carousel/colors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { CachedTechSpecs, CarouselColor, CarouselItem } from "@/lib/carousel/types";

// Import now also enumerates every colour of the model (extra page fetches +
// image uploads), so give the function room beyond the default timeout.
export const runtime = "nodejs";
export const maxDuration = 120;

const importCatalogSchema = z.object({
  catalogNumber: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[A-Za-z0-9._/\-]+$/, "Catalog number contains invalid characters"),
  targetItemId: z.string().uuid().optional(),
});

function isAuthorized(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  return Boolean(token && supabaseEnv.adminToken && token === supabaseEnv.adminToken);
}

function angleKeyByIndex(index: number) {
  const defaults = ["front", "right", "back", "left", "top"];
  return defaults[index] ?? `view-${index + 1}`;
}

async function translateToHebrew(input: string | null) {
  if (!input?.trim()) return input;

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=he&dt=t&q=${encodeURIComponent(
      input,
    )}`;
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return input;
    const data = (await res.json()) as unknown;

    if (!Array.isArray(data) || !Array.isArray(data[0])) return input;
    const segments = data[0] as unknown[];
    const translated = segments
      .map((segment) => (Array.isArray(segment) ? String(segment[0] ?? "") : ""))
      .join("")
      .trim();
    return translated || input;
  } catch {
    return input;
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { catalogNumber, targetItemId } = importCatalogSchema.parse(body);

    const provider = createCatalogSourceProvider();
    const sourceProduct = await provider.fetchByCatalogNumber(catalogNumber);
    const normalizedCatalogNumber = sourceProduct.catalogNumber || catalogNumber;

    const uploadedUrls: string[] = [];
    for (const [index, imageUrl] of sourceProduct.imageUrls.entries()) {
      try {
        const publicUrl = await uploadRemoteImageToStorage(
          `imports/mandarina/${normalizedCatalogNumber}`,
          imageUrl,
          index,
        );
        uploadedUrls.push(publicUrl);
      } catch (error) {
        console.warn("Image import skipped", imageUrl, error);
      }
    }

    if (uploadedUrls.length === 0) {
      throw new Error("Import failed: no images were saved to storage");
    }

    // Fetch + cache tech specs at import time so the product is "born warm"
    // — no visitor ever pays the cold-scrape cost. Failure here is non-fatal:
    // the carousel still imports, the tech-specs background warmer will
    // eventually populate the row on first carousel visit.
    let techSpecs: CachedTechSpecs | null = null;
    if (sourceProduct.sourceUrl) {
      try {
        techSpecs = (await fetchProductDetails(sourceProduct.sourceUrl)) as CachedTechSpecs;
      } catch (specError) {
        console.warn("Tech specs prefetch failed", specError);
      }
    }

    // Enumerate every colour of this model (each colour is a separate MD
    // product) and re-host a cover image per colour, so a swatch click can swap
    // the displayed product image. Non-fatal: a failure just leaves the item
    // without scraped colours (the colour warmer can fill it in later).
    let colors: CarouselColor[] | null = null;
    if (sourceProduct.sourceUrl) {
      try {
        const variants = await enumerateColorVariants(sourceProduct);
        if (variants.length > 0) {
          const coverByHandle = new Map<string, string>();
          await Promise.all(
            variants.map(async (variant, index) => {
              try {
                const publicUrl = await uploadRemoteImageToStorage(
                  `imports/mandarina/${normalizedCatalogNumber}/colors`,
                  variant.coverImageUrl,
                  index,
                );
                coverByHandle.set(variant.handle, publicUrl);
              } catch (coverError) {
                console.warn("Colour cover import skipped", variant.handle, coverError);
              }
            }),
          );
          const mapped = toCarouselColors(variants, coverByHandle);
          if (mapped.length > 0) colors = mapped;
        }
      } catch (colorError) {
        console.warn("Colour enumeration failed", colorError);
      }
    }

    const translatedDescription = await translateToHebrew(sourceProduct.description);

    const itemId = targetItemId ?? crypto.randomUUID();
    const importedItem: CarouselItem = {
      id: itemId,
      title: sourceProduct.title || `Mandarina ${catalogNumber}`,
      description:
        translatedDescription ||
        sourceProduct.description ||
        `ייבוא אוטומטי לפי מק״ט ${catalogNumber} ממקור Mandarina Duck`,
      catalogNumber: normalizedCatalogNumber,
      sourceUrl: sourceProduct.sourceUrl,
      coverImagePath: uploadedUrls[0],
      displayOrder: 1,
      isActive: true,
      techSpecs,
      colors,
      angles: uploadedUrls.map((imagePath, index) => ({
        id: crypto.randomUUID(),
        itemId,
        angleKey: angleKeyByIndex(index),
        imagePath,
        angleOrder: index + 1,
      })),
    };

    // Persist pre-fetched side-data (tech specs + colours) to the existing DB
    // row. Best-effort: a missing column or older row schema must not break the
    // import. (New items get this filled by the warmers after the row exists.)
    if (targetItemId && (techSpecs || colors)) {
      try {
        const supabase = createSupabaseServiceRoleClient();
        const update: Record<string, unknown> = {};
        if (techSpecs) update.tech_specs = techSpecs;
        if (colors) update.colors = colors;
        await supabase.from("carousel_items").update(update).eq("id", targetItemId);
      } catch (persistError) {
        console.warn("Side-data persist failed", persistError);
      }
    }

    return NextResponse.json({
      ok: true,
      item: importedItem,
      source: {
        catalogNumber: normalizedCatalogNumber,
        sourceUrl: sourceProduct.sourceUrl,
        importedImages: uploadedUrls.length,
      },
    });
  } catch (error) {
    console.error("POST /api/admin/import/mandarina failed", error);
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
