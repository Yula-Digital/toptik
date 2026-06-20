import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

// Shared image-ingest helper: download a remote (Mandarina CDN) image and
// re-upload it to the Supabase `carousel-media` bucket, returning the public
// URL. Used by both the catalog import route and the colour warmer so product
// images are never hot-linked from the source.

const DOWNLOAD_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  referer: "https://mandarinaduck.com/",
};

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

// `pathPrefix` is the storage folder (e.g. `imports/mandarina/<catalog>`); the
// file name is `<NN>-<uuid>.<ext>`.
export async function uploadRemoteImageToStorage(
  pathPrefix: string,
  imageUrl: string,
  index: number,
): Promise<string> {
  const sourceRes = await fetch(imageUrl, {
    headers: DOWNLOAD_HEADERS,
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
  const filePath = `${pathPrefix.replace(/\/$/, "")}/${String(index + 1).padStart(2, "0")}-${crypto.randomUUID()}.${ext}`;

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
