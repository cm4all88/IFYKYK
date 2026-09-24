// Append only trust history: system signals, automatic holds and every admin
// action. Service role only. A failed audit write is logged loudly; it never
// silently disappears (lib/db.ts rule), but it also never blocks a webhook.

export type TrustEventInput = {
  creatorProfileId: string;
  kind: string;
  actor: string; // "system" or "admin:<email>"
  reason?: string | null;
  detail?: Record<string, unknown>;
};

export async function recordTrustEvent(admin: any, e: TrustEventInput): Promise<void> {
  const { error } = await admin.from("creator_trust_events").insert({
    creator_profile_id: e.creatorProfileId,
    kind: e.kind,
    actor: e.actor,
    reason: e.reason ?? null,
    detail: e.detail ?? {},
  });
  if (error) {
    console.error(JSON.stringify({ at: "lib/trust/audit", event: "trust_event_write_failed", kind: e.kind, code: error.code ?? null }));
  }
}
