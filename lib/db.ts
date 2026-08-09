// ──────────────────────────────────────────────────────────────────
// lib/db.ts
//
// Every serious bug on this platform so far has had the same shape: a write is
// rejected by Postgres, nobody checks the returned error, and the code carries
// on and reports success. A customer pays and gets nothing. A creator sees no
// subscribers. A post never appears. Nothing shows up in any log, because
// PostgREST returns errors rather than throwing them, so an unchecked write is
// indistinguishable from a successful one.
//
// The list so far: digital purchases rolled back by RLS, subscriptions rejected
// by a not-null constraint, product status defaulting to draft, referral credits
// denied, tips writing to a column that does not exist. Each one was invisible
// until a person complained.
//
// `writeOrLog` does not change behaviour or control flow. It awaits the same
// query and, if it failed, prints a labelled error that will actually appear in
// the logs. That is the difference between a bug found in minutes and one found
// by a customer a week later.
//
// Use `writeOrThrow` on delivery-critical paths, where continuing after a failed
// write is worse than failing loudly: webhooks should return non-2xx so Stripe
// retries rather than recording a success that never happened.
// ──────────────────────────────────────────────────────────────────

type WriteResult = { error?: { message?: string; code?: string; details?: string } | null } | null;

/**
 * Await a Supabase write and log loudly if it failed. Returns the raw result so
 * callers that already inspect it keep working unchanged.
 */
export async function writeOrLog<T extends WriteResult>(label: string, query: PromiseLike<T>): Promise<T> {
  const res = await query;
  if (res && (res as any).error) {
    const e = (res as any).error;
    console.error(
      `DB WRITE FAILED [${label}]: ${e.message ?? "unknown"}` +
        (e.code ? ` (code ${e.code})` : "") +
        (e.details ? ` — ${e.details}` : "")
    );
  }
  return res;
}

/**
 * Same, but throws. For paths where a silent failure means someone paid and
 * received nothing.
 */
export async function writeOrThrow<T extends WriteResult>(label: string, query: PromiseLike<T>): Promise<T> {
  const res = await writeOrLog(label, query);
  if (res && (res as any).error) {
    throw new Error(`${label}: ${(res as any).error.message ?? "write failed"}`);
  }
  return res;
}
