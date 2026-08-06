/**
 * Per-creator Stripe ↔ database reconciliation. READ ONLY. DRY RUN ONLY.
 *
 * Answers, for ONE creator, transaction by transaction:
 *   • Stripe transaction type
 *   • Date
 *   • Gross amount
 *   • Creator transfer / net amount
 *   • Whether a matching database ledger row exists
 *   • Which database table should contain it
 *   • Whether the creator dashboard currently includes it
 *
 * WHAT IT NEVER DOES
 *   No writes to Stripe: no refunds, no transfer reversals, no metadata edits.
 *   No writes to Supabase: no ledger rows, no backfill, no status changes.
 *   Only GET / SELECT.
 *
 * REDACTION (enforced in code, not by convention)
 *   Customer names, emails, payment methods, billing and shipping addresses are
 *   never read into the report. Stripe identifiers are truncated to a short
 *   prefix so a row can be located by a human with Stripe access, but the report
 *   itself carries no complete identifier.
 *
 * USAGE
 *   STRIPE_SECRET_KEY=rk_live_...          # restricted READ-ONLY key strongly preferred
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *   node audit/production-integrity/_tools/creator-reconciliation.mjs --handle=april
 *
 *   --handle=<handle>     the creator to reconcile        (or --profile=<uuid>)
 *   --since=2025-01-01    limit the window                (default: all time)
 *   --json                machine-readable output
 *   --csv                 spreadsheet-friendly output
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!STRIPE_KEY || !SB_URL || !SB_KEY) {
  console.error("Required: STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!args.handle && !args.profile) {
  console.error("Required: --handle=<creator handle>  (or --profile=<creator_profile_id>)");
  process.exit(1);
}

const sinceTs = args.since ? Math.floor(new Date(args.since).getTime() / 1000) : null;

// ── redaction ────────────────────────────────────────────────────────────────
/** Short, non-reversible-enough prefix. Locatable by a human in Stripe, not a full id. */
const rid = (id) => (id ? String(id).slice(0, 11) + "…" : "—");
const money = (cents, cur = "usd") =>
  cents == null ? "—" : `${cur.toUpperCase()} ${(cents / 100).toFixed(2)}`;
const day = (unix) => (unix ? new Date(unix * 1000).toISOString().slice(0, 10) : "—");

// ── clients ──────────────────────────────────────────────────────────────────
async function stripeGet(path, params = {}, stripeAccount = null) {
  const qs = new URLSearchParams(params).toString();
  const headers = { Authorization: `Bearer ${STRIPE_KEY}` };
  if (stripeAccount) headers["Stripe-Account"] = stripeAccount;
  const res = await fetch(`https://api.stripe.com/v1/${path}${qs ? `?${qs}` : ""}`, { headers });
  if (!res.ok) throw new Error(`Stripe ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function stripeList(path, params = {}, opts = {}) {
  const out = [];
  let startingAfter = null;
  for (let page = 0; page < 100; page++) {
    const p = { limit: "100", ...params };
    if (startingAfter) p.starting_after = startingAfter;
    if (sinceTs && !p["created[gte]"]) p["created[gte]"] = String(sinceTs);
    const res = await stripeGet(path, p, opts.stripeAccount);
    out.push(...(res.data ?? []));
    if (!res.has_more || !res.data?.length) break;
    startingAfter = res.data[res.data.length - 1].id;
  }
  return out;
}

async function sb(path) {
  const res = await fetch(`${SB_URL.replace(/\/$/, "")}/rest/v1${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ── the ledger map: Stripe metadata.type -> table, and dashboard inclusion ────
// `inDashboard` reflects lib/earnings.ts SOURCES as it stands today.
const LEDGER = {
  tip:                { table: "tips",                  key: "stripe_session_id", inDashboard: true,  note: "" },
  super_tip:          { table: "super_tips",            key: "stripe_session_id", inDashboard: true,  note: "" },
  digital_product:    { table: "digital_purchases",     key: "stripe_session_id", inDashboard: true,  note: "" },
  digital_purchase:   { table: "digital_purchases",     key: "stripe_session_id", inDashboard: true,  note: "" },
  subscription:       { table: "subscriptions",         key: "stripe_subscription_id", inDashboard: false, note: "state row only; revenue lives in subscription_payments" },
  campaign_donation:  { table: "campaign_donations",    key: "stripe_session_id", inDashboard: true,  note: "" },
  merch:              { table: "merch_orders",          key: "stripe_payment_id", inDashboard: true,  note: "" },
  wishlist_gift:      { table: "wishlist_purchases",    key: "stripe_session_id", inDashboard: false, note: "SL-065: earnings.ts settles on statuses the live CHECK forbids -> always $0" },
  social_addback:     { table: "social_addback_orders", key: "stripe_session_id", inDashboard: true,  note: "" },
  post_unlock:        { table: "post_unlocks",          key: "stripe_session_id", inDashboard: false, note: "SL-023: table exists, NOT in earnings.ts" },
  gift_subscription:  { table: "gift_subscriptions",    key: "stripe_session_id", inDashboard: false, note: "SL-023: table exists, NOT in earnings.ts" },
  early_access:       { table: "early_access_passes",   key: "stripe_subscription_id", inDashboard: false, note: "SL-035: renewals never reach the ledger" },
  front_row_message:  { table: null,                    key: null,                inDashboard: false, note: "SL-023: NO LEDGER AT ALL — 50% creator share computed and discarded" },
  comment_boost:      { table: null,                    key: null,                inDashboard: false, note: "SL-023: no ledger; platform revenue only" },
  medal_pack:         { table: "medal_purchases",       key: "stripe_session",    inDashboard: false, note: "platform revenue, correctly excluded from creator earnings" },
};

const MARKETPLACE = { table: "marketplace_orders", key: "stripe_session_id", inDashboard: true, note: "" };

(async () => {
  // ── 1. resolve the creator ─────────────────────────────────────────────────
  const q = args.profile
    ? `/creator_profiles?select=id,handle,display_name,stripe_account_id&id=eq.${args.profile}`
    : `/creator_profiles?select=id,handle,display_name,stripe_account_id&handle=eq.${encodeURIComponent(args.handle)}`;
  const rows = await sb(q);
  const creator = rows?.[0];
  if (!creator) { console.error(`No creator found for ${args.handle ?? args.profile}`); process.exit(1); }

  const creatorId = creator.id;
  const acct = creator.stripe_account_id;

  console.error(`Reconciling @${creator.handle} … (Connect account ${rid(acct)})`);
  if (!acct) console.error("WARNING: this creator has no stripe_account_id — Connect transfers cannot be matched.");

  // ── 2. Stripe: one-off payments (checkout sessions) ────────────────────────
  const allSessions = await stripeList("checkout/sessions", { "expand[]": "data.payment_intent" });
  const sessions = allSessions.filter((s) => {
    if ((s.metadata?.creator_profile_id ?? "") === creatorId) return true;
    const pi = typeof s.payment_intent === "object" ? s.payment_intent : null;
    return acct && pi?.transfer_data?.destination === acct;
  });

  // ── 3. Stripe: subscription invoices routed to her account ─────────────────
  const allInvoices = await stripeList("invoices", { status: "paid", "expand[]": "data.subscription" });
  const invoices = allInvoices.filter(
    (i) => acct && (i.transfer_data?.destination === acct ||
                    (typeof i.subscription === "object" && i.subscription?.transfer_data?.destination === acct))
  );

  // ── 4. Stripe: Connect transfers actually paid to her ──────────────────────
  const transfers = acct ? await stripeList("transfers", { destination: acct }) : [];

  // ── 5. Stripe: refunds and disputes on the above ───────────────────────────
  const piIds = new Set();
  for (const s of sessions) {
    const pi = typeof s.payment_intent === "object" ? s.payment_intent?.id : s.payment_intent;
    if (pi) piIds.add(pi);
  }
  for (const i of invoices) if (i.payment_intent) piIds.add(String(i.payment_intent));

  const refunds = [];
  for (const pi of piIds) {
    try {
      const r = await stripeGet("refunds", { payment_intent: pi, limit: "100" });
      for (const x of r.data ?? []) refunds.push({ ...x, _pi: pi });
    } catch { /* best effort */ }
  }
  let disputes = [];
  try {
    disputes = (await stripeList("disputes", {})).filter((d) => piIds.has(String(d.payment_intent)));
  } catch { /* best effort */ }

  // ── 6. Database: every ledger key this creator owns ────────────────────────
  const tables = [
    ["tips", "stripe_session_id", `creator_profile_id=eq.${creatorId}`],
    ["super_tips", "stripe_session_id", `creator_profile_id=eq.${creatorId}`],
    ["digital_purchases", "stripe_session_id", `creator_profile_id=eq.${creatorId}`],
    ["subscription_payments", "stripe_invoice_id", `creator_profile_id=eq.${creatorId}`],
    ["subscriptions", "stripe_subscription_id", `creator_profile_id=eq.${creatorId}`],
    ["merch_orders", "stripe_payment_id", `creator_profile_id=eq.${creatorId}`],
    ["wishlist_purchases", "stripe_session_id", `creator_profile_id=eq.${creatorId}`],
    ["gift_subscriptions", "stripe_session_id", `creator_profile_id=eq.${creatorId}`],
    ["early_access_passes", "stripe_subscription_id", `creator_profile_id=eq.${creatorId}`],
  ];
  const dbKeys = {};
  const dbCounts = {};
  for (const [t, col, filter] of tables) {
    try {
      const r = await sb(`/${t}?select=${col}&${filter}&limit=5000`);
      dbKeys[t] = new Set(r.map((x) => x[col]).filter(Boolean));
      dbCounts[t] = r.length;
    } catch (e) {
      dbKeys[t] = new Set();
      dbCounts[t] = `ERROR: ${e.message.slice(0, 60)}`;
    }
  }
  // post_unlocks + campaign_donations + social_addback_orders + marketplace reach the
  // creator through a parent row, so they are matched by session id across the table.
  for (const [t, col] of [["post_unlocks", "stripe_session_id"], ["campaign_donations", "stripe_session_id"],
                          ["social_addback_orders", "stripe_session_id"], ["marketplace_orders", "stripe_session_id"]]) {
    try {
      const r = await sb(`/${t}?select=${col}&limit=5000`);
      dbKeys[t] = new Set(r.map((x) => x[col]).filter(Boolean));
      dbCounts[t] = r.length;
    } catch (e) { dbKeys[t] = new Set(); dbCounts[t] = `ERROR: ${e.message.slice(0, 60)}`; }
  }

  // earliest subscription_payments row — where the fill-forward ledger begins
  let ledgerStart = null;
  try {
    const r = await sb(`/subscription_payments?select=created_at&creator_profile_id=eq.${creatorId}&order=created_at.asc&limit=1`);
    ledgerStart = r?.[0]?.created_at ?? null;
  } catch { /* ignore */ }

  // ── 7. Build the per-transaction report ────────────────────────────────────
  const report = [];

  for (const s of sessions) {
    const type = s.metadata?.type ?? "(untyped session)";
    const map = LEDGER[type] ?? (s.metadata?.listing_id ? MARKETPLACE : { table: null, key: null, inDashboard: false, note: "unrecognised type" });
    const pi = typeof s.payment_intent === "object" ? s.payment_intent : null;
    const paid = s.payment_status === "paid";
    const present = map.table ? dbKeys[map.table]?.has(s.id) ?? false : false;

    report.push({
      kind: "checkout.session",
      type,
      date: day(s.created),
      ref: rid(s.id),
      paymentStatus: s.payment_status,
      gross: money(s.amount_total, s.currency),
      creatorNet: pi?.transfer_data?.amount != null ? money(pi.transfer_data.amount, s.currency) : (paid ? "(no transfer_data)" : "—"),
      table: map.table ?? "(none — no ledger exists)",
      inDb: map.table ? (present ? "YES" : "NO") : "N/A",
      inDashboard: map.inDashboard && present ? "YES" : "NO",
      note: !paid ? "not paid — should NOT be counted" : map.note,
    });
  }

  for (const i of invoices) {
    const present = dbKeys["subscription_payments"]?.has(i.id) ?? false;
    const beforeLedger = ledgerStart && new Date(i.created * 1000) < new Date(ledgerStart);
    report.push({
      kind: "invoice.payment_succeeded",
      type: "subscription_invoice",
      date: day(i.created),
      ref: rid(i.id),
      paymentStatus: i.status,
      gross: money(i.amount_paid, i.currency),
      creatorNet: money((i.amount_paid ?? 0) - (i.application_fee_amount ?? 0), i.currency),
      table: "subscription_payments",
      inDb: present ? "YES" : "NO",
      inDashboard: present ? "YES" : "NO",
      note: present ? "" : (beforeLedger || !ledgerStart
        ? "PRE-LEDGER: predates subscription_payments (migration 063 fills forward only)"
        : "MISSING despite the ledger being live — investigate"),
    });
  }

  for (const t of transfers) {
    report.push({
      kind: "transfer",
      type: "connect_transfer",
      date: day(t.created),
      ref: rid(t.id),
      paymentStatus: t.reversed ? "REVERSED" : "paid",
      gross: "—",
      creatorNet: money(t.amount, t.currency),
      table: "(no payout ledger exists)",
      inDb: "N/A",
      inDashboard: "NO",
      note: "MONEY_FLOW_MAP.md: Spotlightly keeps no payout ledger. Stripe is the only record.",
    });
  }

  for (const r of refunds) {
    report.push({
      kind: "refund",
      type: "refund",
      date: day(r.created),
      ref: rid(r.id),
      paymentStatus: r.status,
      gross: `-${money(r.amount, r.currency)}`,
      creatorNet: "(not reversed in DB)",
      table: "(none — no refund handling)",
      inDb: "NO",
      inDashboard: "NO",
      note: "SL-008: charge.refunded is not handled. Earnings still count the original payment.",
    });
  }

  for (const d of disputes) {
    report.push({
      kind: "dispute",
      type: "dispute",
      date: day(d.created),
      ref: rid(d.id),
      paymentStatus: d.status,
      gross: `-${money(d.amount, d.currency)}`,
      creatorNet: "(not reversed in DB)",
      table: "(none — no dispute handling)",
      inDb: "NO",
      inDashboard: "NO",
      note: "SL-008: charge.dispute.created is not handled.",
    });
  }

  report.sort((a, b) => a.date.localeCompare(b.date));

  // ── 8. Output ──────────────────────────────────────────────────────────────
  const missing = report.filter((r) => r.inDb === "NO");
  const notOnDashboard = report.filter((r) => r.inDashboard === "NO" && r.kind !== "transfer");
  const preLedger = report.filter((r) => /PRE-LEDGER/.test(r.note));

  const summary = {
    creator: `@${creator.handle}`,
    connectAccount: rid(acct),
    window: args.since ? `since ${args.since}` : "all time",
    subscriptionLedgerStarts: ledgerStart ? ledgerStart.slice(0, 10) : "(no rows yet)",
    counts: {
      checkoutSessions: sessions.length,
      subscriptionInvoices: invoices.length,
      connectTransfers: transfers.length,
      refunds: refunds.length,
      disputes: disputes.length,
      totalRows: report.length,
      missingFromDatabase: missing.length,
      presentButInvisibleOnDashboard: notOnDashboard.length,
      preLedgerSubscriptionInvoices: preLedger.length,
    },
    databaseRowCounts: dbCounts,
  };

  if (args.json) { console.log(JSON.stringify({ summary, report }, null, 2)); return; }

  if (args.csv) {
    console.log("date,kind,type,ref,payment_status,gross,creator_net,table,in_db,in_dashboard,note");
    for (const r of report) {
      console.log([r.date, r.kind, r.type, r.ref, r.paymentStatus, r.gross, r.creatorNet, r.table, r.inDb, r.inDashboard, `"${r.note}"`].join(","));
    }
    return;
  }

  console.log("\n═══ CREATOR RECONCILIATION — DRY RUN, READ ONLY ═══\n");
  console.log(JSON.stringify(summary, null, 2));
  console.log("\n─── TRANSACTIONS ───");
  console.log("date        kind                type                 gross            creator net      db    dash  table");
  for (const r of report) {
    console.log(
      `${r.date}  ${r.kind.padEnd(18)} ${r.type.padEnd(20)} ${String(r.gross).padEnd(16)} ${String(r.creatorNet).padEnd(16)} ${r.inDb.padEnd(5)} ${r.inDashboard.padEnd(5)} ${r.table}` +
      (r.note ? `\n            └─ ${r.note}` : "")
    );
  }

  console.log("\n─── HEADLINES ───");
  console.log(`  Missing from the database entirely : ${missing.length}`);
  console.log(`  In the database, invisible on dash : ${notOnDashboard.length}`);
  console.log(`  Subscription invoices pre-ledger   : ${preLedger.length}`);
  console.log("\nNothing was written. Stripe and the database were only read.");
})().catch((e) => {
  console.error("Reconciliation failed:", e.message);
  process.exit(1);
});
