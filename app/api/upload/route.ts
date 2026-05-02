import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { uploadFile } from "@/lib/bunny";

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const postId = formData.get("postId") as string;

  if (!file) return Response.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.split(".").pop();
  const path = `creators/${user.id}/posts/${postId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const url = await uploadFile(path, buffer, file.type);
    return Response.json({ url, path });
  } catch (err) {
    console.error("Upload error:", err);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
