import { NextRequest, NextResponse } from "next/server";
import { getSecrets } from "@/lib/settings";
import { categoryById } from "@/lib/campaign-templates";
import type { RewardType, TierReward } from "@/lib/campaign-rewards";

export const runtime = "nodejs";

const ALLOWED: RewardType[] = ["update", "recognition", "content", "physical", "discount"];

const SYSTEM = `You build complete crowdfunding campaigns for creators on Spotlightly. A creator answers a few short questions and you return a finished campaign they can edit: a title, a description, a funding goal, image ideas, and five backing tiers from lowest to highest.

Spotlightly takes 0% of what a creator raises. Tiers are the seats: a low tier is recognition and updates, higher tiers add exclusive content, the top tier adds a real perk. Each tier carries one to three rewards, each reward having a TYPE and a short LABEL the creator could show on their page.

Reward types (use these exact type strings):
- "update": exclusive campaign updates only backers see.
- "recognition": public acknowledgment and supporter status.
- "content": exclusive posts, photos, videos, journals, or livestreams.
- "physical": a real item the creator ships or provides.
- "discount": a coupon code for products, merch, or services.

WRITING RULES:
- Warm, specific, in the creator's voice. The creator is the hero, never the platform.
- Never use em-dashes or hyphens. Use periods, commas, or parentheses instead.
- Never write "behind-the-scenes" with hyphens. Write "behind the scenes".
- No marketing speak. No "powerful", "seamless", "unleash", "passionate about".
- Tier titles are evocative and short (one to three words). Amounts climb sensibly (for example 10, 25, 50, 100, 250), tuned to the goal.
- Where it genuinely fits the creator, lead a tier name with a single tasteful emoji (for example ✈️ travel, 🎵 music, 🎨 art, 💪 fitness). Use an emoji only when it fits, never force one. Make names evocative and shareable, the kind a fan would screenshot.
- Five tiers, each with a one line description and one to three rewards.

Return ONLY a JSON object, no preamble or backticks, exactly:
{"title":"...","description":"...","goal":2500,"imageIdeas":["...","...","..."],"tiers":[{"amount":10,"title":"...","description":"...","rewards":[{"type":"update","label":"..."}]}]}`;

function sanitizeTier(t: any): any | null {
  const amount = Number(t?.amount);
  const title = String(t?.title ?? "").trim();
  if (!title || !Number.isFinite(amount) || amount <= 0) return null;
  const rewards: TierReward[] = Array.isArray(t?.rewards)
    ? (t.rewards
        .map((rw: any) => {
          const type = ALLOWED.includes(rw?.type) ? (rw.type as RewardType) : "content";
          const label = String(rw?.label ?? "").trim();
          return label ? { type, label } : null;
        })
        .filter(Boolean)
        .slice(0, 3) as TierReward[])
    : [];
  return { amount: Math.round(amount), title, description: String(t?.description ?? "").trim(), rewards };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { category, raisingFor, why, contentType, experience, displayName, handle } = body ?? {};

    const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "The campaign assistant isn't set up yet." }, { status: 200 });
    }

    const cat = categoryById(category);
    const ctx = [
      displayName ? `Creator: ${displayName}` : null,
      handle ? `Handle: @${handle}` : null,
      cat ? `Category: ${cat.label}` : null,
      raisingFor ? `What they are raising money for: ${raisingFor}` : null,
      why ? `Why it matters to them: ${why}` : null,
      contentType ? `The kind of content they make: ${contentType}` : null,
      experience ? `What supporters will experience: ${experience}` : null,
      cat ? `A reasonable goal for this category is around $${cat.goal}. Adjust to what they describe.` : null,
    ].filter(Boolean).join("\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: "user", content: `Build a complete five tier campaign for this creator.\n\n${ctx}` }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Couldn't reach the assistant just now. Try again." }, { status: 200 });
    }

    const data = await res.json();
    let raw: string = (data.content?.find((c: any) => c.type === "text")?.text ?? data.content?.[0]?.text ?? "");
    raw = raw.replace(/```json|```/g, "").trim();
    // Pull out the JSON object even if the model wrapped it in a sentence or two.
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    if (s >= 0 && e > s) raw = raw.slice(s, e + 1);

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "The assistant returned something unexpected. Try again." }, { status: 200 });
    }

    const tiers = Array.isArray(parsed?.tiers)
      ? parsed.tiers.map(sanitizeTier).filter(Boolean).slice(0, 5)
      : [];
    const goalNum = Number(parsed?.goal);

    return NextResponse.json({
      title: String(parsed?.title ?? "").trim(),
      description: String(parsed?.description ?? "").trim(),
      goal: Number.isFinite(goalNum) && goalNum > 0 ? Math.round(goalNum) : (cat?.goal ?? 2500),
      imageIdeas: Array.isArray(parsed?.imageIdeas) ? parsed.imageIdeas.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 4) : [],
      tiers,
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 200 });
  }
}
