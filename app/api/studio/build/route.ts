import { NextRequest, NextResponse } from "next/server";
import { getSecrets } from "@/lib/settings";
import { TIER_NICHES, tierNicheById } from "@/lib/tier-templates";
import { categoryById, CAMPAIGN_CATEGORIES } from "@/lib/campaign-templates";
import type { RewardType } from "@/lib/campaign-rewards";

export const runtime = "nodejs";

const ALLOWED: RewardType[] = ["update", "recognition", "content", "physical", "discount"];

// niche -> closest campaign category, so a "from scratch" fallback still lines up.
const NICHE_TO_CATEGORY: Record<string, string> = {
  musician: "music", artist: "creative", fitness: "other", writer: "creative",
  educator: "education", streamer: "other", lifestyle: "other", general: "other",
};

const SYSTEM = `You set up a creator's entire Spotlightly page from a short description of who they are. You return their bio, their free tier, their paid subscription ladder, and a starter campaign, all consistent with each other because they describe the same creator.

Spotlightly takes 0% of what a creator earns. The page is a venue and the creator is the star. The free tier is the open door (everyone can follow). Paid tiers are the seats fans buy monthly. A campaign is a one time fundraiser with backing tiers.

WRITING RULES:
- Warm, specific, first person where natural, in the creator's voice. The creator is the hero, never the platform.
- Never use em-dashes or hyphens. Use periods, commas, or parentheses. Write "behind the scenes" not the hyphenated form.
- No marketing speak. No "powerful", "seamless", "unleash", "passionate about", "content creator".

Return ONLY a JSON object, no preamble or backticks, exactly this shape:
{
  "bio": "1 or 2 sentences, first person, what a fan gets by being here",
  "freeTier": { "name": "e.g. Follow Along", "blurb": "1 sentence", "perks": ["...","...","..."] },
  "tiers": [
    { "name": "...", "price_monthly": 5, "description": "1 line", "perks": ["...","..."] }
  ],
  "campaign": {
    "title": "...",
    "description": "1 or 2 sentences, first person",
    "goal": 3000,
    "category": "one of: travel, music, creative, art-supplies, classroom, equipment, medical, moving, education, other",
    "tiers": [ { "amount": 10, "title": "...", "description": "1 line", "rewards": [ { "type": "update", "label": "..." } ] } ]
  }
}

Rules: exactly 3 paid tiers (entry around $5 to $8, middle around $12 to $25, top around $40 to $75, each higher tier saying "Everything in [lower]" then adding more). Exactly 5 campaign tiers climbing in price, each with 1 to 3 rewards. Reward "type" must be one of: update, recognition, content, physical, discount.`;

function num(v: any): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function str(v: any): string { return String(v ?? "").trim(); }
function strArr(v: any, max: number): string[] {
  return Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean).slice(0, max) : [];
}
function subTier(t: any): any | null {
  const name = str(t?.name); const m = num(t?.price_monthly);
  if (!name || m <= 0) return null;
  return { name, price_monthly: Math.round(m * 100) / 100, price_yearly: Math.round(m * 10 * 100) / 100, description: str(t?.description), perks: strArr(t?.perks, 6) };
}
function campTier(t: any): any | null {
  const title = str(t?.title); const a = num(t?.amount);
  if (!title || a <= 0) return null;
  const rewards = Array.isArray(t?.rewards)
    ? t.rewards.map((r: any) => { const type = ALLOWED.includes(r?.type) ? r.type : "content"; const label = str(r?.label); return label ? { type, label } : null; }).filter(Boolean).slice(0, 3)
    : [];
  return { amount: Math.round(a), title, description: str(t?.description), rewards };
}

// Deterministic fallback when the assistant is unavailable: build from templates.
function fallback(niche: string | null) {
  const n = tierNicheById(niche) ?? TIER_NICHES.find((x) => x.id === "general")!;
  const catId = NICHE_TO_CATEGORY[n.id] ?? "other";
  const cat = categoryById(catId) ?? CAMPAIGN_CATEGORIES.find((c) => c.id === "other")!;
  return {
    bio: "",
    freeTier: { name: "Follow Along", blurb: "Follow for free and never miss a thing.", perks: ["Members only updates", "Public posts and announcements", "First to know when something new drops"] },
    tiers: n.tiers.map((t) => ({ ...t, perks: [...t.perks] })),
    campaign: { title: cat.titleIdea, description: cat.descriptionIdea, goal: cat.goal, category: cat.id, tiers: cat.tiers.map((t) => ({ amount: t.amount, title: t.title, description: t.description, rewards: t.rewards.map((r) => ({ ...r })) })) },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { niche, makes, fans, workingToward, displayName, handle } = body ?? {};

    const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ ...fallback(niche), generated: false });
    }

    const n = tierNicheById(niche);
    const ctx = [
      displayName ? `Creator: ${displayName}` : null,
      handle ? `Handle: @${handle}` : null,
      n ? `Kind of creator: ${n.label}` : null,
      makes ? `What they make: ${makes}` : null,
      fans ? `Who their fans are: ${fans}` : null,
      workingToward ? `What they are working toward (a good campaign): ${workingToward}` : null,
    ].filter(Boolean).join("\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 2600, system: SYSTEM, messages: [{ role: "user", content: `Set up the whole page for this creator.\n\n${ctx}` }] }),
    });
    if (!res.ok) return NextResponse.json({ ...fallback(niche), generated: false });

    const data = await res.json();
    let raw: string = data.content?.[0]?.text ?? "";
    raw = raw.replace(/```json|```/g, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ ...fallback(niche), generated: false }); }

    const tiers = Array.isArray(parsed?.tiers) ? parsed.tiers.map(subTier).filter(Boolean).slice(0, 4) : [];
    const ft = parsed?.freeTier ?? {};
    const camp = parsed?.campaign ?? {};
    const campTiers = Array.isArray(camp?.tiers) ? camp.tiers.map(campTier).filter(Boolean).slice(0, 5) : [];
    const catId = categoryById(camp?.category)?.id ?? (NICHE_TO_CATEGORY[niche ?? ""] ?? "other");
    const fb = fallback(niche);

    return NextResponse.json({
      generated: true,
      bio: str(parsed?.bio),
      freeTier: {
        name: str(ft?.name) || fb.freeTier.name,
        blurb: str(ft?.blurb) || fb.freeTier.blurb,
        perks: strArr(ft?.perks, 6).length ? strArr(ft?.perks, 6) : fb.freeTier.perks,
      },
      tiers: tiers.length ? tiers : fb.tiers,
      campaign: {
        title: str(camp?.title) || fb.campaign.title,
        description: str(camp?.description) || fb.campaign.description,
        goal: num(camp?.goal) > 0 ? Math.round(num(camp?.goal)) : fb.campaign.goal,
        category: catId,
        tiers: campTiers.length ? campTiers : fb.campaign.tiers,
      },
    });
  } catch {
    return NextResponse.json({ ...fallback(null), generated: false });
  }
}
