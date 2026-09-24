import Stripe from "stripe";
import { getSecrets } from "@/lib/settings";

/** A Stripe client built from the resolved secret (platform_settings, then env). Null when unconfigured. */
export async function getStripeClient(): Promise<Stripe | null> {
  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return null;
  return new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" });
}
