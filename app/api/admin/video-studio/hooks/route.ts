import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getSecrets } from "@/lib/settings";

export const dynamic = "force-dynamic";

const clean = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : [];

// Brand voice comes straight from the creative brief: warm, specific, creator is the
// hero, curiosity over features, no startup copy, no em dashes or hyphens.
const buildPrompt = (b: any) => {
  const name = typeof b.name === "string" && b.name.trim() ? b.name.trim() : "this creator";
  const bio = typeof b.bio === "string" ? b.bio.trim() : "";
  const angle = typeof b.angle === "string" ? b.angle : "launch";
  const categories = clean(b.categories).slice(0, 8);
  const summaries = clean(b.summaries).slice(0, 6);
  const sells = clean(b.sells).slice(0, 6);
  return `You write the opening line (the "hook") for a short vertical video about ONE specific creator. The hook is the first 3 seconds and has to stop the scroll.

Voice rules, follow every one:
- Warm and specific, like a smart friend who wants them to win. Never corporate, never hype.
- The creator is the hero. Never name or mention the platform.
- Lead with curiosity or emotion, never a feature. Never say subscribe, membership, exclusive, unlock, link in bio, or a price.
- Short. Most lines under 8 words.
- No em dashes and no hyphens anywhere. Use periods or commas.
- Grounded in THIS creator's real work below. A stranger must not be able to swap in any other creator. If the work is about coffee, the hook should feel like coffee.

Creator: ${name}
What they do, from their photos: ${categories.join(", ") || "unknown"}
What is happening in their photos: ${summaries.join(" | ") || "unknown"}
Bio: ${bio || "none"}
They also offer: ${sells.join(", ") || "none"}
Story angle: ${angle}

Return ONLY a JSON array of 6 hook strings, strongest first. No prose, no markdown.`;
};

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ hooks: [], configured: false });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: buildPrompt(body) }],
      }),
    });
    if (!res.ok) return NextResponse.json({ hooks: [], configured: true });
    const data = await res.json();
    const text: string = data?.content?.find((c: any) => c.type === "text")?.text ?? "";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    // Drop anything with an em dash or hyphen to stay on brand, cap length.
    const hooks = clean(parsed)
      .filter((h) => !/[—–-]/.test(h))
      .map((h) => h.slice(0, 90))
      .slice(0, 6);
    return NextResponse.json({ hooks, configured: true });
  } catch {
    return NextResponse.json({ hooks: [], configured: true });
  }
}
