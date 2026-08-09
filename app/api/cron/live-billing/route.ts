import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LIVE_FREE_SECONDS, liveIncrementCents } from "@/lib/fees";
import { writeOrLog } from "@/lib/db";

// Runs every 15 minutes. For each live stream past its first (free) hour, accrue
// one 15-minute usage increment ($0.01/viewer/hour). When a stream ends, roll its
// unbilled usage into a single Stripe invoice item on the creator's billing
// customer (lands on their next monthly invoice).
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const now = Date.now();

  let stripeKey: string | null = null;
  try {
    const { getSecrets } = await import("@/lib/settings");
    stripeKey = (await getSecrets(["STRIPE_SECRET_KEY"])).STRIPE_SECRET_KEY;
  } catch { /* no stripe in dev */ }

  // 1) Accrue a 15-minute increment for every live stream past the free hour.
  const { data: liveStreams } = await (supabase as any)
    .from("live_streams")
    .select("id, creator_profile_id, started_at")
    .eq("status", "live");

  for (const s of liveStreams ?? []) {
    const ageSec = (now - new Date(s.started_at).getTime()) / 1000;
    if (ageSec <= LIVE_FREE_SECONDS) continue;

    const since = new Date(now - 90_000).toISOString();
    const { count } = await (supabase as any)
      .from("live_viewer_pings")
      .select("viewer_key", { count: "exact", head: true })
      .eq("stream_id", s.id)
      .gte("last_seen", since);

    const viewers = count ?? 0;
    const amount = liveIncrementCents(viewers);
    if (amount <= 0) continue;

    await writeOrLog("cron/live-billing insert live_usage_charges", (supabase as any).from("live_usage_charges").insert({
      stream_id: s.id,
      creator_profile_id: s.creator_profile_id,
      viewer_count: viewers,
      amount_cents: amount,
    }));
  }

  // 2) Bill ended streams: one invoice item per stream's unbilled usage.
  const { data: unbilled } = await (supabase as any)
    .from("live_usage_charges")
    .select("id, stream_id, creator_profile_id, amount_cents")
    .eq("billed", false);

  const byStream: Record<string, { creator: string; ids: string[]; cents: number }> = {};
  for (const c of unbilled ?? []) {
    const g = (byStream[c.stream_id] ||= { creator: c.creator_profile_id, ids: [], cents: 0 });
    g.ids.push(c.id);
    g.cents += c.amount_cents;
  }

  for (const [streamId, g] of Object.entries(byStream)) {
    const { data: st } = await (supabase as any)
      .from("live_streams").select("status").eq("id", streamId).maybeSingle();
    if (st?.status === "live") continue; // still streaming — wait until it ends
    if (g.cents < 1) continue;

    let invoiceItemId: string | null = null;
    if (stripeKey) {
      const { data: cp } = await (supabase as any)
        .from("creator_profiles").select("user_id").eq("id", g.creator).maybeSingle();
      const { data: billing } = cp
        ? await (supabase as any).from("creator_billing").select("stripe_customer_id").eq("user_id", cp.user_id).maybeSingle()
        : { data: null };
      const customer = billing?.stripe_customer_id;
      if (customer) {
        const params = new URLSearchParams();
        params.set("customer", customer);
        params.set("amount", String(g.cents));
        params.set("currency", "usd");
        params.set("description", "Live streaming usage (after the first free hour)");
        const r = await fetch("https://api.stripe.com/v1/invoiceitems", {
          method: "POST",
          headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });
        const item = await r.json();
        if (r.ok) invoiceItemId = item.id;
      }
    }

    await writeOrLog("cron/live-billing update live_usage_charges", (supabase as any).from("live_usage_charges")
      .update({ billed: true, stripe_invoice_item_id: invoiceItemId })
      .in("id", g.ids));
  }

  return NextResponse.json({ ok: true });
}
