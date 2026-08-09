import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";
import { bunnySignUrl } from "@/lib/bunny";
import { loadFeedUrls } from "@/lib/videoStudioFeed";
import { writeOrLog } from "@/lib/db";

export const dynamic = "force-dynamic";
// Vision on many images can run long; give it room so it doesn't time out and return an
// empty body (which the client then can't parse). Analysis is cached, so later runs are fast.
export const maxDuration = 60;

const signImg = (u?: string | null): string | undefined => {
  if (!u) return undefined;
  return /\.b-cdn\.net\//i.test(u) ? bunnySignUrl(u, 86400) : u;
};

const TONES = ["hard_work", "stress", "hopeful", "proud", "calm", "tired", "joyful", "focused", "frustrated", "grateful", "excited"];
const BEATS = ["hook", "problem", "work", "solution", "result", "morning", "closing", "reflection", "community", "product", "campaign", "membership", "marketplace", "merch", "cta"];

const PROMPT = `You are tagging one of a creator's real photos so a short vertical video can match the right image to the right story beat. Judge the emotional and narrative meaning of the image, not just the objects in it.

Return ONLY a JSON object, no prose, no markdown, with exactly these keys:
- primary_category: short string (e.g. "trailer repairs", "counting cash", "making coffee", "smiling customer")
- secondary_categories: array of short strings
- emotional_tone: one of ${TONES.join(", ")}
- story_beats: array, a subset of ${BEATS.join(", ")} that this image would support
- visual_summary: one short sentence describing what is happening
- recommended_use: one short phrase on where in a story this fits
- confidence_score: number from 0 to 1`;

interface Tags {
  url?: string;
  primary_category?: string;
  secondary_categories?: string[];
  emotional_tone?: string;
  story_beats?: string[];
  visual_summary?: string;
  recommended_use?: string;
  confidence_score?: number;
}

const coerce = (raw: any): Tags | null => {
  if (!raw || typeof raw !== "object") return null;
  const arr = (v: any): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  const conf = Number(raw.confidence_score);
  return {
    primary_category: typeof raw.primary_category === "string" ? raw.primary_category : undefined,
    secondary_categories: arr(raw.secondary_categories),
    emotional_tone: typeof raw.emotional_tone === "string" ? raw.emotional_tone : undefined,
    story_beats: arr(raw.story_beats).filter((b) => BEATS.includes(b)),
    visual_summary: typeof raw.visual_summary === "string" ? raw.visual_summary : undefined,
    recommended_use: typeof raw.recommended_use === "string" ? raw.recommended_use : undefined,
    confidence_score: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.5,
  };
};

async function analyzeImage(url: string, key: string): Promise<Tags | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "url", url } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.content?.find((c: any) => c.type === "text")?.text ?? "";
    const clean = text.replace(/```json|```/g, "").trim();
    return coerce(JSON.parse(clean));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const { creatorId } = await req.json().catch(() => ({}));
  if (!creatorId) return NextResponse.json({ error: "Missing creatorId" }, { status: 400 });

  const supabase = (await createServiceClient()) as any;
  const feed = await loadFeedUrls(supabase, creatorId);
  if (!feed.length) {
    return NextResponse.json({ analyses: [], analyzed: 0, cached: 0, failed: 0, total: 0, configured: true });
  }

  const { data: cachedRows } = await supabase
    .from("creator_media_analysis")
    .select("media_url, analysis_json")
    .in("media_url", feed);
  const byUrl: Record<string, Tags> = {};
  for (const r of cachedRows ?? []) byUrl[r.media_url] = r.analysis_json as Tags;

  const missing = feed.filter((u) => !byUrl[u]);
  const CAP = 8; // vision calls per click; the rest analyze on the next click (cached in between)
  const toAnalyze = missing.slice(0, CAP);

  const { ANTHROPIC_API_KEY } = await getSecrets(["ANTHROPIC_API_KEY"]);
  let analyzed = 0;
  let failed = 0;

  if (ANTHROPIC_API_KEY && toAnalyze.length) {
    await Promise.all(
      toAnalyze.map(async (raw) => {
        const signed = signImg(raw);
        if (!signed) {
          failed++;
          return;
        }
        const tags = await analyzeImage(signed, ANTHROPIC_API_KEY);
        if (!tags) {
          failed++;
          return;
        }
        tags.url = raw;
        await writeOrLog("admin/video-studio/analyze upsert creator_media_analysis", supabase
          .from("creator_media_analysis")
          .upsert(
            {
              creator_profile_id: creatorId,
              media_url: raw,
              source_type: "post",
              analysis_json: tags,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "media_url" }
          ));
        byUrl[raw] = tags;
        analyzed++;
      })
    );
  }

  const analyses = feed.map((u) => byUrl[u] ?? null);
  return NextResponse.json({
    analyses,
    analyzed,
    cached: feed.length - missing.length,
    failed,
    total: feed.length,
    configured: !!ANTHROPIC_API_KEY,
  });
}
