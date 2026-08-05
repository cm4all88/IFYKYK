import { NextRequest, NextResponse } from "next/server";
import { requireCreatorSession, isGuardFailure } from "@/lib/ai-guard";
import { getSecrets } from "@/lib/settings";

export const runtime = "nodejs";

const SYSTEM = `You write short, human bios for Spotlightly creator pages. A bio is what a fan reads when they land on the creator's page — it should sound like the creator talking, warm and real, never like marketing.

RULES:
- First person ("I ...").
- 1–2 sentences, under 200 characters each.
- Specific over generic — name the actual thing they do.
- Never use: "passionate about", "content creator", "welcome to my page", "join me on my journey", "living my best life", emojis, or hashtags.
- No hype, no platform-speak. Plain, warm language.
- Lead with what the fan gets by being here, in the creator's own voice.
- Give three options with slightly different angles (one warm, one direct, one with a bit of personality).

Return ONLY a JSON object, no preamble or backticks, exactly:
{"options": ["bio one", "bio two", "bio three"]}`;

export async function POST(req: NextRequest) {
  // Anthropic spend is billed to the platform. Generates a creator bio. No current caller in the codebase; gated rather than deleted in case it is reached dynamically.
  const guard = await requireCreatorSession({ requireProfile: false });
  if (isGuardFailure(guard)) return guard.response;

  try {
    const { displayName, handle, currentBio, tags, kind } = await req.json();

    const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ options: [], error: "The bio writer isn't set up yet." });
    }

    const ctx = [
      displayName ? `Name: ${displayName}` : null,
      handle ? `Handle: ${handle}` : null,
      Array.isArray(tags) && tags.length ? `What they do / niche: ${tags.join(", ")}` : null,
      currentBio && String(currentBio).trim()
        ? `Their current draft (keep their voice, just make it better): "${String(currentBio).trim()}"`
        : "They have no bio yet — write from scratch using the name and niche.",
      kind === "backstage" ? "This is an adult (Backstage) page — keep it tasteful and suggestive at most, never explicit." : null,
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
        max_tokens: 500,
        system: SYSTEM,
        messages: [{ role: "user", content: `Write 3 bio options for this creator.\n\n${ctx}` }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ options: [], error: "Couldn't reach the writer just now — try again." });
    }

    const data = await res.json();
    let raw: string = data.content?.[0]?.text ?? "";
    raw = raw.replace(/```json|```/g, "").trim();

    let options: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.options)) options = parsed.options;
    } catch {
      options = [];
    }
    options = options
      .filter((o) => typeof o === "string" && o.trim())
      .map((o) => o.trim().slice(0, 500))
      .slice(0, 3);

    return NextResponse.json({ options });
  } catch {
    return NextResponse.json({ options: [], error: "Something went wrong — try again." });
  }
}
