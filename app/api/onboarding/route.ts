import { NextRequest, NextResponse } from "next/server";
import { getSecrets } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const { description, followUp, previousResponse } = await req.json();
  if (!description?.trim()) {
    return NextResponse.json({ error: "Description required" }, { status: 400 });
  }

  const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);
  if (!ANTHROPIC_API_KEY) {
    // Fallback if no API key — return a generic helpful response
    return NextResponse.json({
      greeting: "Welcome to Spotlightly! Here's how to make the most of your page.",
      recommendations: [
        { emoji: "📝", title: "Create your first post", desc: "Share what you do. Free posts build your audience, paid posts build your income." },
        { emoji: "💰", title: "Set a subscription price", desc: "Even $4.99/mo from 100 fans is $500 a month. Start low and grow." },
        { emoji: "💬", title: "Turn on tips", desc: "Fans who love your work will tip. We take 0% — you keep everything." },
        { emoji: "🛍️", title: "Launch merch", desc: "Add branded products via Loudcap. No upfront cost, we handle printing and shipping." },
      ],
      suggestedTags: [],
      suggestedBio: "",
    });
  }

  const systemPrompt = `You are the Spotlightly onboarding advisor. Spotlightly is a creator monetization platform where creators earn through subscriptions, tips, locked posts, live streaming, merch (via Loudcap), and booking links (for service providers like hairdressers, trainers, coaches).

Key features creators can use:
- Subscriptions: fans pay monthly ($4.99–$49.99/mo typically) for exclusive content
- Tips: 0% platform cut, creator keeps all
- Super Tips: fan pays extra for a badge and pinned recognition
- Locked posts: one-time purchase to unlock a specific post
- Live streaming: creators can go live for subscribers
- Merch: branded products via Loudcap (fulfilled by Printful), 10% platform cut
- Booking link: add Calendly/Booksy/Square link → fans book directly from creator page (great for hairdressers, trainers, coaches, photographers, tutors)
- Campaigns: fundraising for projects
- Early Access Pass: fans pay $2.99/mo to see posts 30 minutes early

The platform charges creators a flat monthly fee (not a % of earnings):
- Starter: $29/mo (0–100 subscribers)
- Growth: $79/mo (101–500)
- Pro: $249/mo (501–2,500)
- Scale: $749/mo (2,501–10,000)
- Legend: $3,499/mo (10,001+)

Available creator tags: fitness, music, art, photography, gaming, cooking, comedy, fashion, writing, finance, beauty, sports, tech, lifestyle, travel, podcasting, education, wellness, diy, services

When responding, be warm, specific, and use the creator's actual type/context. Give actionable advice, not generic platitudes.

Respond ONLY with valid JSON in exactly this format (no markdown, no extra text):
{
  "greeting": "2 sentences welcoming them specifically based on what they do",
  "recommendations": [
    { "emoji": "📅", "title": "Short action title", "desc": "1-2 sentences specific to their type" }
  ],
  "suggestedTags": ["tag1", "tag2"],
  "suggestedBio": "A suggested bio starter they can edit — 1-2 sentences in first person",
  "followUpAnswer": "If this is a follow-up question, answer it here. Otherwise empty string."
}

Always return 3-5 recommendations. For service providers (hairdressers, trainers, coaches, photographers, tattoo artists, etc.) always include the booking link recommendation. For musicians always mention live streaming and merch. For fitness creators mention subscriptions + live. Be specific — name their actual profession.`;

  const messages = followUp && previousResponse
    ? [
        { role: "user", content: `I am: ${description}` },
        { role: "assistant", content: JSON.stringify(previousResponse) },
        { role: "user", content: followUp },
      ]
    : [{ role: "user", content: `I am: ${description}` }];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "{}";

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
  }
}
