import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
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
 * Create a subscription for a fan subscribing to a creator.
 */
export async function createSubscription({
  customerId,
  priceId,
  creatorAccountId,
}: {
  customerId: string;
  priceId: string;
  creatorAccountId: string;
}) {
  return stripe.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: priceId }],
      application_fee_percent: 3,  // 3% Spotlightly fee charged to fan on top of creator's price
      payment_settings: {
        save_default_payment_method: "on_subscription",
        payment_method_types: ["card"],
      },
    },
    { stripeAccount: creatorAccountId }
  );
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
