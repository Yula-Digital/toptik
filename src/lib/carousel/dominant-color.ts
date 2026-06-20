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

    // Centre 50% of the image — solidly the product body.
    const cw = Math.max(1, Math.round(w * 0.5));
    const ch = Math.max(1, Math.round(h * 0.5));
    const left = Math.round((w - cw) / 2);
    const top = Math.round((h - ch) / 2);

    const center = await sharp(buf)
      .extract({ left, top, width: cw, height: ch })
      .flatten({ background: "#ffffff" })
      .toBuffer();

    const { dominant } = await sharp(center).stats();
    return `#${toHex(dominant.r)}${toHex(dominant.g)}${toHex(dominant.b)}`;
  } catch {
    return null;
  }
}
