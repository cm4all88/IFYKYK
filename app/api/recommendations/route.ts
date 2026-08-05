import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { searchParams } = new URL(req.url);
  const useAI = searchParams.get("ai") === "1";
  const limit = Math.min(12, parseInt(searchParams.get("limit") ?? "8"));

  // ── Step 1: Collaborative filtering ──────────────────────────────
  // "Fans who subscribed to the same creators as you also subscribe to these"
  let recommendedIds: string[] = [];

  if (user) {
    const { data: collab } = await (supabase as any)
      .rpc("recommended_creators", { p_fan_user_id: user.id, p_limit: limit * 2 });

    recommendedIds = (collab ?? []).map((r: any) => r.creator_profile_id);
  }

  // ── Step 2: Interest-based fallback ─────────────────────────────
  // If collaborative filtering returns too few, fill with interest-matched creators
  let interestTags: string[] = [];

  if (user && recommendedIds.length < limit) {
    const { data: interests } = await (supabase as any)
      .from("fan_interests")
      .select("category")
      .eq("fan_user_id", user.id);

    interestTags = (interests ?? []).map((i: any) => i.category);
  }

  // ── Step 3: Fetch creator data ───────────────────────────────────
  let creators: any[] = [];

  if (recommendedIds.length > 0) {
    const { data } = await (supabase as any)
      .from("creator_public")
      .select("id, handle, display_name, bio, avatar_url, subscription_price, tags, location_city, location_country")
      .in("id", recommendedIds.slice(0, limit))
      .eq("kind", "spotlight")
      .not("onboarding_completed_at", "is", null);
    creators = data ?? [];
  }

  // Fill remaining slots with interest-matched creators
  if (creators.length < limit && interestTags.length > 0) {
    const existingIds = creators.map(c => c.id);
    const { data: interestMatched } = await (supabase as any)
      .from("creator_public")
      .select("id, handle, display_name, bio, avatar_url, subscription_price, tags")
      .eq("kind", "spotlight")
      .not("onboarding_completed_at", "is", null)
      .overlaps("tags", interestTags)
      .not("id", "in", `(${existingIds.length > 0 ? existingIds.join(",") : "null"})`)
      .order("created_at", { ascending: false })
      .limit(limit - creators.length);

    creators = [...creators, ...(interestMatched ?? [])];
  }

  // New creators fallback — when there's no data yet
  if (creators.length < limit) {
    const existingIds = creators.map(c => c.id);
    const { data: newest } = await (supabase as any)
      .from("creator_public")
      .select("id, handle, display_name, bio, avatar_url, subscription_price, tags")
      .eq("kind", "spotlight")
      .not("onboarding_completed_at", "is", null)
      .not("id", "in", `(${existingIds.length > 0 ? existingIds.join(",") : "null"})`)
      .order("created_at", { ascending: false })
      .limit(limit - creators.length);

    creators = [...creators, ...(newest ?? [])];
  }

  // ── Step 4: Claude AI ranking (optional, behind ?ai=1) ───────────
  // Only fires when explicitly requested — adds reasoning to each recommendation
  let aiReasons: Record<string, string> = {};

  if (useAI && user && creators.length > 0) {
    try {
      const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);

      if (ANTHROPIC_API_KEY) {
        // Fetch fan's subscription history for context
        const { data: subs } = await (supabase as any)
          .from("subscriptions")
          .select("creator:creator_profile_id(display_name, tags, bio)")
          .eq("fan_user_id", user.id)
          .eq("status", "active")
          .limit(5);

        const { data: interests } = await (supabase as any)
          .from("fan_interests")
          .select("category")
          .eq("fan_user_id", user.id);

        const fanContext = {
          subscribed_to: (subs ?? []).map((s: any) => ({
            name: s.creator?.display_name,
            tags: s.creator?.tags,
          })),
          interests: (interests ?? []).map((i: any) => i.category),
        };

        const prompt = `You are a creator recommendation engine for Spotlightly.

Fan profile:
${JSON.stringify(fanContext, null, 2)}

Candidate creators:
${JSON.stringify(creators.map(c => ({ id: c.id, name: c.display_name, tags: c.tags, bio: c.bio?.slice(0, 100) })), null, 2)}

For each creator, write a SHORT 1-sentence reason why this fan would like them, based on their interests and subscriptions. Be specific, not generic.

Respond ONLY with valid JSON: { "creator_id": "reason", ... }`;

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 500,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        const data = await res.json();
        const text = data.content?.[0]?.text ?? "{}";
        aiReasons = JSON.parse(text.replace(/```json|```/g, "").trim());
      }
    } catch {
      // AI layer failure is non-fatal — return creators without reasons
    }
  }

  return NextResponse.json({
    creators,
    reasons: aiReasons,
    source: recommendedIds.length > 0 ? "collaborative" : interestTags.length > 0 ? "interests" : "new",
  });
}
