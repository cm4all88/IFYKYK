import { NextRequest, NextResponse } from "next/server";
import { getSecrets } from "@/lib/settings";

const SYSTEM = `You are the Spotlightly onboarding advisor — warm, direct, specific. You help new creators understand how Spotlightly works for their situation during signup.

When a creator first signs up, you:
1. Ask what kind of content they make (if not already known)
2. Pick the 3–5 most relevant Spotlightly features for their niche, with realistic dollar amounts
3. Keep it brief — they're in the middle of signing up

SPOTLIGHTLY FEATURES:
- Subscriptions: Fans pay creators directly. Platform takes 0% — only charges creator a flat monthly fee ($29–$3,499/mo). 30-day free trial.
- Super Tips: Highlighted fan tips. Platform keeps 15%. Fan gets gold badge and Top Supporter status for 30 days.
- Locked Posts: One-time price to unlock a specific post. Great for tutorials, templates, exclusive content.
- Campaigns: Creator fundraising with a goal. Great for equipment, projects, albums.
- Live Streaming: Built-in. Fans with subscriptions watch live.
- Merch: Upload a design. Loudcap handles printing and worldwide shipping.
- Backstage: Optional adult content profile. Completely separate from main profile unless creator links them.

BILLING: Starter $29/mo (0-100 subs) · Growth $79/mo (101-500) · Pro $249/mo (501-2500) · Scale $749/mo (2501-10k)

TONE: Warm, smart friend — not a FAQ page. Give real numbers. Keep responses short — 3-4 sentences max during signup.`;

export async function POST(req: NextRequest) {
  try {
    const { messages, backstageChoice } = await req.json();

    const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({
        response: "Welcome to Spotlightly! Tell me what kind of content you make and I'll show you exactly how to monetize it here.",
      });
    }

    const isFirst = !messages || messages.length === 0;
    const context = backstageChoice === "with_backstage"
      ? "This creator is setting up both a Spotlight and Backstage profile."
      : "This creator is setting up a Spotlight profile.";

    const anthropicMessages = isFirst
      ? [{ role: "user" as const, content: `${context} Greet them warmly and ask what kind of content they make.` }]
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
        max_tokens: 300,
        system: SYSTEM,
        messages: anthropicMessages,
      }),
    });

    if (!res.ok) return NextResponse.json({ response: "Tell me what you create and I'll map out how Spotlightly works for you." });
    const data = await res.json();
    return NextResponse.json({ response: data.content?.[0]?.text ?? "Tell me about your content!" });
  } catch (e: any) {
    return NextResponse.json({ response: "Tell me what kind of content you make and I'll show you how Spotlightly works for you." });
  }
}
