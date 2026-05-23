"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import Link from "next/link";

export default function AccountPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [unlocks, setUnlocks] = useState<any[]>([]);
  const [earlyAccess, setEarlyAccess] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      setUser(user);

      const [{ data: subs }, { data: unlock }, { data: ea }] = await Promise.all([
        (supabase as any).from("subscriptions").select("id, status, created_at, stripe_subscription_id, creator:creator_profile_id(handle, display_name, avatar_url)").eq("fan_user_id", user.id).in("status", ["active", "cancelling"]).order("created_at", { ascending: false }),
        (supabase as any).from("post_unlocks").select("id, created_at, post:post_id(caption, creator:creator_profile_id(handle, display_name))").eq("fan_user_id", user.id).order("created_at", { ascending: false }).limit(20),
        (supabase as any).from("early_access_passes").select("id, status, creator:creator_profile_id(handle, display_name, avatar_url)").eq("fan_user_id", user.id).eq("status", "active"),
      ]);

      setSubscriptions(subs ?? []);
      setUnlocks(unlock ?? []);
      setEarlyAccess(ea ?? []);
      setLoading(false);
    });
  }, []);

  async function cancelSubscription(id: string) {
    if (!confirm("Cancel this subscription? You'll keep access until the end of your billing period.")) return;
    setCancelling(id);
    const res = await fetch("/api/subscription/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId: id }),
    });
    if (res.ok) {
      setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, status: "cancelling" } : s));
    }
    setCancelling(null);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) return (
    <main style={{ minHeight:"100vh", background:"#09090C", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <p style={{ color:"rgba(255,255,255,0.3)", fontFamily:"monospace", fontSize:13 }}>Loading…</p>
    </main>
  );

  return (
    <main style={{ minHeight:"100vh", background:"#09090C" }}>
      {/* Simple header */}
      <header style={{ borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <Link href="/" style={{ fontFamily:"Georgia,serif", fontSize:20, color:"#fff", textDecoration:"none" }}>
          Spot<span style={{ color:"#F0B429" }}>light</span>ly
        </Link>
        <div style={{ display:"flex", gap:16, alignItems:"center" }}>
          <Link href="/explore" style={{ fontSize:13, color:"rgba(255,255,255,0.5)", textDecoration:"none" }}>Explore</Link>
          <button onClick={signOut} style={{ fontSize:13, color:"rgba(248,113,113,0.7)", background:"none", border:"none", cursor:"pointer" }}>Sign out</button>
        </div>
      </header>

      <div style={{ maxWidth:680, margin:"0 auto", padding:"48px 24px 100px" }}>
        <div style={{ marginBottom:40 }}>
          <p style={{ fontFamily:"monospace", fontSize:10, letterSpacing:".2em", textTransform:"uppercase", color:"rgba(255,255,255,0.25)", marginBottom:8 }}>Fan account</p>
          <h1 style={{ fontFamily:"Georgia,serif", fontSize:40, fontWeight:300, color:"#fff", lineHeight:1.05 }}>
            Your <em style={{ color:"#F0B429" }}>subscriptions.</em>
          </h1>
        </div>

        {/* Subscriptions */}
        <section style={{ marginBottom:40 }}>
          <p style={{ fontFamily:"monospace", fontSize:10, letterSpacing:".15em", textTransform:"uppercase", color:"rgba(255,255,255,0.25)", marginBottom:14 }}>
            Active subscriptions ({subscriptions.length})
          </p>
          {subscriptions.length === 0 ? (
            <div style={{ background:"#111115", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"28px 24px", textAlign:"center" }}>
              <p style={{ fontSize:14, color:"rgba(255,255,255,0.3)", marginBottom:12 }}>You haven&apos;t subscribed to anyone yet.</p>
              <Link href="/explore" style={{ color:"#F0B429", fontSize:13, textDecoration:"none" }}>Explore creators →</Link>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {subscriptions.map(s => (
                <div key={s.id} style={{ display:"flex", alignItems:"center", gap:14, background:"#111115", border:`1px solid ${s.status === "cancelling" ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.07)"}`, borderRadius:8, padding:"14px 18px" }}>
                  <div style={{ width:40, height:40, borderRadius:"50%", background:"rgba(255,255,255,0.06)", overflow:"hidden", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {s.creator?.avatar_url
                      ? <img src={s.creator.avatar_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      : <span style={{ fontFamily:"Georgia,serif", fontSize:16, color:"#F0B429" }}>{(s.creator?.display_name ?? s.creator?.handle ?? "?").charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:14, fontWeight:600, color:"#F2F2F0", marginBottom:2 }}>{s.creator?.display_name ?? s.creator?.handle}</p>
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>@{s.creator?.handle}</p>
                  </div>
                  {s.status === "cancelling" ? (
                    <span style={{ fontSize:11, color:"rgba(248,113,113,0.7)", fontFamily:"monospace", letterSpacing:".08em" }}>Cancels at period end</span>
                  ) : (
                    <button
                      onClick={() => cancelSubscription(s.id)}
                      disabled={cancelling === s.id}
                      style={{ fontSize:12, color:"rgba(248,113,113,0.6)", background:"none", border:"1px solid rgba(248,113,113,0.2)", borderRadius:99, padding:"5px 12px", cursor:"pointer" }}
                    >
                      {cancelling === s.id ? "…" : "Cancel"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Early access */}
        {earlyAccess.length > 0 && (
          <section style={{ marginBottom:40 }}>
            <p style={{ fontFamily:"monospace", fontSize:10, letterSpacing:".15em", textTransform:"uppercase", color:"rgba(255,255,255,0.25)", marginBottom:14 }}>
              Early access passes ({earlyAccess.length})
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {earlyAccess.map(e => (
                <Link key={e.id} href={`/${e.creator?.handle}`} style={{ display:"flex", alignItems:"center", gap:14, background:"#111115", border:"1px solid rgba(240,180,41,0.15)", borderRadius:8, padding:"14px 18px", textDecoration:"none" }}>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:14, fontWeight:600, color:"#F2F2F0", marginBottom:2 }}>{e.creator?.display_name ?? e.creator?.handle}</p>
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>See posts 30 minutes early</p>
                  </div>
                  <span style={{ fontFamily:"monospace", fontSize:10, color:"#F0B429", background:"rgba(240,180,41,0.08)", border:"1px solid rgba(240,180,41,0.2)", padding:"3px 10px", borderRadius:99 }}>Early Access</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Unlocked posts */}
        {unlocks.length > 0 && (
          <section style={{ marginBottom:40 }}>
            <p style={{ fontFamily:"monospace", fontSize:10, letterSpacing:".15em", textTransform:"uppercase", color:"rgba(255,255,255,0.25)", marginBottom:14 }}>
              Unlocked posts ({unlocks.length})
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {unlocks.map(u => (
                <Link key={u.id} href={`/${u.post?.creator?.handle}`} style={{ display:"flex", alignItems:"center", gap:14, background:"#111115", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"14px 18px", textDecoration:"none" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginBottom:3 }}>@{u.post?.creator?.handle}</p>
                    <p style={{ fontSize:13, color:"#F2F2F0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.post?.caption?.slice(0, 80) ?? "Unlocked post"}</p>
                  </div>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.25)", flexShrink:0 }}>{new Date(u.created_at).toLocaleDateString()}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Account info */}
        <section style={{ borderTop:"1px solid rgba(255,255,255,0.07)", paddingTop:28 }}>
          <p style={{ fontFamily:"monospace", fontSize:10, letterSpacing:".15em", textTransform:"uppercase", color:"rgba(255,255,255,0.25)", marginBottom:14 }}>Account</p>
          <div style={{ background:"#111115", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"16px 20px", marginBottom:2 }}>
            <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginBottom:4 }}>Signed in as</p>
            <p style={{ fontSize:14, color:"#F2F2F0" }}>{user?.email}</p>
          </div>
          <button onClick={signOut} style={{ width:"100%", textAlign:"left", background:"#111115", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"16px 20px", color:"rgba(248,113,113,0.7)", fontSize:14, cursor:"pointer" }}>
            Sign out
          </button>
        </section>
      </div>
    </main>
  );
}
