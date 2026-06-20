import sharp from "sharp";

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

// The dominant colour of a product image's CENTRE region (the product body),
// returned as #rrggbb — used to colour the swatch dot so it matches the product.
// The centre crop avoids the white margins and edge straps/logo, and `dominant`
// (histogram mode) shrugs off a central strap better than a flat average.
export async function dominantHexFromUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Downscale first — a colour average needs no detail, and this keeps the
    // recolour pass fast/reliable. Then crop the flat background to the product's
    // bounding box, so the average reflects the product regardless of how much
    // white surrounds it (small items don't fill a fixed centre crop).
    const small = await sharp(buf)
      .resize(256, 256, { fit: "inside", withoutEnlargement: true })
      .toBuffer();
    let work: Buffer = small;
    try {
      work = await sharp(small).trim({ threshold: 12 }).toBuffer();
    } catch {
      work = small;
    }

    const meta = await sharp(work).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < 2 || h < 2) return null;

    // Average (mean) the centre 70% of the cropped product — skips edge
    // straps/zips/handles. `dominant` (histogram mode) was unusable: it latched
    // onto highlights/white and returned near-white even for black products.
    const cw = Math.max(1, Math.round(w * 0.7));
    const ch = Math.max(1, Math.round(h * 0.7));
    const left = Math.round((w - cw) / 2);
    const top = Math.round((h - ch) / 2);
    const { data } = await sharp(work)
      .extract({ left, top, width: cw, height: ch })
      .flatten({ background: "#ffffff" })
      .resize(1, 1, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const [r, g, b] = data;
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch {
    return null;
  }
}
