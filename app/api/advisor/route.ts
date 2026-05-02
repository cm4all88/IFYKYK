import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are Spotlightly's creator monetization strategist. Help creators identify their best conversion moments and build personalized monetization strategies. Be warm, direct, specific. Spotlightly charges a flat monthly fee (Starter $29/mo → Legend $3,499/mo) and takes 0% of earnings.`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const anthropicStream = await client.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          system: SYSTEM,
          messages,
        });

        for await (const chunk of anthropicStream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Advisor API error:", err);
    return Response.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
