import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getSecrets } from "@/lib/settings";

export const dynamic = "force-dynamic";

const cleanArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : [];

const buildPrompt = (b: any): string => {
  const name = typeof b.name === "string" && b.name.trim() ? b.name.trim() : "this creator";
  const handle = typeof b.handle === "string" ? b.handle.replace(/^@/, "") : "";
  const bio = typeof b.bio === "string" ? b.bio.trim().slice(0, 400) : "";
  const angle = typeof b.angle === "string" ? b.angle : "launch";
  const platform = b.platform === "reels" ? "Instagram Reels" : b.platform === "shorts" ? "YouTube Shorts" : "TikTok";
  const categories = cleanArr(b.categories).slice(0, 8);
  const summaries = cleanArr(b.summaries).slice(0, 6);
  const campaign = b.campaign && typeof b.campaign.title === "string" ? b.campaign.title : "";
  const isNew = Boolean(b.isNew);

  return `Write the post caption and hashtags for a ${platform} video promoting ONE creator. This is the text that goes in the post to make it go viral and send people to the creator.

Caption rules:
- First line is a scroll stopping hook: curiosity, emotion, or FOMO. It has to earn the tap.
- 2 to 4 short punchy lines total. First person, the creator talking to their people.
- End with a light call to follow or come see more. You may mention Spotlightly once, naturally.
- A few tasteful emojis are fine (this is social copy). Do not overdo it.
- No em dashes and no hyphens. Keep any prices as symbols like $9.99, never spelled out.
- Grounded in THIS creator below, a stranger must not be swappable in.
${isNew ? "- This creator is new. Lean aspirational: get in early, this is the beginning, be one of the first. Do not invent specifics." : ""}

Hashtags:
- 12 to 15 tags. Mix a few big reach tags with niche tags pulled from THIS creator's actual content.
- One word each, no spaces, lowercase, no hyphens. Commercial safe, nothing banned or shadowbanned.

Creator: ${name}${handle ? ` (@${handle})` : ""}
What they do: ${categories.join(", ") || "unknown"}
In their content: ${summaries.join(" | ") || "unknown"}
Bio: ${bio || "none"}
${campaign ? `Campaign: ${campaign}` : ""}
Angle: ${angle}

Return ONLY JSON: {"description":"the caption text","hashtags":["#tag", ...]}. No prose, no markdown.`;
};

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);
  if (!ANTHROPIC_API_KEY) return NextResponse.json({ description: "", hashtags: [], configured: false });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        messages: [{ role: "user", content: buildPrompt(body) }],
      }),
    });
    if (!res.ok) return NextResponse.json({ description: "", hashtags: [], configured: true });
    const data = await res.json();
    const text: string = data?.content?.find((c: any) => c.type === "text")?.text ?? "";
    let _raw = text.replace(/```json|```/g, "").trim();
    const _s = _raw.indexOf("{"); const _e = _raw.lastIndexOf("}");
    if (_s >= 0 && _e > _s) _raw = _raw.slice(_s, _e + 1);
    const parsed = JSON.parse(_raw);
    let description = typeof parsed?.description === "string" ? parsed.description.trim() : "";
    description = description.replace(/\s*[—–-]\s*/g, ", ").slice(0, 600);
    const hashtags = cleanArr(parsed?.hashtags)
      .map((t) => {
        let s = t.replace(/[^A-Za-z0-9#]/g, "").toLowerCase();
        if (s && !s.startsWith("#")) s = "#" + s;
        return s;
      })
      .filter((t) => t.length > 1)
      .slice(0, 15);
    return NextResponse.json({ description, hashtags, configured: true });
  } catch {
    return NextResponse.json({ description: "", hashtags: [], configured: true });
  }
}
