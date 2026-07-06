import { NextRequest, NextResponse } from "next/server";
import { getSecrets } from "@/lib/settings";
import { tierNicheById } from "@/lib/tier-templates";

export const runtime = "nodejs";

const SYSTEM = `You build a subscription tier ladder for a creator on Spotlightly. The creator answers a few short questions and you return three monthly tiers from lowest to highest, the kind fans pay every month to support a creator and get exclusive access.

Spotlightly takes 0% of what a creator earns. A good ladder has an affordable entry tier (around $5 to $8), a middle tier that is the main offer (around $12 to $25), and a top tier for the most devoted fans (around $40 to $75). Each higher tier says "Everything in [lower tier name]" then adds more.

Each tier has: a short evocative name (one or two words), a monthly price, a one line description, and three to five perks. Perks are concrete and specific to what this creator actually makes.

WRITING RULES:
- Warm, specific, in the creator's voice. The creator is the hero, never the platform.
- Never use em-dashes or hyphens. Use periods, commas, or parentheses instead.
- Never write "behind-the-scenes" with hyphens. Write "behind the scenes".
- No marketing speak. No "powerful", "seamless", "unleash", "passionate about".
- Where it genuinely fits the creator, lead a tier name with a single tasteful emoji (for example ✈️ travel, 🎵 music, 🎨 art, 💪 fitness). Use an emoji only when it fits, never force one. Make names evocative and shareable, the kind a fan would screenshot.

Return ONLY a JSON object, no preamble or backticks, exactly:
{"tiers":[{"name":"...","price_monthly":5,"description":"...","perks":["...","..."]}]}`;

function sanitize(t: any): any | null {
  const name = String(t?.name ?? "").trim();
  const price = Number(t?.price_monthly);
  if (!name || !Number.isFinite(price) || price <= 0) return null;
  const perks = Array.isArray(t?.perks)
    ? t.perks.map((p: any) => String(p).trim()).filter(Boolean).slice(0, 6)
    : [];
  return {
    name,
    price_monthly: Math.round(price * 100) / 100,
    price_yearly: Math.round(price * 10 * 100) / 100,
    description: String(t?.description ?? "").trim(),
    perks,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { niche, contentType, audience, displayName, handle } = body ?? {};

    const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "The tier assistant isn't set up yet." }, { status: 200 });
    }

    const n = tierNicheById(niche);
    const ctx = [
      displayName ? `Creator: ${displayName}` : null,
      handle ? `Handle: @${handle}` : null,
      n ? `Kind of creator: ${n.label}` : null,
      contentType ? `What they make: ${contentType}` : null,
      audience ? `Who their fans are: ${audience}` : null,
    ].filter(Boolean).join("\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        system: SYSTEM,
        messages: [{ role: "user", content: `Build a three tier subscription ladder for this creator.\n\n${ctx}` }],
      }),
    });
    if (!res.ok) return NextResponse.json({ error: "Couldn't reach the assistant just now. Try again." }, { status: 200 });

    const data = await res.json();
    let raw: string = (data.content?.find((c: any) => c.type === "text")?.text ?? data.content?.[0]?.text ?? "");
    raw = raw.replace(/```json|```/g, "").trim();
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    if (s >= 0 && e > s) raw = raw.slice(s, e + 1);
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ error: "The assistant returned something unexpected. Try again." }, { status: 200 }); }

    const tiers = Array.isArray(parsed?.tiers) ? parsed.tiers.map(sanitize).filter(Boolean).slice(0, 4) : [];
    return NextResponse.json({ tiers });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 200 });
  }
}
