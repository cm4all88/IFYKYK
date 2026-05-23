import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 120;

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf":                           "pdf",
  "application/zip":                           "zip",
  "application/x-zip-compressed":             "zip",
  "audio/mpeg":                                "mp3",
  "audio/mp3":                                 "mp3",
  "video/mp4":                                 "mp4",
  "application/epub+zip":                      "epub",
  "image/vnd.adobe.photoshop":                "psd",
  "application/octet-stream":                  "other",
};

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { BUNNY_STORAGE_ZONE, BUNNY_STORAGE_KEY, BUNNY_CDN_HOST } = await getSecrets([
    "BUNNY_STORAGE_ZONE", "BUNNY_STORAGE_KEY", "BUNNY_CDN_HOST",
  ]);

  if (!BUNNY_STORAGE_ZONE || !BUNNY_STORAGE_KEY || !BUNNY_CDN_HOST) {
    return NextResponse.json(
      { error: "File storage not configured. Add BunnyCDN keys in Admin → Credentials." },
      { status: 503 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 500 MB limit" }, { status: 400 });
  }

  const fileType = ALLOWED_TYPES[file.type] ?? "other";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `digital/${user.id}/${stamp}-${rand}.${ext}`;

  const buffer = await file.arrayBuffer();
  const uploadRes = await fetch(
    `https://storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/${path}`,
    {
      method: "PUT",
      headers: { "AccessKey": BUNNY_STORAGE_KEY, "Content-Type": file.type },
      body: buffer,
    }
  );

  if (!uploadRes.ok) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({
    url: `https://${BUNNY_CDN_HOST}/${path}`,
    fileName: file.name,
    fileSizeBytes: file.size,
    fileType,
  });
}
