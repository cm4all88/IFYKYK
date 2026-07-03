import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { BUNNY, bunnyUploadUrl, bunnyCdnUrl } from "@/lib/bunny";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (!BUNNY.API_KEY || !BUNNY.STORAGE_ZONE) {
    return NextResponse.json({ error: "Upload not configured — missing BunnyCDN keys" }, { status: 503 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Accept common image formats (incl. iPhone HEIC) and short video clips.
  const okTypes = [
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "image/gif", "image/heic", "image/heif", "image/avif",
    "video/mp4", "video/quicktime", "video/webm",
  ];
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const okExts = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "avif", "mp4", "mov", "webm", "m4v"];
  const videoExts = ["mp4", "mov", "webm", "m4v"];

  if (!okTypes.includes(file.type) && !okExts.includes(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type || ext}. Use an image (JPG, PNG, WebP) or a clip (MP4, MOV).` },
      { status: 400 }
    );
  }

  const isVideo = file.type.startsWith("video/") || videoExts.includes(ext);
  const MAX_BYTES = (isVideo ? 50 : 25) * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File exceeds ${isVideo ? 50 : 25} MB limit` }, { status: 400 });
  }

  const contentType = file.type || (isVideo ? "video/mp4" : "image/jpeg");
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const safeExt = okExts.includes(ext) ? ext : "jpg";
  const filePath = `${user.id}/${stamp}-${rand}.${safeExt}`;

  const buffer = await file.arrayBuffer();
  const uploadRes = await fetch(bunnyUploadUrl(filePath), {
    method: "PUT",
    headers: {
      "AccessKey": BUNNY.API_KEY,
      "Content-Type": contentType,
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const errBody = await uploadRes.text();
    console.error("Bunny upload failed:", uploadRes.status, errBody);
    return NextResponse.json(
      { error: `Upload failed (${uploadRes.status}): ${errBody}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: bunnyCdnUrl(filePath) });
}
