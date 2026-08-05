// ──────────────────────────────────────────────────────────────────────────────
// lib/earnings.ts
//
// One definition of what a creator has earned, used by the creator dashboard,
// the analytics pane, and admin reporting so they cannot disagree.
//
// Two numbers, and they are not interchangeable:
//
//   net   — what the creator keeps. This is what "Total earned" means on a
//           creator's dashboard and it should track what lands in their bank.
//   gross — what the fan paid. Correct for campaign progress bars and for
//           platform-level reporting. Always label it as fan spend, never as
//           creator earnings.
//
// Only settled money counts. Pending and refunded rows are excluded per source,
// because "earned" should not include money that may still evaporate.
//
// Adding a revenue source? Add it to SOURCES below and every surface picks it
// up. That is the entire point of this file: the dashboard previously read one
// table, called the result "Tips + subs combined", and counted neither.
// ──────────────────────────────────────────────────────────────────────────────

export type SourceKey =
  | "tips"
  | "super_tips"
  | "digital_purchases"
  | "subscription_payments"
  | "campaign_donations"
  | "live_stream_tips"
  | "marketplace_orders"
  | "merch_orders"
  | "wishlist_purchases"
  | "social_addback_orders";

export type SourceTotal = {
  key: SourceKey;
  label: string;
  net: number;
  gross: number;
  count: number;
  /** True when the query failed. The total is not silently wrong, it is flagged. */
  failed?: boolean;
};

export type Earnings = {
  net: number;
  gross: number;
  bySource: SourceTotal[];
  /** Any source that errored. A non-empty list means the totals are incomplete. */
  failures: SourceKey[];
};

type SourceDef = {
  key: SourceKey;
  label: string;
  table: string;
  /** Column holding the creator profile id, or null when it needs a join. */
  creatorCol: string | null;
  /** For tables that reach the creator through a parent row. */
  via?: { table: string; fkOnChild: string; creatorCol: string };
  select: string;
  /** Rows to count. Return false to exclude. */
  settled: (row: any) => boolean;
  net: (row: any) => number;
  gross: (row: any) => number;
};

const num = (v: any) => (v == null ? 0 : Number(v) || 0);

const SOURCES: SourceDef[] = [
  {
    // Standard tips: 0% to Spotlightly, so net is the whole amount. The column is
    // `amount`, which is what the webhook writes and what admin and the fan view
    // read. The creator dashboard and analytics were selecting `amount_usd`,
    // which does not exist, so both silently returned nothing.
    key: "tips",
    label: "Tips",
    table: "tips",
    creatorCol: "creator_profile_id",
    select: "amount, platform_receives, created_at",
    settled: () => true,
    net: (r) => num(r.amount) - num(r.platform_receives),
    gross: (r) => num(r.amount),
  },
  {
    key: "super_tips",
    label: "Super Tips",
    table: "super_tips",
    creatorCol: "creator_profile_id",
    select: "amount_usd, creator_receives, created_at",
    settled: () => true,
    net: (r) => num(r.creator_receives),
    gross: (r) => num(r.amount_usd),
  },
  {
    key: "digital_purchases",
    label: "Digital products",
    table: "digital_purchases",
    creatorCol: "creator_profile_id",
    select: "amount_paid, creator_receives, created_at",
    settled: () => true,
    net: (r) => num(r.creator_receives),
    gross: (r) => num(r.amount_paid),
  },
  {
    key: "subscription_payments",
    label: "Subscriptions",
    table: "subscription_payments",
    creatorCol: "creator_profile_id",
    select: "gross_usd, creator_receives, status, created_at",
    settled: (r) => r.status === "paid",
    net: (r) => num(r.creator_receives),
    gross: (r) => num(r.gross_usd),
  },
  {
    // Campaigns net the creator 100%; the fan covers Stripe on top.
    key: "campaign_donations",
    label: "Campaign backing",
    table: "campaign_donations",
    creatorCol: null,
    via: { table: "campaigns", fkOnChild: "campaign_id", creatorCol: "creator_profile_id" },
    select: "amount, campaign_id, created_at",
    settled: () => true,
    net: (r) => num(r.amount),
    gross: (r) => num(r.amount),
  },
  {
    key: "live_stream_tips",
    label: "Live tips",
    table: "live_stream_tips",
    creatorCol: null,
    via: { table: "live_streams", fkOnChild: "stream_id", creatorCol: "creator_profile_id" },
    select: "amount_usd, stream_id, created_at",
    settled: () => true,
    net: (r) => num(r.amount_usd),
    gross: (r) => num(r.amount_usd),
  },
  {
    key: "marketplace_orders",
    label: "Marketplace",
    table: "marketplace_orders",
    creatorCol: null,
    via: { table: "marketplace_listings", fkOnChild: "listing_id", creatorCol: "creator_profile_id" },
    select: "amount_usd, platform_fee_usd, status, listing_id, created_at",
    settled: (r) => ["paid", "shipped", "delivered"].includes(r.status),
    net: (r) => num(r.amount_usd) - num(r.platform_fee_usd),
    gross: (r) => num(r.amount_usd),
  },
  {
    // Payment confirmation is the source of truth, not the fulfilment stage:
    // stripe_payment_id is only set once the charge cleared. A cancelled or
    // refunded order is excluded even if it was paid for.
    key: "merch_orders",
    label: "Merch",
    table: "merch_orders",
    creatorCol: "creator_profile_id",
    select: "retail_price, creator_earnings, status, stripe_payment_id, created_at",
    settled: (r) => !!r.stripe_payment_id && !["cancelled", "refunded"].includes(r.status),
    net: (r) => num(r.creator_earnings),
    gross: (r) => num(r.retail_price),
  },
  {
    // The creator receives the item price; the service fee is the platform's.
    key: "wishlist_purchases",
    label: "Wishlist",
    table: "wishlist_purchases",
    creatorCol: "creator_profile_id",
    select: "item_price, total_charged, status, created_at",
    settled: (r) => ["paid_pending_purchase", "creator_purchased"].includes(r.status),
    net: (r) => num(r.item_price),
    gross: (r) => num(r.total_charged),
  },
  {
    key: "social_addback_orders",
    label: "Social add-backs",
    table: "social_addback_orders",
    creatorCol: null,
    via: { table: "social_addbacks", fkOnChild: "addback_id", creatorCol: "creator_profile_id" },
    select: "amount_usd, status, addback_id, created_at",
    settled: (r) => ["paid", "delivered"].includes(r.status),
    net: (r) => num(r.amount_usd),
    gross: (r) => num(r.amount_usd),
  },
];

async function totalFor(
  supabase: any,
  def: SourceDef,
  creatorProfileId: string,
  since?: string
): Promise<SourceTotal> {
  const empty = { key: def.key, label: def.label, net: 0, gross: 0, count: 0 };

  try {
    let ids: string[] | null = null;

    if (def.via) {
      // Resolve the parent rows this creator owns, then filter children by them.
      const { data: parents, error: parentErr } = await supabase
        .from(def.via.table)
        .select("id")
        .eq(def.via.creatorCol, creatorProfileId);
      if (parentErr) return { ...empty, failed: true };
      ids = (parents ?? []).map((p: any) => p.id);
      if (ids!.length === 0) return empty;
    }

    let q = supabase.from(def.table).select(def.select);
    if (def.creatorCol) q = q.eq(def.creatorCol, creatorProfileId);
    if (def.via && ids) q = q.in(def.via.fkOnChild, ids);
    if (since) q = q.gte("created_at", since);

    const { data, error } = await q;
    if (error) return { ...empty, failed: true };

    const rows = (data ?? []).filter(def.settled);
    return {
      key: def.key,
      label: def.label,
      net: rows.reduce((s: number, r: any) => s + def.net(r), 0),
      gross: rows.reduce((s: number, r: any) => s + def.gross(r), 0),
      count: rows.length,
    };
  } catch {
    return { ...empty, failed: true };
  }
}

/**
 * Everything one creator has earned. Pass `since` (ISO string) to scope it to a
 * window, e.g. the first of the month.
 *
 * A source that errors is reported in `failures` rather than quietly counted as
 * zero. Showing a creator $0 because a query broke is how this went unnoticed
 * for months.
 */
export async function creatorEarnings(
  supabase: any,
  creatorProfileId: string,
  opts: { since?: string } = {}
): Promise<Earnings> {
  const results = await Promise.all(
    SOURCES.map((def) => totalFor(supabase, def, creatorProfileId, opts.since))
  );

  return {
    net: results.reduce((s, r) => s + r.net, 0),
    gross: results.reduce((s, r) => s + r.gross, 0),
    bySource: results,
    failures: results.filter((r) => r.failed).map((r) => r.key),
  };
}

/** Month-to-date and lifetime in one pass, which is what the dashboard cards need. */
export async function creatorEarningsSummary(supabase: any, creatorProfileId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [lifetime, month] = await Promise.all([
    creatorEarnings(supabase, creatorProfileId),
    creatorEarnings(supabase, creatorProfileId, { since: monthStart }),
  ]);

  return {
    lifetimeNet: lifetime.net,
    lifetimeGross: lifetime.gross,
    monthNet: month.net,
    monthGross: month.gross,
    bySource: lifetime.bySource,
    failures: lifetime.failures,
  };
}
