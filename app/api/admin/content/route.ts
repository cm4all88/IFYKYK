import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getSecrets } from "@/lib/settings";

export const runtime = "nodejs";

const SYSTEM = `You are the social content writer for Spotlightly, a creator monetization platform. Write in the locked brand voice and return ONLY valid JSON — no markdown, no preamble.

BRAND SOUL: "I can finally feel close." The creator is the hero; Spotlightly is the venue. Connection before monetization.

VOICE: A smart friend who already made it as a creator and genuinely wants you to too. Warm and direct — say the real thing, never soften it into corporate language. Specific over generic: name the real person ("a nurse posting yoga on the side", not "creators with professional identities"). The creator is always the hero, never the platform. Earn the money talk — connection first. Never say "our platform" or "we offer" — say "Spotlightly" or talk about the feature directly.

THE PITCH (this is the SFW Spotlightly brand for TikTok/Instagram — NEVER reference adult content or Backstage): Creators keep 100% of subscriptions and tips, minus only Stripe fees. Spotlightly takes 0% of subscription revenue and 0% of tips — it charges the creator a flat monthly fee instead. No 20% platform cut like the others.

BANNED — never use: "powerful tools", "seamless", "unleash your potential", "robust", "take control", "revenue streams", "monetization suite", "industry-leading", "game-changer", "elevate", "empower", "supercharge", "level up".`;

const PILLAR_GUIDES: Record<string, string> = {
  money:
    "The money math. Fee comparisons and earnings breakdowns. Make the number land emotionally. e.g. 'They take 20% forever. At 1,000 subscribers that's $2,000 a month they keep — you'd keep it here.' Highest-conversion pillar.",
  product:
    "Product demo. Show what Spotlightly looks and feels like to use — the page, the setup, the spotlight aesthetic. Concrete and visual since it pairs with a screen recording. 'Your page, live in 60 seconds.'",
  commentary:
    "Creator-economy commentary. React to platform fees, news, or a common creator frustration with a clear point of view. Build-in-public energy. Newsjack when relevant.",
  brand:
    "Brand / aspirational. Carry the soul — 'every creator deserves a spotlight', 'I can finally feel close.' Emotional, shareable, not salesy.",
};

function buildUserPrompt(guide: string, platform: string, topic: string) {
  return `PLATFORM: ${platform}. Short-form vertical video / carousel. First 1-2 seconds is everything. The creator does NOT film themselves — everything pairs with text-on-screen, screen recordings, or carousels.

CONTENT PILLAR: ${guide}

TOPIC: ${topic}

Return ONLY this JSON object, no markdown fences, no trailing text:
{
  "hooks": ["5 distinct opening lines, each under 12 words, scroll-stopping, in brand voice"],
  "caption": "the post caption, 1-3 short sentences, ends with one clear action",
  "hashtags": ["6-10 relevant hashtags, each starting with #"],
  "carousel": ["5-7 slide lines; each is one short punchy line for one slide; slide 1 is the hook"],
  "posting_note": "1-2 sentences on what to pair this with visually (screen recording / text-on-screen / trending audio), given the creator does not film"
}`;
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const pillar: string = body?.pillar ?? "money";
    const platform: string = body?.platform ?? "Both";
    const topic: string = (body?.topic ?? "").toString();

    if (!topic.trim()) {
      return NextResponse.json({ error: "Topic required" }, { status: 400 });
    }

    const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Anthropic key not configured — add it in Admin → Credentials." },
        { status: 500 }
      );
    }

    const guide = PILLAR_GUIDES[pillar] ?? PILLAR_GUIDES.money;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", // swap to "claude-haiku-4-5-20251001" to cut cost
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{ role: "user", content: buildUserPrompt(guide, platform, topic) }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Generation failed" }, { status: 500 });
    }

    const data = await res.json();
    const text: string = (data?.content ?? [])
      .map((b: { type: string; text?: string }) => (b.type === "text" ? b.text ?? "" : ""))
      .join("")
      .trim();

    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      return NextResponse.json({ result: parsed });
    } catch {
      return NextResponse.json({ raw: text || "No response. Try again." });
    }
  } catch {
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
