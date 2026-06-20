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
    const meta = await sharp(buf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < 4 || h < 4) return null;

    // Centre 35% of the image — solidly the product body, away from the white
    // margins and the side strap/logo.
    const cw = Math.max(1, Math.round(w * 0.35));
    const ch = Math.max(1, Math.round(h * 0.35));
    const left = Math.round((w - cw) / 2);
    const top = Math.round((h - ch) / 2);

    // Use the MEAN colour (resize to 1px averages the region). `dominant` (the
    // histogram mode) was unusable here — it latched onto bright highlights/white
    // and returned near-white for every product, including black ones.
    const { data } = await sharp(buf)
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
