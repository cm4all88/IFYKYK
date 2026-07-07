import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { notifyCreatorByProfile } from "@/lib/notify";

// Spend one medal from the fan's balance to crown a post. No charge here —
// medals were paid for at pack-purchase time. Atomic via the award_medal RPC.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to award a medal" }, { status: 401 });

  const { postId } = await req.json();
  if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

  const { data, error } = await (supabase as any).rpc("award_medal", { p_post_id: postId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (!data?.ok) {
    if (data?.error === "insufficient") {
      return NextResponse.json({ needsPurchase: true, balance: data.balance ?? 0 }, { status: 200 });
    }
    return NextResponse.json({ error: data?.error || "Could not award" }, { status: 400 });
  }

  // Recognise the creator — medals are a paid signal, worth a ping.
  try {
    const { data: p } = await (supabase as any)
      .from("posts").select("creator_profile_id, caption").eq("id", postId).maybeSingle();
    if (p?.creator_profile_id) {
      await notifyCreatorByProfile({
        creatorProfileId: p.creator_profile_id,
        type: "new_medal",
        title: "Your post got a medal 🏅",
        body: p.caption ? `On "${String(p.caption).slice(0, 60)}"` : "A fan crowned your post.",
        link: "/dashboard?pane=posts",
        exceptUserId: user.id,
      });
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, balance: data.balance });
}
