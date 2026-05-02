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
  });
}

/**
 * Generate an onboarding link for a Stripe Connect account.
 */
export async function createOnboardingLink(accountId: string) {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payouts?refresh=true`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/payouts?connected=true`,
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
      application_fee_percent: 0, // We charge the creator a flat fee, not a percentage
      payment_settings: { save_default_payment_method: "on_subscription" },
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
