import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const ALWAYS_REMOVE = ["nigger","nigga","faggot","cunt","kike","spic","chink"];

const LEVEL_PROMPTS: Record<string, string> = {
  strict: "Flag profanity, insults, sexual language, threats, and spam.",
  moderate: "Flag threats, harassment, spam, and extreme profanity. Allow mild language.",
  open: "Only flag threats, illegal content, and spam.",
};

async function moderateMessage(
  message: string, level: string, bannedWords: string[], isBackstage: boolean
): Promise<{ allowed: boolean; cleaned: string; reason?: string }> {
  let cleaned = message;
  const allBanned = [...ALWAYS_REMOVE, ...bannedWords];
  for (const word of allBanned) {
    const re = new RegExp(`\\b${word}\\b`, "gi");
    cleaned = cleaned.replace(re, "***");
  }

  if (isBackstage && level === "open") return { allowed: true, cleaned };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { allowed: true, cleaned };

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
        max_tokens: 80,
        messages: [{ role: "user", content: `Chat moderation. Level: ${level}. ${isBackstage ? "Adult platform." : "SFW only."}\nRules: ${LEVEL_PROMPTS[level] || LEVEL_PROMPTS.moderate}\nMessage: "${cleaned}"\nReply ONLY with JSON: {"allowed":true} or {"allowed":false,"reason":"word"}` }],
      }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text ?? "{}";
    const result = JSON.parse(text.replace(/```json|```/g, "").trim());
    return { allowed: result.allowed ?? true, cleaned, reason: result.reason };
  } catch {
    return { allowed: true, cleaned };
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Must be logged in to chat" }, { status: 401 });

  const { streamId, message, displayName } = await req.json();
  if (!streamId || !message?.trim()) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { data: stream } = await (supabase as any)
    .from("live_streams")
    .select("id, creator_profile_id, creator_profiles(kind)")
    .eq("id", streamId)
    .eq("status", "live")
    .maybeSingle();

  if (!stream) return NextResponse.json({ error: "Stream not found or ended" }, { status: 404 });

  const isBackstage = stream.creator_profiles?.kind === "backstage";

  const { data: prefs } = await (supabase as any)
    .from("stream_moderation_prefs")
    .select("*")
    .eq("creator_profile_id", stream.creator_profile_id)
    .maybeSingle();

  const level = prefs?.moderation_level ?? "moderate";
  const bannedWords = prefs?.banned_words ?? [];

  if (prefs?.slow_mode_seconds > 0) {
    const since = new Date(Date.now() - prefs.slow_mode_seconds * 1000).toISOString();
    const { count } = await (supabase as any)
      .from("live_chat_messages")
      .select("id", { count: "exact" })
      .eq("stream_id", streamId)
      .eq("user_id", user.id)
      .gte("created_at", since);
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: `Slow mode — wait ${prefs.slow_mode_seconds}s` }, { status: 429 });
    }
  }

  const { allowed, cleaned, reason } = await Promise.race([
    moderateMessage(message.trim(), level, bannedWords, isBackstage),
    new Promise<{ allowed: boolean; cleaned: string }>(resolve =>
      setTimeout(() => resolve({ allowed: true, cleaned: message.trim() }), 3000)
    ),
  ]);

  if (!allowed) return NextResponse.json({ error: `Message blocked: ${reason || "content policy"}` }, { status: 422 });

  const { data, error } = await (supabase as any)
    .from("live_chat_messages")
    .insert({
      stream_id: streamId,
      user_id: user.id,
      display_name: displayName?.trim() || "Audience",
      message: cleaned,
      moderated: cleaned !== message.trim(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const streamId = req.nextUrl.searchParams.get("streamId");
  if (!streamId) return NextResponse.json({ error: "Missing streamId" }, { status: 400 });

  const { data, error } = await (supabase as any)
    .from("live_chat_messages")
    .select("*")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}
