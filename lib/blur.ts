import sharp from "sharp";

// Generate a deliberately information-poor blurred placeholder from an image URL,
// returned as a small base64 data URL (~a few hundred bytes, 32px, heavily blurred).
//
// This is the ONLY pixel data a non-entitled viewer ever receives for a locked
// image. There is no original to "un-blur" or recover because the original is
// never sent to the client. The server fetches the original (it is allowed to),
// reduces it to mush, and returns that.
export async function blurDataUrl(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { cache: "no-store" });
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const out = await sharp(input)
      .resize(32, 32, { fit: "inside", withoutEnlargement: true })
      .blur(6)
      .jpeg({ quality: 35 })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}
