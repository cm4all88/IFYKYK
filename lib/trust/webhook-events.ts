// ──────────────────────────────────────────────────────────────────────────────
// lib/trust/webhook-events.ts
//
// Processed event log for the Stripe webhook. Stripe delivers at least once and
// retries on any non 2xx, so the same event.id can arrive many times.
//
//   first delivery          -> insert (processing) -> handle -> processed
//   redelivery, processed   -> skip, 200
//   redelivery, not yet     -> handle again (every money handler is also
//                              individually idempotent, so a retry after a
//                              crash is safe)
//
// If the table is missing (migration not yet applied) the webhook still runs;
// it logs and falls back to per handler idempotency rather than dropping money.
// ──────────────────────────────────────────────────────────────────────────────

export type EventRow = { event_id: string; status: string; attempts: number | null };
export type ClaimDecision = "process" | "skip";

/** Pure. */
export function decideOnExistingEvent(row: EventRow | null): ClaimDecision {
  if (!row) return "process";
  return row.status === "processed" ? "skip" : "process";
}

export async function claimEvent(admin: any, event: { id: string; type: string; account?: string | null }): Promise<ClaimDecision> {
  const ins = await admin.from("stripe_webhook_events").insert({
    event_id: event.id, type: event.type, account: event.account ?? null, status: "processing", attempts: 1,
  });
  if (!ins.error) return "process";
  if (ins.error.code !== "23505") {
    console.error(JSON.stringify({ at: "lib/trust/webhook-events", event: "claim_failed", code: ins.error.code ?? null }));
    return "process";
  }
  const { data } = await admin.from("stripe_webhook_events").select("event_id, status, attempts").eq("event_id", event.id).maybeSingle();
  const decision = decideOnExistingEvent((data as EventRow) ?? null);
  if (decision === "process") {
    await admin.from("stripe_webhook_events")
      .update({ status: "processing", attempts: ((data as EventRow)?.attempts ?? 1) + 1 })
      .eq("event_id", event.id);
  }
  return decision;
}

export async function finishEvent(admin: any, eventId: string, httpStatus: number, error?: string | null) {
  const ok = httpStatus < 500;
  const { error: e } = await admin.from("stripe_webhook_events").update({
    status: ok ? "processed" : "failed",
    processed_at: ok ? new Date().toISOString() : null,
    last_error: ok ? null : String(error ?? `http_${httpStatus}`).slice(0, 500),
  }).eq("event_id", eventId);
  if (e) console.error(JSON.stringify({ at: "lib/trust/webhook-events", event: "finish_failed", code: e.code ?? null }));
}
