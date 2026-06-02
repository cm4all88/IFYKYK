import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { isBillingLocked } from "@/lib/billing";
import { moderateChatMessage } from "@/lib/advisor";
import { getSecrets } from "@/lib/settings";

// AI honesty check for locked posts — separate from content moderation.
// Verifies the description accurately represents what's being sold.
async function verifyLockedPostDescription(
  caption: string,
  unlockPrice: number,
  mediaType: string | null,
  creatorKind: string
): Promise<{ honest: boolean; reason: string }> {
  const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);
  if (!ANTHROPIC_API_KEY) return { honest: true, reason: "" };

  const prompt = `You are reviewing a locked post that a creator wants to sell for $${unlockPrice.toFixed(2)}.

Platform tier: ${creatorKind === "backstage" ? "Backstage (adult content allowed)" : "Spotlight (SFW only)"}
Media type: ${mediaType ?? "unknown"}
Post description/caption: "${caption}"

Your job is to check ONE thing: does this description honestly represent what's being sold?

Flag it if:
- The description is intentionally vague to mislead buyers ("you won't believe this", "must see")
- It promises specific content it likely can't deliver ("I'll answer any question you have")
- It uses bait-and-switch language
- The price seems designed to deceive (e.g. charging $49.99 for something described as a "quick tip")

Do NOT flag it for content type — that's handled separately.

Reply with ONLY valid JSON: {"honest": true} or {"honest": false, "reason": "one sentence explanation"}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text ?? "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { honest: true, reason: "" };
  }
}

// Wrap any async call with a timeout — if it takes too long, return the fallback
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  const timeout = new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms));
  return Promise.race([promise, timeout]);
}

// Normalize mediaType to constraint-allowed values
function normalizeMediaType(raw: string | null): "image" | "video" | "gallery" | null {
  if (!raw) return null;
  if (raw.startsWith("image/") || raw === "image") return "image";
  if (raw.startsWith("video/") || raw === "video") return "video";
  if (raw === "gallery") return "gallery";
  return null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: __billing } = await (supabase as any)
    .from("creator_billing").select("status, trial_ends_at, grace_ends_at").eq("user_id", user.id).maybeSingle();
  if (isBillingLocked(__billing)) {
    return NextResponse.json({ error: "Add a payment method in Billing to publish.", billingLocked: true }, { status: 402 });
  }

  const { caption, mediaUrl, mediaType, tier, creatorProfileId, lockType, unlockPrice, earlyAccessAt, tags, postType, expiresAt, scheduledAt, isPinned, campaignId } = await req.json();

  const { data: profile } = await (supabase as any)
    .from("creator_profiles")
    .select("id, kind")
    .eq("id", creatorProfileId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // ── Content moderation gate ─────────────────────────────────────
  if (caption?.trim()) {
    let mod: { allowed: boolean; reason?: string } = { allowed: true, reason: "" };
    try {
      mod = await withTimeout(
        moderateChatMessage(caption.trim(), {
          creatorType: profile.kind === "backstage" ? "backstage" : "spotlight",
        }),
        5000,
        { allowed: true, reason: "" }
      );
    } catch {
      // Moderation unavailable — allow post through
    }
    if (!(mod as any).allowed) {
      await (supabase as any).from("moderation_events").insert({
        creator_id: creatorProfileId,
        content_type: "post",
        flag_reason: (mod as any).reason ?? "Content policy violation",
        severity: (mod as any).severity ?? "medium",
        action_taken: "blocked_at_publish",
      });
      return NextResponse.json({ error: `Post blocked: ${mod.reason}`, blocked: true }, { status: 422 });
    }
  }

  // ── Locked post honesty check ────────────────────────────────────
  // Only runs when creator is charging for a specific post.
  // Checks that the description isn't misleading buyers.
  if (lockType === "purchase" && unlockPrice > 0 && caption?.trim()) {
    let honesty = { honest: true, reason: "" };
    try {
      honesty = await withTimeout(
        verifyLockedPostDescription(caption.trim(), unlockPrice, mediaType ?? null, profile.kind),
        5000,
        { honest: true, reason: "" }
      );
    } catch {
      // Honesty check unavailable — allow post through
    }
    if (!honesty.honest) {
      return NextResponse.json({
        error: `Your description needs to be updated before this post can be sold: ${honesty.reason}`,
        dishonest: true,
      }, { status: 422 });
    }
  }

  // ── Publish ─────────────────────────────────────────────────────
  const resolvedLockType = lockType ?? (tier === "premium" ? "subscription" : "free");
  const resolvedTier = resolvedLockType === "subscription" ? "premium" : (tier ?? "free");

  const { data: post, error } = await (supabase as any)
    .from("posts")
    .insert({
      creator_profile_id: creatorProfileId,
      caption: caption?.trim() || null,
      media_url: mediaUrl || null,
      media_type: normalizeMediaType(mediaType),
      tier: resolvedTier,
      lock_type: resolvedLockType,
      unlock_price: lockType === "purchase" ? (unlockPrice ?? null) : null,
      early_access_at: earlyAccessAt ?? null,
      tags: Array.isArray(tags) ? tags : [],
      post_type: postType ?? "post",
      expires_at: expiresAt ?? null,
      is_pinned: isPinned ?? false,
      campaign_id: campaignId ?? null,
      status: scheduledAt ? "scheduled" : "live",
      scheduled_at: scheduledAt ?? null,
      moderation_status: "approved",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post });
}
