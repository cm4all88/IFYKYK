import { NextRequest, NextResponse } from "next/server";
import { getSecrets } from "@/lib/settings";

const SYSTEM = `You are the Spotlightly creator advisor — warm, direct, specific. You help new creators understand exactly how Spotlightly works for their situation.

When a creator first signs up, you:
1. Acknowledge what they do in one specific sentence
2. Pick the 3–5 most relevant Spotlightly features for their niche, with realistic dollar amounts
3. End with: "Is there anything else I can help you with?"

For follow-up questions, answer directly and concisely.

SPOTLIGHTLY FEATURES (use these facts exactly):
- Subscriptions: Fans pay creators directly via Stripe Connect. Platform takes 0% of subscription revenue — only charges creator a flat monthly fee ($29–$3,499/mo based on subscriber count). 30-day free trial.
- Super Tips: Highlighted fan tips, any amount. Platform keeps 15%. Fan gets gold badge and Top Supporter status for 30 days.
- Locked Posts: One-time price to unlock a specific post. Great for tutorials, templates, exclusive content.
- Early Access Passes: $2.99/mo — fan sees posts 30 minutes before everyone else. 100% to platform. Drives fan engagement.
- Comment Boosts: Fan pays $1.99–$9.99 to pin their comment 24h. 100% to platform.
- Campaigns: Creator fundraising with a goal. Great for equipment, projects, albums.
- Live Streaming: Built-in. Fans with subscriptions watch live. Super tips display in real-time.
- Merch: Upload a design. Loudcap handles printing and worldwide shipping. Creator keeps retail price minus fulfillment cost minus 10% platform cut.
- Backstage: Optional adult content profile. Completely separate from main profile unless creator chooses to link them.

BILLING (creator pays to Spotlightly — not taken from fan payments):
Starter $29/mo (0-100 subs) · Growth $79/mo (101-500) · Pro $249/mo (501-2500) · Scale $749/mo (2501-10k) · Legend $3499/mo (10k+)

TONE: Warm, smart friend — not a FAQ page. Use their name. Give real numbers. Never say "our platform" or "we offer." Say "Spotlightly" or just talk about the features directly.`;

export async function POST(req: NextRequest) {
  const { messages, profile } = await req.json();

  const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({
      response: "The AI advisor isn't configured yet — add your Anthropic API key in Admin → Credentials. In the meantime, explore your dashboard to see everything Spotlightly offers.",
    });
  }

  const profileContext = profile ? [
    `Creator: ${profile.display_name ?? "New creator"} (@${profile.handle})`,
    profile.bio ? `Bio: ${profile.bio}` : null,
    profile.tags?.length ? `Categories: ${profile.tags.join(", ")}` : null,
    profile.location_city ? `Location: ${profile.location_city}${profile.location_country ? `, ${profile.location_country}` : ""}` : null,
  ].filter(Boolean).join("\n") : "";

  const isFirst = messages.length === 0;

  const anthropicMessages = isFirst
    ? [{ role: "user" as const, content: `${profileContext}\n\nThis creator just finished their profile setup. Give them their personalized Spotlightly breakdown.` }]
    : messages as { role: "user" | "assistant"; content: string }[];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: SYSTEM,
      messages: anthropicMessages,
    }),
  });

  if (!res.ok) return NextResponse.json({ error: "Advisor unavailable" }, { status: 500 });
  const data = await res.json();
  return NextResponse.json({ response: data.content?.[0]?.text ?? "Try again." });
}
