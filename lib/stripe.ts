import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
  typescript: true,
});

/**
 * Create a Stripe Connect account for a creator.
 * Used during SFW creator onboarding.
 */
export async function createConnectAccount(email: string) {
  return stripe.accounts.create({
    type: "express",
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    settings: {
      payouts: {
        schedule: { interval: "daily" },
      },
    },
  });
}

/**
 * Generate an onboarding link for a Stripe Connect account.
 */
export async function createOnboardingLink(accountId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.spotlightly.app";
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/api/stripe/connect/start`,
    return_url: `${base}/api/stripe/connect/return`,
    type: "account_onboarding",
  });
}

/**
 * Verify a Stripe webhook signature.
 *
 * This is the trusted verifier. `constructEvent` checks three things the
 * previous hand-rolled HMAC in the webhook route did not all cover:
 *   1. the v1 signature, in constant time;
 *   2. the `t` timestamp against a tolerance (default 300s) — without which a
 *      captured request stays replayable forever;
 *   3. that `body` is the RAW request text, not re-serialised JSON.
 *
 * `secret` is optional so callers using `getSecrets()` (which reads
 * `platform_settings` before falling back to env) can pass what they resolved.
 * Omitting it preserves the original behaviour for existing callers.
 *
 * Throws `Stripe.errors.StripeSignatureVerificationError` on a bad or stale
 * signature. Callers must map that to 400 and must NOT fall back to parsing the
 * body themselves.
 */
export function verifyWebhook(
  body: string,
  signature: string,
  secret?: string,
  toleranceSeconds = 300
) {
  return stripe.webhooks.constructEvent(
    body,
    signature,
    secret ?? process.env.STRIPE_WEBHOOK_SECRET!,
    toleranceSeconds
  );
}
