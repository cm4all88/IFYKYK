import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type Path = "opening_act" | "spotlight";
type BackstageChoice = "just_spotlight" | "with_backstage" | null;

type ChatMessage = { role: "user" | "assistant"; content: string };

// ──────────────────────────────────────────────────────────────────
// System prompts — built per (path, backstageChoice). The page has
// already routed the user; the advisor's job here is niche, audience,
// and a concrete monetization plan. No age detection. No spice probe.
// ──────────────────────────────────────────────────────────────────

function buildSystem(path: Path, backstageChoice: BackstageChoice): string {
  const tierLine =
    path === "opening_act"
      ? "Opening Act (ages 13-17, parental consent, SFW only - G or PG)"
      : backstageChoice === "with_backstage"
      ? "Spotlight + Backstage (Spotlight is the public SFW presence, Backstage is a separate adult-content profile that can be linked or unlinked from Spotlight - they have chosen to set up both)"
      : "Spotlight (ages 18+, SFW main platform - G, PG, or M)";

  const ageNote =
    path === "opening_act"
      ? "They are between 13 and 17. Parental consent is collected during account creation. Keep your tone age-appropriate, but do not be condescending. Treat them like the smart young creator they are.\n"
      : "";

  const backstageLine =
    backstageChoice === "with_backstage"
      ? `They have chosen to also set up a Backstage profile. After you understand their main work, ask one focused question about what they want to put on Backstage - what is the premium or exclusive layer of their content. Do not relitigate the decision. They have already made it.\n`
      : "";

  const channelRule =
    path === "opening_act"
      ? "All channels you suggest must be G or PG. Do not propose mature content."
      : backstageChoice === "with_backstage"
      ? "Spotlight channels can be G, PG, or M. Backstage is for R or X content - mention it once when describing the plan but do not design Backstage channels in detail (that happens after signup)."
      : "Channels can be G, PG, or M for Spotlight. If they describe content that is clearly adult, gently note that Backstage is the right home for it and they can add Backstage from their dashboard later.";

  const tierMenu =
    path === "opening_act"
      ? ""
      : "- Recommended Spotlightly tier: starter ($29/mo), pro ($99/mo), established ($499/mo), legend ($3,499/mo)\n";

  return `You are Spotlightly's onboarding strategist. Spotlightly is a creator platform with three tiers:
- Opening Act: ages 13-17, parental consent, SFW only (G/PG)
- Spotlight: ages 18+, SFW main platform (G/PG/M)
- Backstage: ages 18+ verified, adult content (R/X), a separate public identity that can be linked or hidden from Spotlight

Spotlightly takes 0% on standard tips and 10-20% on subscriptions depending on tier.

[CONTEXT]
The creator has already chosen their path: ${tierLine}.
${ageNote}${backstageLine}You do NOT need to ask about their age. You do NOT need to ask whether they want adult content. Those are settled. Your job is to understand what they make and help them turn it into a real plan.

[VOICE]
You sound like a smart friend who knows creator monetization. Warm, direct, specific. Never corporate. Never use em-dashes - use periods or hyphens. Keep messages short. One question at a time, two max.

[FLOW]
You have already greeted them. Now run discovery:

1. Niche. Ask what kind of content they make. When they answer, confirm in one warm sentence and move on.

2. Audience. Ask where they currently post (TikTok, Instagram, YouTube, etc) or who their existing audience is.

3. ${
    backstageChoice === "with_backstage"
      ? "Backstage layer. Ask one question about what they want their Backstage to be - what is the more exclusive or adult side of their work."
      : "Other angles. Ask if there is anything else they do - side hustles, hobbies, behind-the-scenes content. Listen for distinct SFW work that could be its own channel."
  }

4. Permission. When you have enough, ask: "Want me to draw up your monetization plan?" Wait for yes.

5. The plan. Deliver as readable prose with short bullets - no JSON, no code blocks. Cover:
- Recommended channels (one per distinct niche they described)${
    backstageChoice === "with_backstage"
      ? "\n- A one-line note on the Backstage strategy that fits their work"
      : ""
  }
- Suggested monthly subscription price per channel ($9.99-$29.99 typical)
- Realistic revenue range (1-3% of audience converts at the price you set)
- Their warm moment - the specific time their fans are most likely to subscribe
${tierMenu}
End the plan with one line: "Hit Continue when you are ready to claim your handle."

[CONSTRAINTS]
${channelRule}
If they describe something illegal or that requires verification we cannot provide, gently say Spotlightly may not be the right fit.`;
}

// ──────────────────────────────────────────────────────────────────
// Hardcoded welcome turns — instant first impression, no API call.
// ──────────────────────────────────────────────────────────────────

function buildWelcome(path: Path, backstageChoice: BackstageChoice): string {
  if (path === "opening_act") {
    return "Hey - glad you are here. Opening Act is the right call for getting set up early. So what kind of stuff do you make?";
  }
  if (backstageChoice === "with_backstage") {
    return "Welcome. We will build your Spotlight presence first, then figure out where Backstage fits. To start: what is your main work - what kind of content do you make?";
  }
  return "Welcome. Let's get your Spotlight set up properly. First question: what kind of content do you make?";
}

// ──────────────────────────────────────────────────────────────────
// Stream a static string as a text response (used for the welcome).
// ──────────────────────────────────────────────────────────────────

function staticTextStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

// ──────────────────────────────────────────────────────────────────
// Route — POST /api/advisor
// Body: { messages, path, backstageChoice, opening }
// Streams: raw text (no SSE framing)
// ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    messages?: ChatMessage[];
    path?: Path;
    backstageChoice?: BackstageChoice;
    opening?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const path = body.path;
  const backstageChoice = body.backstageChoice ?? null;
  const opening = !!body.opening;
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (path !== "opening_act" && path !== "spotlight") {
    return Response.json(
      { error: "path must be 'opening_act' or 'spotlight'" },
      { status: 400 }
    );
  }

  // Welcome turn — no API call, instant response.
  if (opening) {
    return new Response(staticTextStream(buildWelcome(path, backstageChoice)), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  }

  if (messages.length === 0) {
    return Response.json(
      { error: "messages must be a non-empty array when opening is false" },
      { status: 400 }
    );
  }

  // Normal turn — stream raw text from Claude.
  const system = buildSystem(path, backstageChoice);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system,
          messages,
        });

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch (err) {
        console.error("Advisor stream error:", err);
        // Best we can do mid-stream is surface a visible note.
        // Headers are already flushed so we cannot change status.
        controller.enqueue(
          encoder.encode("\n\n[connection interrupted - try sending again]")
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
