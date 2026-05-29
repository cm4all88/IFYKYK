import { NextRequest, NextResponse } from "next/server";
import { getSecrets } from "@/lib/settings";

const SYSTEM = `You are the Spotlightly signup advisor. Your job is to have a short, warm conversation that collects exactly three things: what they create, their display name, and their desired handle. Then give them a quick personalized breakdown.

CONVERSATION FLOW — follow this order:
1. First response: Ask what kind of content they make.
2. After they answer: Ask "What name do you want on your profile? (This is what fans see)"
3. After they give their name: Suggest a handle based on their name/content and confirm it. Say something like "How about @[suggestion] — that becomes spotlightly.app/c/[suggestion]. Want to use that or something different?"
4. After handle is confirmed: Give a 3-sentence personalized breakdown of the top 2-3 Spotlightly features for their niche with real dollar amounts. End with "You're all set — hit Continue to claim your handle."

HANDLE RULES: lowercase, no spaces, use hyphens not underscores, 3-20 chars. Suggest something short and memorable based on their name or content type.

SPOTLIGHTLY FACTS:
- Subscriptions: fans pay creators directly, platform takes 0% (charges creator flat $29-$3,499/mo fee)
- Locked Posts: one-time unlock price, great for tutorials and templates
- Merch: Loudcap handles printing/shipping, creator sets markup
- Super Tips: fans tip with gold badge recognition, platform keeps 15%
- Live Streaming: built-in, free subscribers watch live

TONE: Warm and fast. Short responses. No bullet lists in steps 1-3 — save those for step 4.

CRITICAL: At the END of every response, on its own line, include a JSON block exactly like this (update fields as you learn them, use null if not known yet):
[[EXTRACTED:{"displayName":null,"suggestedHandle":null}]]

Example when you know both:
[[EXTRACTED:{"displayName":"Chris Martin","suggestedHandle":"chrisart"}]]`;

export async function POST(req: NextRequest) {
  try {
    const { messages, backstageChoice } = await req.json();

    const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({
        response: "What kind of content do you create?",
        extracted: { displayName: null, suggestedHandle: null },
      });
    }

    const isFirst = !messages || messages.length === 0;
    const context = backstageChoice === "with_backstage"
      ? "This creator is setting up both Spotlight and Backstage profiles."
      : "This creator is setting up a Spotlight profile.";

    const anthropicMessages = isFirst
      ? [{ role: "user" as const, content: `${context} Start the conversation.` }]
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
        max_tokens: 400,
        system: SYSTEM,
        messages: anthropicMessages,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({
        response: "What kind of content do you create?",
        extracted: { displayName: null, suggestedHandle: null },
      });
    }

    const data = await res.json();
    const raw: string = data.content?.[0]?.text ?? "";

    // Extract the structured data block
    const match = raw.match(/\[\[EXTRACTED:(.*?)\]\]/s);
    let extracted = { displayName: null as string | null, suggestedHandle: null as string | null };
    if (match) {
      try { extracted = JSON.parse(match[1]); } catch { /* ignore */ }
    }

    // Strip the marker from the visible response
    const response = raw.replace(/\n?\[\[EXTRACTED:.*?\]\]/s, "").trim();

    return NextResponse.json({ response, extracted });
  } catch (e: any) {
    return NextResponse.json({
      response: "What kind of content do you create?",
      extracted: { displayName: null, suggestedHandle: null },
    });
  }
}
