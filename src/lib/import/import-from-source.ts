import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CatalogVendor, createCatalogSourceProvider } from "@/lib/catalog-source/provider";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { CarouselItem } from "@/lib/carousel/types";

const importCatalogSchema = z.object({
  catalogNumber: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[A-Za-z0-9._/\-]+$/, "Catalog number contains invalid characters"),
  targetItemId: z.string().uuid().optional(),
});

type VendorConfig = {
  label: string;
  referer: string;
  storageFolder: string;
};

const VENDOR_CONFIG: Record<CatalogVendor, VendorConfig> = {
  mandarina: {
    label: "Mandarina Duck",
    referer: "https://mandarinaduck.com/",
    storageFolder: "mandarina",
  },
  brics: {
    label: "Bric's",
    referer: "https://bricstore.com/",
    storageFolder: "brics",
  },
};

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

const HEBREW_CHAR_REGEX = /[֐-׿]/;
const LATIN_WORD_REGEX = /[A-Za-z]{3,}/;
const TRANSLATION_CHUNK_MAX_LENGTH = 1000;
const TRANSLATION_ATTEMPTS_PER_CHUNK = 3;

function splitIntoTranslationChunks(text: string) {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > TRANSLATION_CHUNK_MAX_LENGTH) {
      chunks.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function requestTranslation(input: string): Promise<string | null> {
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
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;

  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  const segments = data[0] as unknown[];
  const translated = segments
    .map((segment) => (Array.isArray(segment) ? String(segment[0] ?? "") : ""))
    .join("")
    .trim();
  return translated || null;
}

// The public translate endpoint is flaky on long inputs (returns partially
// translated text mid-sentence). Translate sentence-sized chunks and verify
// each result actually came back in Hebrew before accepting it.
async function translateToHebrew(input: string | null) {
  if (!input?.trim()) return input;

  const chunks = splitIntoTranslationChunks(input);
  const translatedChunks: string[] = [];

  for (const chunk of chunks) {
    const needsTranslation = LATIN_WORD_REGEX.test(chunk);
    if (!needsTranslation) {
      translatedChunks.push(chunk);
      continue;
    }

    let accepted: string | null = null;
    for (let attempt = 0; attempt < TRANSLATION_ATTEMPTS_PER_CHUNK; attempt += 1) {
      try {
        const candidate = await requestTranslation(chunk);
        if (candidate && HEBREW_CHAR_REGEX.test(candidate)) {
          accepted = candidate;
          break;
        }
      } catch {
        // retry below
      }
    }
    translatedChunks.push(accepted ?? chunk);
  }

  const result = translatedChunks.join(" ").replace(/\s+/g, " ").trim();
  return result || input;
}

async function uploadRemoteImageToStorage(
  vendorConfig: VendorConfig,
  catalogNumber: string,
  imageUrl: string,
  index: number,
) {
  const sourceRes = await fetch(imageUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      referer: vendorConfig.referer,
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
  const filePath = `imports/${vendorConfig.storageFolder}/${catalogNumber}/${String(
    index + 1,
  ).padStart(2, "0")}-${crypto.randomUUID()}.${ext}`;

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

export function createImportRouteHandler(vendor: CatalogVendor) {
  const vendorConfig = VENDOR_CONFIG[vendor];

  return async function POST(req: NextRequest) {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const body = await req.json();
      const { catalogNumber, targetItemId } = importCatalogSchema.parse(body);

      const provider = createCatalogSourceProvider(vendor);
      const sourceProduct = await provider.fetchByCatalogNumber(catalogNumber);
      const normalizedCatalogNumber = sourceProduct.catalogNumber || catalogNumber;

      // Total angles are capped at 20 (validation limit); reserve room for one
      // representative image per additional color so the UI can preview them.
      const colorImages = (sourceProduct.colorImages ?? []).slice(0, 6);
      const maxMainImages = Math.max(1, 20 - colorImages.length);
      const uploadPlan: Array<{ imageUrl: string; angleKey: string }> = [
        ...sourceProduct.imageUrls
          .slice(0, maxMainImages)
          .map((imageUrl, index) => ({ imageUrl, angleKey: angleKeyByIndex(index) })),
        ...colorImages.map((entry) => ({
          imageUrl: entry.imageUrl,
          angleKey: `c:${entry.color}`.slice(0, 32),
        })),
      ];

      const uploadedAngles: Array<{ imagePath: string; angleKey: string }> = [];
      for (const [index, planEntry] of uploadPlan.entries()) {
        try {
          const publicUrl = await uploadRemoteImageToStorage(
            vendorConfig,
            normalizedCatalogNumber,
            planEntry.imageUrl,
            index,
          );
          uploadedAngles.push({ imagePath: publicUrl, angleKey: planEntry.angleKey });
        } catch (error) {
          console.warn("Image import skipped", planEntry.imageUrl, error);
        }
      }

      if (uploadedAngles.length === 0 || !uploadedAngles.some((a) => !a.angleKey.startsWith("c:"))) {
        throw new Error("Import failed: no images were saved to storage");
      }

      const translatedDescription = await translateToHebrew(sourceProduct.description);

      const itemId = targetItemId ?? crypto.randomUUID();
      const importedItem: CarouselItem = {
        id: itemId,
        title: sourceProduct.title || `${vendorConfig.label} ${catalogNumber}`,
        description: (
          translatedDescription ||
          sourceProduct.description ||
          `ייבוא אוטומטי לפי מק״ט ${catalogNumber} ממקור ${vendorConfig.label}`
        ).slice(0, 2000),
        catalogNumber: normalizedCatalogNumber,
        sourceUrl: sourceProduct.sourceUrl,
        coverImagePath: uploadedAngles[0].imagePath,
        displayOrder: 1,
        isActive: true,
        color: sourceProduct.color || null,
        dimensions: sourceProduct.dimensions || null,
        weight: sourceProduct.weight || null,
        sizes: sourceProduct.sizes?.length ? sourceProduct.sizes : null,
        availableColors: sourceProduct.availableColors?.length
          ? sourceProduct.availableColors
          : null,
        angles: uploadedAngles.map((angle, index) => ({
          id: crypto.randomUUID(),
          itemId,
          angleKey: angle.angleKey,
          imagePath: angle.imagePath,
          angleOrder: index + 1,
        })),
      };

      return NextResponse.json({
        ok: true,
        item: importedItem,
        source: {
          vendor,
          catalogNumber: normalizedCatalogNumber,
          sourceUrl: sourceProduct.sourceUrl,
          importedImages: uploadedAngles.length,
        },
      });
    } catch (error) {
      console.error(`POST /api/admin/import/${vendor} failed`, error);
      const message = error instanceof Error ? error.message : "Import failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  };
}
