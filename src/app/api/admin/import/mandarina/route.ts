import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCatalogSourceProvider } from "@/lib/catalog-source/provider";
import { fetchProductDetails } from "@/lib/catalog-source/product-details";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { CachedTechSpecs, CarouselItem } from "@/lib/carousel/types";

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

function extensionFromContentType(contentType: string | null) {
  if (!contentType) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return "jpg";
}

function extensionFromUrl(url: string) {
  const cleanPath = url.split("?")[0];
  const parts = cleanPath.split(".");
  const ext = parts[parts.length - 1]?.toLowerCase();
  if (!ext) return null;
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return ext === "jpeg" ? "jpg" : ext;
  return null;
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

async function uploadRemoteImageToStorage(
  catalogNumber: string,
  imageUrl: string,
  index: number,
) {
  const sourceRes = await fetch(imageUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      referer: "https://mandarinaduck.com/",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!sourceRes.ok) {
    throw new Error(`Failed to download source image (${sourceRes.status})`);
  }
  const contentType = sourceRes.headers.get("content-type");
  if (!contentType?.startsWith("image/")) {
    throw new Error("Source image has unsupported content type");
  }

  const bytes = await sourceRes.arrayBuffer();
  const ext = extensionFromUrl(imageUrl) ?? extensionFromContentType(contentType);
  const filePath = `imports/mandarina/${catalogNumber}/${String(index + 1).padStart(
    2,
    "0",
  )}-${crypto.randomUUID()}.${ext}`;

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.storage
    .from("carousel-media")
    .upload(filePath, bytes, { contentType, upsert: false });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from("carousel-media").getPublicUrl(filePath);
  return data.publicUrl;
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
        const publicUrl = await uploadRemoteImageToStorage(normalizedCatalogNumber, imageUrl, index);
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
      angles: uploadedUrls.map((imagePath, index) => ({
        id: crypto.randomUUID(),
        itemId,
        angleKey: angleKeyByIndex(index),
        imagePath,
        angleOrder: index + 1,
      })),
    };

    // Persist the pre-fetched tech specs to the DB row created/updated by
    // the admin save flow. Best-effort: missing column or older row schema
    // shouldn't break the import.
    if (techSpecs && targetItemId) {
      try {
        const supabase = createSupabaseServiceRoleClient();
        await supabase
          .from("carousel_items")
          .update({ tech_specs: techSpecs })
          .eq("id", targetItemId);
      } catch (persistError) {
        console.warn("Tech specs persist failed", persistError);
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
