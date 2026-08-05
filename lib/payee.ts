// ──────────────────────────────────────────────────────────────────────────────
// lib/payee.ts
//
// The one place a payment route learns where to send a creator's money.
//
// Why this exists: `creator_profiles` used to carry
// `"Creators are publicly readable" FOR SELECT TO public USING (true)`, so every
// checkout route could read `stripe_account_id` off the anon client. Migration
// 064 removes that policy, because the same read also exposed `claim_code`,
// `date_of_birth`, IP tracking and shipping addresses to anyone with the browser
// key.
//
// Connect routing data is legitimately needed server-side, including for GUEST
// checkouts where there is no session at all. So it is read here with the
// service role, in one function, returning one narrow shape — instead of
// restoring a policy that would hand the whole table back to the browser.
//
// WHAT THIS DOES NOT DO
//   It does not authorise anything. The caller has already decided this payment
//   may proceed, usually by reading the parent row (a listing, product, post,
//   tier) through the RLS-enforcing anon client. Keep that read on the anon
//   client: it is what stops a draft product or another creator's listing being
//   bought. This function only answers "where does the money go".
// ──────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase-server";

export type PayeeCreator = {
  id: string;
  handle: string | null;
  display_name: string | null;
  user_id: string | null;
  stripe_account_id: string | null;
  stripe_onboarded: boolean | null;
  subscription_price: number | null;
  first_month_offer_pct: number | null;
  kind: string | null;
};

const PAYEE_COLUMNS =
  "id, handle, display_name, user_id, stripe_account_id, stripe_onboarded, subscription_price, first_month_offer_pct, kind";

/** Look up a payee by creator_profiles.id. Returns null when there is no such creator. */
export async function getPayeeCreator(creatorProfileId: string | null | undefined): Promise<PayeeCreator | null> {
  const id = String(creatorProfileId ?? "").trim();
  if (!id) return null;

  const admin = await createServiceClient();
  const { data, error } = await (admin as any)
    .from("creator_profiles")
    .select(PAYEE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(JSON.stringify({ at: "lib/payee", event: "payee_lookup_failed", code: error.code ?? null }));
    return null;
  }
  return (data as PayeeCreator) ?? null;
}

/** Same, by public handle. Used by routes that address a creator by @handle. */
export async function getPayeeCreatorByHandle(handle: string | null | undefined): Promise<PayeeCreator | null> {
  const h = String(handle ?? "").trim();
  if (!h) return null;

  const admin = await createServiceClient();
  const { data, error } = await (admin as any)
    .from("creator_profiles")
    .select(PAYEE_COLUMNS)
    .eq("handle", h)
    .maybeSingle();

  if (error) {
    console.error(JSON.stringify({ at: "lib/payee", event: "payee_lookup_failed", code: error.code ?? null }));
    return null;
  }
  return (data as PayeeCreator) ?? null;
}

/** A payee that is definitely able to receive money, with the fields to prove it. */
export type PayableCreator = PayeeCreator & {
  stripe_account_id: string;
  user_id: string;
};

/**
 * True when this creator can actually receive a Connect payment right now.
 *
 * Written as a type predicate so a caller that guards on it gets
 * `stripe_account_id` and `user_id` narrowed to `string` — which is what the
 * Stripe checkout params need, and stops the old `?? ""` fallbacks from creeping
 * back in around money routing.
 */
export function canReceivePayments(p: PayeeCreator | null): p is PayableCreator {
  return (
    !!p &&
    typeof p.stripe_account_id === "string" && p.stripe_account_id.length > 0 &&
    typeof p.user_id === "string" && p.user_id.length > 0 &&
    p.stripe_onboarded === true
  );
}
