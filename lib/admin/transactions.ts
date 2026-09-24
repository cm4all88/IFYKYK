// ──────────────────────────────────────────────────────────────────────────────
// lib/admin/transactions.ts
//
// One platform wide ledger for /admin/transactions, assembled from every table
// that records a fan payment. Service role only; callers MUST check isAdmin().
//
// Each source is read with select("*") and mapped defensively, so a column that
// exists in one environment and not another degrades one field, not the page.
// A source whose query fails is reported in `failures` and shown as a banner,
// never silently counted as zero (lib/db.ts rule).
//
// "settled" mirrors lib/earnings.ts: only money that has actually cleared and
// has not been refunded. Unsettled rows are still listed so they can be
// reviewed; they are just excluded from totals.
// ──────────────────────────────────────────────────────────────────────────────

export type TxnType =
  | "tip" | "super_tip" | "subscription" | "digital" | "post_unlock" | "campaign"
  | "gift_sub" | "medals" | "merch" | "marketplace" | "wishlist" | "social_addback" | "live_tip";

export type Txn = {
  key: string;
  type: TxnType;
  id: string;
  created_at: string;
  creator_profile_id: string | null;
  fan_user_id: string | null;
  fan_label: string | null;
  gross: number;
  creator_net: number;
  platform: number;
  status: string;
  settled: boolean;
  stripe_ref: string | null;
  note: string | null;
};

type Row = Record<string, any>;
type Source = {
  type: TxnType;
  label: string;
  table: string;
  /** For tables reaching the creator through a parent row. */
  via?: { table: string; fk: string };
  map: (r: Row) => Omit<Txn, "key" | "type" | "id" | "created_at" | "creator_profile_id"> & { creator_profile_id?: string | null };
};

const n = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const s = (v: unknown) => (v == null || v === "" ? null : String(v));

export const TXN_SOURCES: Source[] = [
  { type: "tip", label: "Tips", table: "tips", map: (r) => ({
    fan_user_id: s(r.fan_user_id), fan_label: r.fan_user_id ? null : "guest",
    gross: n(r.amount), creator_net: n(r.amount) - n(r.platform_receives), platform: n(r.platform_receives),
    status: s(r.status) ?? "succeeded", settled: (r.status ?? "succeeded") === "succeeded",
    stripe_ref: s(r.stripe_payment_intent_id) ?? s(r.stripe_session_id),
    note: [r.tip_source && r.tip_source !== "profile" ? r.tip_source : null, r.legacy_unverified ? "legacy" : null, r.payment_failure_count ? `${r.payment_failure_count} card fails` : null].filter(Boolean).join(" · ") || null,
  }) },
  { type: "super_tip", label: "Super Tips", table: "super_tips", map: (r) => ({
    fan_user_id: s(r.fan_user_id), fan_label: s(r.fan_display_name),
    gross: n(r.amount_usd) + n(r.platform_receives), creator_net: n(r.creator_receives), platform: n(r.platform_receives),
    status: "paid", settled: true, stripe_ref: s(r.stripe_session_id), note: s(r.message),
  }) },
  { type: "subscription", label: "Subscriptions", table: "subscription_payments", map: (r) => ({
    fan_user_id: s(r.fan_user_id), fan_label: null,
    gross: n(r.gross_usd), creator_net: n(r.creator_receives), platform: n(r.platform_fee_usd),
    status: s(r.status) ?? "paid", settled: r.status === "paid", stripe_ref: s(r.stripe_invoice_id), note: null,
  }) },
  { type: "digital", label: "Digital products", table: "digital_purchases", map: (r) => ({
    fan_user_id: s(r.fan_user_id), fan_label: s(r.fan_email),
    gross: n(r.amount_paid), creator_net: n(r.creator_receives), platform: n(r.platform_fee),
    status: s(r.status) ?? "paid", settled: !["refunded", "failed"].includes(String(r.status ?? "")),
    stripe_ref: s(r.stripe_session_id), note: r.download_count ? `${r.download_count} downloads` : null,
  }) },
  { type: "post_unlock", label: "Post unlocks", table: "post_unlocks", via: { table: "posts", fk: "post_id" }, map: (r) => ({
    fan_user_id: s(r.fan_user_id), fan_label: null,
    gross: n(r.amount_paid), creator_net: n(r.amount_paid), platform: 0,
    status: "paid", settled: true, stripe_ref: s(r.stripe_session_id), note: null,
  }) },
  { type: "campaign", label: "Campaign backing", table: "campaign_donations", via: { table: "campaigns", fk: "campaign_id" }, map: (r) => ({
    fan_user_id: s(r.donor_user_id), fan_label: null,
    gross: n(r.amount), creator_net: n(r.amount), platform: 0,
    status: "paid", settled: true, stripe_ref: s(r.stripe_session_id), note: s(r.message),
  }) },
  { type: "gift_sub", label: "Gift subscriptions", table: "gift_subscriptions", map: (r) => ({
    fan_user_id: s(r.gifter_user_id), fan_label: null,
    gross: n(r.amount_paid), creator_net: n(r.amount_paid), platform: 0,
    status: r.redeemed_at ? "redeemed" : "unredeemed", settled: true, stripe_ref: s(r.stripe_session_id),
    note: `${r.months ?? 1} mo`,
  }) },
  { type: "medals", label: "Medal packs", table: "medal_purchases", map: (r) => ({
    creator_profile_id: null,
    fan_user_id: s(r.fan_user_id), fan_label: null,
    gross: n(r.amount_usd), creator_net: 0, platform: n(r.amount_usd),
    status: "paid", settled: true, stripe_ref: s(r.stripe_session) ?? s(r.stripe_session_id), note: r.medals ? `${r.medals} medals` : null,
  }) },
  { type: "merch", label: "Merch", table: "merch_orders", map: (r) => ({
    fan_user_id: s(r.fan_user_id), fan_label: s(r.shipping_name),
    gross: n(r.retail_price), creator_net: n(r.creator_earnings), platform: 0,
    status: s(r.status) ?? "unknown", settled: !!r.stripe_payment_id && !["cancelled", "refunded"].includes(String(r.status)),
    stripe_ref: s(r.stripe_payment_id) ?? s(r.stripe_session_id), note: s(r.product_name),
  }) },
  { type: "marketplace", label: "Marketplace", table: "marketplace_orders", via: { table: "marketplace_listings", fk: "listing_id" }, map: (r) => ({
    fan_user_id: s(r.buyer_user_id) ?? s(r.fan_user_id), fan_label: s(r.buyer_email),
    gross: n(r.amount_usd), creator_net: n(r.amount_usd) - n(r.platform_fee_usd), platform: n(r.platform_fee_usd),
    status: s(r.status) ?? "unknown", settled: ["paid", "shipped", "delivered"].includes(String(r.status)),
    stripe_ref: s(r.stripe_session_id), note: null,
  }) },
  { type: "wishlist", label: "Wishlist", table: "wishlist_purchases", map: (r) => ({
    fan_user_id: s(r.fan_user_id) ?? s(r.buyer_user_id), fan_label: null,
    gross: n(r.total_charged), creator_net: n(r.item_price), platform: n(r.total_charged) - n(r.item_price),
    status: s(r.status) ?? "unknown", settled: ["paid_pending_purchase", "creator_purchased", "pending", "transferred"].includes(String(r.status)),
    stripe_ref: s(r.stripe_session_id), note: null,
  }) },
  { type: "social_addback", label: "Social add backs", table: "social_addback_orders", via: { table: "social_addbacks", fk: "addback_id" }, map: (r) => ({
    fan_user_id: s(r.fan_user_id), fan_label: s(r.fan_handle) ?? s(r.buyer_email),
    gross: n(r.amount_usd), creator_net: n(r.amount_usd), platform: 0,
    status: s(r.status) ?? "unknown", settled: ["paid", "delivered"].includes(String(r.status)),
    stripe_ref: s(r.stripe_session_id), note: null,
  }) },
  { type: "live_tip", label: "Live tips", table: "live_stream_tips", via: { table: "live_streams", fk: "stream_id" }, map: (r) => ({
    fan_user_id: s(r.user_id), fan_label: s(r.display_name),
    gross: n(r.amount_usd), creator_net: n(r.amount_usd), platform: 0,
    // Recorded before payment and never confirmed (FRAUD_AUDIT.md §4). Listed, never totalled.
    status: "unconfirmed", settled: false, stripe_ref: null, note: s(r.message),
  }) },
];

export const TXN_TYPES = TXN_SOURCES.map((x) => ({ type: x.type, label: x.label }));

export type TxnQuery = {
  sinceIso: string;
  untilIso?: string | null;
  types?: TxnType[] | null;
  creatorProfileId?: string | null;
  fanUserId?: string | null;
  perSourceLimit?: number;
};

export type TxnResult = {
  rows: Txn[];
  failures: { type: TxnType; label: string; message: string }[];
  truncated: TxnType[];
};

async function loadSource(admin: any, src: Source, q: TxnQuery): Promise<{ rows: Txn[]; truncated: boolean }> {
  const limit = q.perSourceLimit ?? 500;
  let parentIds: string[] | null = null;
  let parentCreator = new Map<string, string>();

  if (src.via) {
    let pq = admin.from(src.via.table).select("id, creator_profile_id");
    if (q.creatorProfileId) pq = pq.eq("creator_profile_id", q.creatorProfileId);
    const { data, error } = await pq.limit(20_000);
    if (error) throw new Error(`${src.via.table}: ${error.message}`);
    parentCreator = new Map((data ?? []).map((p: Row) => [p.id, p.creator_profile_id]));
    if (q.creatorProfileId) {
      parentIds = Array.from(parentCreator.keys());
      if (parentIds.length === 0) return { rows: [], truncated: false };
    }
  }

  let query = admin.from(src.table).select("*").gte("created_at", q.sinceIso);
  if (q.untilIso) query = query.lte("created_at", q.untilIso);
  if (q.creatorProfileId && !src.via) {
    if (src.type === "medals") return { rows: [], truncated: false }; // platform only, no creator
    query = query.eq("creator_profile_id", q.creatorProfileId);
  }
  if (parentIds) query = query.in(src.via!.fk, parentIds.slice(0, 1000));
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit + 1);
  if (error) throw new Error(error.message);

  const list: Row[] = data ?? [];
  const rows = list.slice(0, limit).map((r) => {
    const m = src.map(r);
    const creator = m.creator_profile_id !== undefined ? m.creator_profile_id
      : src.via ? parentCreator.get(r[src.via.fk]) ?? null : s(r.creator_profile_id);
    return {
      ...m,
      key: `${src.type}:${r.id}`,
      type: src.type,
      id: String(r.id),
      created_at: String(r.created_at ?? ""),
      creator_profile_id: creator ?? null,
      gross: Math.round(m.gross * 100) / 100,
      creator_net: Math.round(m.creator_net * 100) / 100,
      platform: Math.round(m.platform * 100) / 100,
    } as Txn;
  }).filter((t) => !q.fanUserId || t.fan_user_id === q.fanUserId);

  return { rows, truncated: list.length > limit };
}

export async function loadTransactions(admin: any, q: TxnQuery): Promise<TxnResult> {
  const sources = TXN_SOURCES.filter((x) => !q.types?.length || q.types.includes(x.type));
  const settled = await Promise.allSettled(sources.map((src) => loadSource(admin, src, q)));
  const rows: Txn[] = [];
  const failures: TxnResult["failures"] = [];
  const truncated: TxnType[] = [];
  settled.forEach((r, i) => {
    const src = sources[i];
    if (r.status === "fulfilled") {
      rows.push(...r.value.rows);
      if (r.value.truncated) truncated.push(src.type);
    } else {
      failures.push({ type: src.type, label: src.label, message: String((r.reason as any)?.message ?? r.reason).slice(0, 200) });
    }
  });
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { rows, failures, truncated };
}

export type TxnTotals = { type: TxnType; label: string; count: number; settledCount: number; gross: number; creatorNet: number; platform: number };

/** Pure. Totals count settled rows only. */
export function summarizeTransactions(rows: Txn[]): { byType: TxnTotals[]; all: Omit<TxnTotals, "type" | "label"> } {
  const map = new Map<TxnType, TxnTotals>();
  for (const src of TXN_SOURCES) map.set(src.type, { type: src.type, label: src.label, count: 0, settledCount: 0, gross: 0, creatorNet: 0, platform: 0 });
  for (const r of rows) {
    const t = map.get(r.type)!;
    t.count++;
    if (!r.settled) continue;
    t.settledCount++;
    t.gross += r.gross;
    t.creatorNet += r.creator_net;
    t.platform += r.platform;
  }
  const byType = Array.from(map.values()).map((t) => ({ ...t, gross: +t.gross.toFixed(2), creatorNet: +t.creatorNet.toFixed(2), platform: +t.platform.toFixed(2) }));
  const all = byType.reduce((a, t) => ({
    count: a.count + t.count, settledCount: a.settledCount + t.settledCount,
    gross: +(a.gross + t.gross).toFixed(2), creatorNet: +(a.creatorNet + t.creatorNet).toFixed(2), platform: +(a.platform + t.platform).toFixed(2),
  }), { count: 0, settledCount: 0, gross: 0, creatorNet: 0, platform: 0 });
  return { byType, all };
}

/** Pure. RFC 4180 CSV. */
export function transactionsToCsv(rows: Txn[], handles: Map<string, string>): string {
  const cols = ["created_at", "type", "id", "creator_handle", "creator_profile_id", "fan_user_id", "fan_label", "gross", "creator_net", "platform", "status", "settled", "stripe_ref", "note"];
  const esc = (v: unknown) => {
    const x = v == null ? "" : String(v);
    // Neutralise spreadsheet formula injection from fan supplied text.
    const safe = /^[=+\-@\t\r]/.test(x) ? `'${x}` : x;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = rows.map((r) => [
    r.created_at, r.type, r.id, r.creator_profile_id ? handles.get(r.creator_profile_id) ?? "" : "", r.creator_profile_id,
    r.fan_user_id, r.fan_label, r.gross.toFixed(2), r.creator_net.toFixed(2), r.platform.toFixed(2), r.status, r.settled, r.stripe_ref, r.note,
  ].map(esc).join(","));
  return [cols.join(","), ...lines].join("\n");
}
