import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const postId = new URL(req.url).searchParams.get("postId");
  if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

  const supabase = await createClient();

  const { data: comments } = await (supabase as any)
    .from("comments")
    .select("*, author:author_user_id(email)")
    .eq("post_id", postId)
    .order("is_boosted", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(100);

  return NextResponse.json({ comments: comments ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to comment" }, { status: 401 });

  const { postId, content } = await req.json();
  if (!postId || !content?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (content.trim().length > 500) {
    return NextResponse.json({ error: "Comment too long (max 500 chars)" }, { status: 400 });
  }

  // Get creator_profile_id from post
  const { data: post } = await (supabase as any)
    .from("posts")
    .select("creator_profile_id")
    .eq("id", postId)
    .maybeSingle();

  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const { data: comment, error } = await (supabase as any)
    .from("comments")
    .insert({
      post_id: postId,
      creator_profile_id: post.creator_profile_id,
      author_user_id: user.id,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { commentId } = await req.json();
  await (supabase as any).from("comments").delete().eq("id", commentId);
  return NextResponse.json({ ok: true });
}
