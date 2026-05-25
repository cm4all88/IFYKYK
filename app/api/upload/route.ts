import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/upload
 * Body: multipart/form-data with `file` field
 * Returns: { url: string }
 *
 * Server uploads the file to BunnyCDN Storage, returns the public CDN URL.
 * Authentication: must be a logged-in creator. Files go under user_id/ prefix.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { BUNNY_STORAGE_ZONE, BUNNY_API_KEY, BUNNY_CDN_URL } = await getSecrets([
    "BUNNY_STORAGE_ZONE",
    "BUNNY_API_KEY",
    "BUNNY_CDN_URL",
  ]);

  if (!BUNNY_STORAGE_ZONE || !BUNNY_API_KEY || !BUNNY_CDN_URL) {
    return NextResponse.json(
      { error: "File upload not configured. Set BunnyCDN keys in /admin." },
      { status: 503 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate type & size
  const okTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!okTypes.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}. Use JPG, PNG, WebP, or GIF.` },
      { status: 400 }
    );
  }
  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 400 });
  }

  // Build a unique path
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${user.id}/${stamp}-${rand}.${ext}`;

  // Upload to Bunny Storage
  const buffer = await file.arrayBuffer();
  // Region-specific endpoint — LA zone uses la.storage.bunnycdn.com
  const storageEndpoint = process.env.BUNNY_STORAGE_ENDPOINT || 'storage.bunnycdn.com';
  const uploadUrl = `https://${storageEndpoint}/${BUNNY_STORAGE_ZONE}/${path}`;

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "AccessKey": BUNNY_API_KEY,
      "Content-Type": file.type,
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const errBody = await uploadRes.text();
    console.error("Bunny upload failed:", uploadRes.status, errBody);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const publicUrl = `https://${BUNNY_CDN_URL}/${path}`;
  return NextResponse.json({ url: publicUrl });
}
