import { createClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface Props {
  params: { creator: string };
  searchParams: { channel?: string; offer?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient();
  const { data: creator } = await supabase
    .from("creator_profiles")
    .select("display_name, bio, avatar_url")
    .eq("handle", params.creator)
    .single();

  if (!creator) return { title: "Creator not found" };

  return {
    title: `${creator.display_name} on Spotlightly`,
    description: creator.bio ?? `Subscribe to ${creator.display_name} on Spotlightly`,
    openGraph: {
      title: `${creator.display_name} on Spotlightly`,
      description: creator.bio ?? undefined,
      images: creator.avatar_url ? [creator.avatar_url] : [],
    },
  };
}

export default async function CreatorPage({ params, searchParams }: Props) {
  const supabase = await createClient();

  const { data: creator } = await supabase
    .from("creator_profiles")
    .select(`
      *,
      channels (*),
      posts!posts_creator_id_fkey (id, caption, media_url, tier, likes_count, created_at, channel_id)
    `)
    .eq("handle", params.creator)
    .order("created_at", { referencedTable: "posts", ascending: false })
    .single();

  if (!creator) notFound();

  const activeChannel = searchParams.channel
    ? creator.channels?.find((c) => c.slug === searchParams.channel)
    : null;

  const posts = activeChannel
    ? creator.posts?.filter((p) => p.channel_id === activeChannel.id)
    : creator.posts;

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#f2f0ec" }}>
      <div style={{ height: 240, background: "#181816", position: "relative", overflow: "hidden" }}>
        {creator.cover_url && (
          <img src={creator.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.6 }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(8,8,8,0.9) 100%)" }} />
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ marginTop: -50, marginBottom: 24 }}>
          {creator.avatar_url && (
            <img src={creator.avatar_url} alt={creator.display_name}
              style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "4px solid #080808" }} />
          )}
          <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 12, marginBottom: 4 }}>{creator.display_name}</h1>
          {creator.bio && <p style={{ color: "#888078", fontSize: 15, lineHeight: 1.65, maxWidth: 560 }}>{creator.bio}</p>}
        </div>

        {(creator.channels?.length ?? 0) > 1 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {creator.channels?.map((ch) => (
              <a key={ch.id} href={`/c/${params.creator}?channel=${ch.slug}`}
                style={{
                  padding: "7px 16px", borderRadius: 22,
                  background: activeChannel?.id === ch.id ? "rgba(232,160,48,0.15)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${activeChannel?.id === ch.id ? "rgba(232,160,48,0.4)" : "rgba(255,255,255,0.08)"}`,
                  color: activeChannel?.id === ch.id ? "#e8a030" : "#888078",
                  textDecoration: "none", fontSize: 13, fontWeight: 500,
                }}>
                {ch.name}
              </a>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {posts?.map((post) => (
            <div key={post.id} style={{ borderRadius: 10, overflow: "hidden", aspectRatio: "1", position: "relative", background: "#181816" }}>
              {post.media_url && (
                <img src={post.media_url} alt={post.caption ?? ""}
                  style={{ width: "100%", height: "100%", objectFit: "cover", filter: post.tier === "premium" ? "blur(10px) brightness(0.5)" : "none" }} />
              )}
              {post.tier === "premium" && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 24 }}>LOCKED</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}