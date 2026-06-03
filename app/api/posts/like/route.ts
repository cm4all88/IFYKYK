import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Toggle a like on a post for the signed-in user.
// Returns the new { liked, count }.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to like posts" }, { status: 401 });

  let postId: string | undefined;
  try {
    ({ postId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

  const { data: existing } = await (supabase as any)
    .from("post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  let liked: boolean;
  if (existing) {
    const { error } = await (supabase as any).from("post_likes").delete().eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    liked = false;
  } else {
    const { error } = await (supabase as any)
      .from("post_likes")
      .insert({ post_id: postId, user_id: user.id });
    // A duplicate (double-tap race) is fine — treat as liked.
    if (error && !/(duplicate|unique)/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    liked = true;
  }

  const { data: p } = await (supabase as any)
    .from("posts")
    .select("likes_count")
    .eq("id", postId)
    .single();

  return NextResponse.json({ liked, count: p?.likes_count ?? 0 });
}
