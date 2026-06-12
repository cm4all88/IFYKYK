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
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://spotlightly.app";
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/api/stripe/connect/start`,
    return_url: `${base}/api/stripe/connect/return`,
    type: "account_onboarding",
  });
}

/**
 * Verify a Stripe webhook signature.
 */
export function verifyWebhook(body: string, signature: string) {
  return stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
