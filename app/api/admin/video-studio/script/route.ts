import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getSecrets } from "@/lib/settings";

export const dynamic = "force-dynamic";

const clean = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : [];

// Writes one natural, grammatically correct spoken line per scene, grounded in the real
// creator, in Spotlightly's voice. Returns a { sceneId: line } map.
const buildPrompt = (b: any): string => {
  const name = typeof b.name === "string" && b.name.trim() ? b.name.trim() : "this creator";
  const bio = typeof b.bio === "string" ? b.bio.trim().slice(0, 400) : "";
  const angle = typeof b.angle === "string" ? b.angle : "launch";
  const categories = clean(b.categories).slice(0, 8);
  const summaries = clean(b.summaries).slice(0, 6);
  const campaign = b.campaign && typeof b.campaign.title === "string" ? b.campaign : null;
  const tiers = Array.isArray(b.tiers) ? b.tiers.slice(0, 5) : [];
  const scenes: { id: string; label: string; current: string }[] = Array.isArray(b.scenes) ? b.scenes : [];

  const sceneGuide = scenes
    .map((s) => {
      const hints: Record<string, string> = {
        hook: "the first line, stop the scroll, curiosity or emotion, never a feature or price",
        opening: `introduce the creator by name (${name})`,
        profile: "what this creator is really about, in their world",
        memberships: tiers.length
          ? `the paid membership, lowest price is $${tiers[0]?.price ?? ""} a month, keep the price as a symbol`
          : "why becoming a member is worth it",
        campaign: campaign ? `their campaign "${campaign.title}", goal ${campaign.goal ?? ""}` : "their current push",
        marketplace: "they sell their own work too",
        posts: "the posts only members get to see",
        cta: "the closing call to action, you may name Spotlightly here",
        clip1: "SKIP",
        clip2: "SKIP",
        clip3: "SKIP",
        photo1: "SKIP",
        photo2: "SKIP",
        photo3: "SKIP",
        intro: `introduce the creator by name (${name})`,
      };
      return `${s.id}: ${hints[s.id] ?? s.label}`;
    })
    .filter((l) => !l.includes("SKIP"))
    .join("\n");

  return `You write the voiceover script for a short vertical promo reel about ONE creator. Each scene gets exactly ONE spoken line. This reel both promotes the creator and shows other creators what is possible, so it should feel exciting and aspirational, never empty or discouraging.

Voice rules, follow every one:
- Warm and specific, like a smart friend who wants them to win. Never corporate, never hype. Banned words: powerful, seamless, unleash, elevate, empower, robust.
- The creator is the hero. Only the closing line may name Spotlightly.
- Perfect, natural grammar. Read each line out loud in your head, it must sound like a real person talking.
- No em dashes and no hyphens anywhere. Use periods or commas.
- Short. Most lines 6 to 14 words.
- Grounded in THIS creator below. A stranger must not be able to swap in any other creator.
- If the material is thin, the creator is new. Sell the future and being early. Do not invent facts.
- Never repeat a phrase across scenes. The hook must NOT be the campaign title.
- Keep prices as symbols like $9.99. Never spell out dollars and cents.

Creator: ${name}
What they do: ${categories.join(", ") || "unknown"}
In their photos: ${summaries.join(" | ") || "unknown"}
Bio: ${bio || "none"}
${campaign ? `Campaign: "${campaign.title}", goal ${campaign.goal ?? "unknown"}` : "No active campaign."}
${tiers.length ? `Membership tiers: ${tiers.map((t: any) => `${t.name} ${t.price ? `$${t.price}` : ""}`).join(", ")}` : ""}
Story angle: ${angle}

Write a line for each of these scenes:
${sceneGuide}

Return ONLY a JSON object whose keys are the scene ids above and whose values are the lines. No prose, no markdown.`;
};

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ lines: {}, configured: false });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{ role: "user", content: buildPrompt(body) }],
      }),
    });
    if (!res.ok) return NextResponse.json({ lines: {}, configured: true });
    const data = await res.json();
    const text: string = data?.content?.find((c: any) => c.type === "text")?.text ?? "";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    const lines: Record<string, string> = {};
    if (parsed && typeof parsed === "object") {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string" && v.trim()) {
          // Stay on brand: no em dashes or hyphens, sane length.
          lines[k] = v.trim().replace(/\s*[—–-]\s*/g, ", ").slice(0, 160);
        }
      }
    }
    return NextResponse.json({ lines, configured: true });
  } catch {
    return NextResponse.json({ lines: {}, configured: true });
  }
}
