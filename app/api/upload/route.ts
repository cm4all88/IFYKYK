import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { BUNNY_STORAGE_ZONE, BUNNY_API_KEY, BUNNY_CDN_URL } = await getSecrets([
    "BUNNY_STORAGE_ZONE",
    "BUNNY_API_KEY",
    "BUNNY_CDN_URL",
  ]);

  if (!BUNNY_STORAGE_ZONE || !BUNNY_API_KEY || !BUNNY_CDN_URL) {
    return NextResponse.json(
      { error: `Upload not configured. Missing: ${[
          !BUNNY_STORAGE_ZONE && "BUNNY_STORAGE_ZONE",
          !BUNNY_API_KEY && "BUNNY_API_KEY",
          !BUNNY_CDN_URL && "BUNNY_CDN_URL",
        ].filter(Boolean).join(", ")}` },
      { status: 503 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Accept common image types including HEIC from iPhone
  const okTypes = [
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "image/gif", "image/heic", "image/heif", "image/avif",
  ];
  // Also allow if type is empty but extension looks like an image
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const okExts = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "avif"];

  if (!okTypes.includes(file.type) && !okExts.includes(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type || ext}. Use JPG, PNG, or WebP.` },
      { status: 400 }
    );
  }

  // 25MB limit — covers large phone photos
  const MAX_BYTES = 25 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 25 MB limit" }, { status: 400 });
  }

  // Use jpeg as fallback content type if browser reports empty
  const contentType = file.type || "image/jpeg";

  // Build unique path
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const safeExt = okExts.includes(ext) ? ext : "jpg";
  const filePath = `${user.id}/${stamp}-${rand}.${safeExt}`;

  const buffer = await file.arrayBuffer();
  const storageEndpoint = process.env.BUNNY_STORAGE_ENDPOINT || "la.storage.bunnycdn.com";
  const uploadUrl = `https://${storageEndpoint}/${BUNNY_STORAGE_ZONE}/${filePath}`;

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "AccessKey": BUNNY_API_KEY,
      "Content-Type": contentType,
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const errBody = await uploadRes.text();
    console.error("Bunny upload failed:", uploadRes.status, errBody);
    // Return the actual BunnyCDN error so we can debug
    return NextResponse.json(
      { error: `Upload failed (${uploadRes.status}): ${errBody}` },
      { status: 500 }
    );
  }

  // Strip any accidental protocol/slashes from the CDN URL env var
  const cleanCdnUrl = BUNNY_CDN_URL
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/^\/+/, "");
  const publicUrl = `https://${cleanCdnUrl}/${filePath}`;
  return NextResponse.json({ url: publicUrl });
}
