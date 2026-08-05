/**
 * Historical tip reconciliation — Stripe vs `public.tips`.
 *
 * WHY: `public.tips` holds 0 rows, and the webhook's insert omitted two NOT NULL
 * columns, so every tip insert failed 23502 while the handler returned 200. Zero
 * rows therefore does NOT mean zero tips. Only Stripe knows.
 *
 * READ ONLY AND DRY RUN. This script:
 *   • never writes to Stripe (no refunds, no transfer reversals, no metadata edits)
 *   • never writes to Supabase (no ledger rows, no backfill)
 *   • never prints an email, name, card detail or full customer id
 *
 * It answers one question: how many tip payments exist in Stripe, and how many
 * of them are missing from the database.
 *
 * USAGE
 *   STRIPE_SECRET_KEY=sk_live_... \
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node audit/production-integrity/_tools/tip-reconciliation.mjs
 *
 * Optional:
 *   --since=2025-01-01     only sessions created on/after this date
 *   --json                 machine-readable output
 *
 * A restricted (read-only) Stripe key is strongly preferred over the live secret.
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!STRIPE_KEY) {
  console.error("STRIPE_SECRET_KEY is required. A restricted read-only key is preferred.");
  process.exit(1);
}

const sinceTs = args.since ? Math.floor(new Date(args.since).getTime() / 1000) : null;

async function stripeGet(pathname, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://api.stripe.com/v1/${pathname}${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stripe ${pathname} ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** Every checkout session whose metadata marks it a tip. */
async function listTipSessions() {
  const out = [];
  let startingAfter = null;
  let pages = 0;

  for (;;) {
    const params = { limit: "100", "expand[]": "data.payment_intent" };
    if (startingAfter) params.starting_after = startingAfter;
    if (sinceTs) params["created[gte]"] = String(sinceTs);

    const page = await stripeGet("checkout/sessions", params);
    pages++;
    for (const s of page.data ?? []) {
      if ((s.metadata?.type ?? "") === "tip") out.push(s);
    }
    if (!page.has_more || !page.data?.length) break;
    startingAfter = page.data[page.data.length - 1].id;
    if (pages > 200) { console.error("Stopped at 200 pages — narrow with --since."); break; }
  }
  return out;
}

async function fetchRecordedSessionIds() {
  if (!SB_URL || !SB_KEY) return null;
  const res = await fetch(
    `${SB_URL.replace(/\/$/, "")}/rest/v1/tips?select=stripe_session_id,stripe_payment_intent_id&limit=10000`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  );
  if (!res.ok) {
    console.error(`Supabase read failed (${res.status}); continuing without DB comparison.`);
    return null;
  }
  const rows = await res.json();
  return new Set(rows.map((r) => r.stripe_session_id).filter(Boolean));
}

const money = (cents) => `$${((cents ?? 0) / 100).toFixed(2)}`;

(async () => {
  console.error("Querying Stripe for sessions with metadata.type=tip …");
  const sessions = await listTipSessions();
  const recorded = await fetchRecordedSessionIds();

  const paid = sessions.filter((s) => s.payment_status === "paid");
  const unpaid = sessions.filter((s) => s.payment_status !== "paid");

  let grossCents = 0;
  let transferCents = 0;
  let refundedCents = 0;
  let refundCount = 0;
  let currencies = new Set();
  let earliest = null;
  let latest = null;
  const missing = [];

  for (const s of paid) {
    grossCents += s.amount_total ?? 0;
    currencies.add(s.currency ?? "unknown");

    const created = new Date((s.created ?? 0) * 1000);
    if (!earliest || created < earliest) earliest = created;
    if (!latest || created > latest) latest = created;

    const pi = typeof s.payment_intent === "object" ? s.payment_intent : null;
    const td = pi?.transfer_data;
    if (td?.amount != null) transferCents += td.amount;

    // metadata.amount_usd is the tip; amount_total is the grossed-up charge.
    const tipUsd = Number(s.metadata?.amount_usd ?? 0);

    if (recorded && !recorded.has(s.id)) {
      missing.push({
        session: s.id.slice(0, 12) + "…",           // truncated: not a full identifier
        created: created.toISOString().slice(0, 10),
        tipUsd: Number.isFinite(tipUsd) ? tipUsd : null,
        chargedCents: s.amount_total ?? 0,
        currency: s.currency ?? null,
        hasFanUser: !!s.metadata?.fan_user_id,       // false => guest tip
        creatorProfileId: s.metadata?.creator_profile_id ? "present" : "MISSING",
      });
    }
  }

  // Refunds against tip payment intents.
  for (const s of paid) {
    const pi = typeof s.payment_intent === "object" ? s.payment_intent : null;
    if (!pi?.id) continue;
    try {
      const refunds = await stripeGet("refunds", { payment_intent: pi.id, limit: "100" });
      for (const r of refunds.data ?? []) {
        refundedCents += r.amount ?? 0;
        refundCount++;
      }
    } catch { /* refund lookup is best-effort */ }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    scope: sinceTs ? `sessions created on/after ${args.since}` : "all time",
    stripe: {
      tipSessionsTotal: sessions.length,
      paid: paid.length,
      unpaidOrIncomplete: unpaid.length,
      grossChargedToFans: money(grossCents),
      connectTransfersToCreators: money(transferCents),
      refunds: { count: refundCount, amount: money(refundedCents) },
      currencies: [...currencies],
      earliestPayment: earliest ? earliest.toISOString().slice(0, 10) : null,
      latestPayment: latest ? latest.toISOString().slice(0, 10) : null,
    },
    database: recorded
      ? {
          rowsInTips: recorded.size,
          alreadyRepresented: paid.length - missing.length,
          missingFromTips: missing.length,
        }
      : { note: "Supabase env not supplied — comparison skipped." },
    guestTipsAmongMissing: missing.filter((m) => !m.hasFanUser).length,
    missingCreatorProfileId: missing.filter((m) => m.creatorProfileId === "MISSING").length,
  };

  if (args.json) {
    console.log(JSON.stringify({ report, missing }, null, 2));
  } else {
    console.log("\n═══ TIP RECONCILIATION (dry run, read only) ═══\n");
    console.log(JSON.stringify(report, null, 2));
    if (missing.length) {
      console.log(`\n─── ${missing.length} paid tip(s) present in Stripe and ABSENT from public.tips ───`);
      console.log("(session ids truncated; no customer data shown)\n");
      for (const m of missing.slice(0, 50)) {
        console.log(`  ${m.created}  ${m.session}  tip=$${m.tipUsd ?? "?"}  charged=${money(m.chargedCents)}  ${m.hasFanUser ? "fan" : "GUEST"}  creator_profile_id=${m.creatorProfileId}`);
      }
      if (missing.length > 50) console.log(`  … and ${missing.length - 50} more (use --json)`);
      console.log("\n⚠️  Money was taken and not recorded. A backfill plan is required —");
      console.log("    see audit/production-integrity/TIP_RECONCILIATION.md. Do NOT backfill");
      console.log("    without approval, and never before migration 065 is applied.");
    } else if (recorded) {
      console.log("\n✅ Every paid tip in Stripe is represented in public.tips. No backfill required.");
    }
  }

  console.log("\nNothing was written. Stripe and the database were only read.");
})().catch((e) => {
  console.error("Reconciliation failed:", e.message);
  process.exit(1);
});
