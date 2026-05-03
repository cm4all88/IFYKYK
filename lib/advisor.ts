import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Spotlightly's creator monetization strategist. Help creators identify their best conversion moments and build personalized monetization strategies.

Spotlightly charges creators a flat monthly fee (Starter $29/mo â†’ Legend $3,499/mo) and takes 0% of their earnings. The advisor helps creators understand their warm moments â€” the specific times when fans are most likely to subscribe.

Be warm, direct, and specific. Never give generic advice. Always tailor recommendations to the creator's exact situation.`;

export async function streamAdvisorResponse(
  messages: Anthropic.MessageParam[],
  onChunk: (text: string) => void
) {
  const stream = await client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    messages,
  });

  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      onChunk(chunk.delta.text);
    }
  }

  return stream.finalMessage();
}

export async function moderateChatMessage(
  message: string,
  context: { creatorType: "opening_act" | "spotlight" | "backstage" }
): Promise<{ allowed: boolean; reason?: string }> {
  const strictness = {
    opening_act: "Maximum. Block any inappropriate language, adult references, requests for personal info, or off-platform contact.",
    spotlight: "Standard. Block sexual content, harassment, slurs, threats, and PII requests.",
    backstage: "Permissive. Block slurs, threats, doxxing attempts, and direct harassment only.",
  }[context.creatorType];

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    system: `You are a content moderator for a creator platform. Strictness: ${strictness}
    
Respond with JSON only: { "allowed": boolean, "reason": "string or null" }`,
    messages: [{ role: "user", content: `Review this chat message: "${message}"` }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    return JSON.parse(text);
  } catch {
    return { allowed: true };
  }
}
