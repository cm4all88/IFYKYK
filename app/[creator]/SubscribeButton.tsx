import { createClient } from "@/lib/supabase-server";
import { hasSecret } from "@/lib/settings";
import { isCreatorProfileLocked } from "@/lib/billing";
import TierPicker from "./TierPicker";

// Subscribe section: renders the real subscription tiers when the creator has
// any, otherwise a subscribe / sign-up call to action. Shared by the standard
// creator page and the campaign-first page so both behave identically.
export default async function SubscribeButton({ creatorProfileId }: { creatorProfileId: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const stripeReady = await hasSecret("STRIPE_SECRET_KEY");

  if (await isCreatorProfileLocked(supabase, creatorProfileId)) {
    return <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center" }}>This creator is currently unavailable.</p>;
  }

  // Load tiers
  const { data: tiers } = await (supabase as any)
    .from("subscription_tiers")
    .select("*")
    .eq("creator_profile_id", creatorProfileId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const activeTiers = tiers ?? [];

  // Has tiers — show the tier cards (logged in or out)
  if (activeTiers.length > 0) {
    return <TierPicker tiers={activeTiers} creatorProfileId={creatorProfileId} stripeReady={stripeReady} loggedIn={!!user} />;
  }

  // No tiers, not signed in — signup CTA
  if (!user) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <a href={`/fan-signup?return=${encodeURIComponent(`/?subscribe=${creatorProfileId}`)}`} className="btn btn--primary">
          Sign up to subscribe
        </a>
        <a href="/login" style={{ textAlign:"center", fontSize:12, color:"var(--muted)", textDecoration:"none" }}>
          Already have an account? Sign in
        </a>
      </div>
    );
  }

  // No tiers, signed in — simple subscribe button
  return (
    <form action="/api/subscribe" method="post">
      <input type="hidden" name="creator_profile_id" value={creatorProfileId} />
      <button type="submit" className="btn btn--primary" disabled={!stripeReady}>
        Subscribe
      </button>
    </form>
  );
}
