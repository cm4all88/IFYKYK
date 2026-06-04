import { createClient } from "@/lib/supabase-server";
import SiteHeader from "@/components/site-header";
import Footer from "@/components/Footer";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your Downloads · Spotlightly" };

export default async function DownloadsPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let newPurchase: any = null;

  // If redirected from a successful checkout, find the purchase
  if (searchParams.session_id) {
    const { data } = await (supabase as any)
      .from("digital_purchases")
      .select("*, product:digital_product_id(title, description, category, thumbnail_url, creator:creator_profile_id(handle, display_name))")
      .eq("stripe_session_id", searchParams.session_id)
      .maybeSingle();
    newPurchase = data;
  }

  // All purchases for this user
  const { data: allPurchases } = user ? await (supabase as any)
    .from("digital_purchases")
    .select("*, product:digital_product_id(title, description, category, thumbnail_url, creator:creator_profile_id(handle, display_name))")
    .eq("fan_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50) : { data: [] };

  const CATEGORY_EMOJI: Record<string, string> = {
    ebook: "📚", preset: "🎨", template: "📊",
    audio: "🎵", course: "🎓", video: "🎬", other: "📦",
  };

  return (
    <>
      <SiteHeader />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px 120px" }}>

        <div style={{ marginBottom: 40 }}>
          <p style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>My downloads</p>
          <h1 style={{ fontFamily: "Georgia,serif", fontSize: 40, fontWeight: 300, color: "#fff", lineHeight: 1.05 }}>
            Your <em style={{ color: "#F0B429" }}>purchases.</em>
          </h1>
        </div>

        {/* New purchase highlight */}
        {newPurchase && (
          <div style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 12, padding: "28px 32px", marginBottom: 32 }}>
            <p style={{ fontFamily: "monospace", fontSize: 9, letterSpacing: ".2em", textTransform: "uppercase", color: "#34D399", marginBottom: 12 }}>✓ Purchase complete</p>
            <h2 style={{ fontFamily: "Georgia,serif", fontSize: 24, fontWeight: 300, color: "#fff", marginBottom: 8 }}>
              {newPurchase.product?.title}
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-soft)", marginBottom: 20, lineHeight: 1.6 }}>
              From <a href={`/${newPurchase.product?.creator?.handle}`} style={{ color: "#F0B429", textDecoration: "none" }}>{newPurchase.product?.creator?.display_name ?? newPurchase.product?.creator?.handle}</a>
            </p>
            <a
              href={`/api/download/${newPurchase.download_token}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#34D399", color: "#09090C", fontWeight: 700, fontSize: 14, padding: "12px 28px", borderRadius: 999, textDecoration: "none" }}
            >
              ⬇ Download now
            </a>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 12 }}>
              Up to {newPurchase.max_downloads} downloads · Link valid for 1 year · A copy was sent to your email
            </p>
          </div>
        )}

        {/* All purchases */}
        {!user ? (
          <div style={{ background: "#111115", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "40px 32px", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 20 }}>Sign in to see all your purchases.</p>
            <Link href="/login?return=/downloads" style={{ display: "inline-block", background: "#F0B429", color: "#09090C", fontWeight: 700, fontSize: 13, padding: "11px 24px", borderRadius: 999, textDecoration: "none" }}>
              Sign in →
            </Link>
          </div>
        ) : !allPurchases?.length && !newPurchase ? (
          <div style={{ background: "#111115", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "40px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>📦</div>
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>No purchases yet.</p>
            <Link href="/explore" style={{ color: "#F0B429", fontSize: 13, textDecoration: "none" }}>Explore creators →</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {(allPurchases ?? []).map((p: any) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 20, background: "#111115", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "18px 24px" }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                  {p.product?.thumbnail_url
                    ? <img src={p.product.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 22 }}>{CATEGORY_EMOJI[p.product?.category] ?? "📦"}</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#F2F2F0", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.product?.title}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <a href={`/${p.product?.creator?.handle}`} style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}>
                      @{p.product?.creator?.handle}
                    </a>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
                      {p.download_count}/{p.max_downloads} downloads used
                    </span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <a
                  href={`/api/download/${p.download_token}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(240,180,41,0.08)", border: "1px solid rgba(240,180,41,0.2)", color: "#F0B429", fontWeight: 700, fontSize: 12, padding: "8px 16px", borderRadius: 999, textDecoration: "none", flexShrink: 0 }}
                >
                  ⬇ Download
                </a>
              </div>
            ))}
          </div>
        )}

      </main>
      <Footer />
    </>
  );
}
