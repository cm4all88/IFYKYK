/**
 * CCBill integration for 18+ creator payments.
 * Spotlightly is never in the 18+ payment chain — creators
 * have their own CCBill merchant accounts.
 */

import crypto from "crypto";

interface CCBillWebhookPayload {
  eventType: string;
  subscriptionId: string;
  clientAccnum: string;
  clientSubacc: string;
  email: string;
  amount: string;
  timestamp: string;
  digest: string;
}

/**
 * Verify a CCBill webhook signature.
 * CCBill signs with MD5: MD5(eventType + amount + ... + secretWord)
 */
export function verifyWebhook(payload: CCBillWebhookPayload): boolean {
  const { digest, ...rest } = payload;
  const toHash = Object.values(rest).join("") + process.env.CCBILL_SECRET_WORD;
  const expected = crypto.createHash("md5").update(toHash).digest("hex");
  return digest === expected;
}

/**
 * Generate a CCBill payment form URL for a fan subscribing to an 18+ creator.
 * The creator's own CCBill merchant account handles the transaction.
 */
export function generatePaymentUrl({
  creatorAccountNumber,
  creatorSubAccountNumber,
  price,
  period,
  currencyCode = "840", // USD
}: {
  creatorAccountNumber: string;
  creatorSubAccountNumber: string;
  price: number;
  period: number; // subscription period in days
  currencyCode?: string;
}) {
  const baseUrl = "https://bill.ccbill.com/jpost/billingServices.cgi";
  const params = new URLSearchParams({
    clientAccnum: creatorAccountNumber,
    clientSubacc: creatorSubAccountNumber,
    formName: "cc",
    initialPrice: price.toFixed(2),
    initialPeriod: String(period),
    recurringPrice: price.toFixed(2),
    recurringPeriod: String(period),
    numRebills: "99",
    currencyCode,
  });
  return `${baseUrl}?${params.toString()}`;
}
