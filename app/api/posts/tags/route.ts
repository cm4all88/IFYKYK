import { NextRequest, NextResponse } from "next/server";
import { requireCreatorSession, isGuardFailure } from "@/lib/ai-guard";

export const runtime = "nodejs";
const COMMON_TAGS = [
  "fitness","music","art","photography","fashion","food","travel",
  "education","comedy","gaming","beauty","lifestyle","business",
  "technology","sports","wellness","cooking","podcast","vlog","tutorial",
];

export async function POST(req: NextRequest) {
  // Anthropic spend is billed to the platform. Reached from the creator dashboard composer.
  const guard = await requireCreatorSession({ requireProfile: true });
  if (isGuardFailure(guard)) return guard.response;

  const { caption, mediaType } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !caption?.trim()) {
    // Return common tags as fallback
    return NextResponse.json({ tags: COMMON_TAGS.slice(0, 8) });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: `Suggest 5 relevant tags for this creator post. Tags should be single words or short phrases, lowercase, no hashtags.

Post caption: "${caption.slice(0, 300)}"
Media type: ${mediaType || "text"}

Reply ONLY with JSON array: ["tag1", "tag2", "tag3", "tag4", "tag5"]`,
        }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "[]";
    const tags = JSON.parse(text.replace(/```json|```/g, "").trim());
    return NextResponse.json({ tags: Array.isArray(tags) ? tags.slice(0, 8) : COMMON_TAGS.slice(0, 8) });
  } catch {
    return NextResponse.json({ tags: COMMON_TAGS.slice(0, 8) });
  }
}
