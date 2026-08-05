import { NextRequest, NextResponse } from "next/server";
import { getPayeeCreator, canReceivePayments } from "@/lib/payee";
import { createClient } from "@/lib/supabase-server";
import { getSecrets } from "@/lib/settings";

// Creator calls this after they've bought the item themselves.
// Spotlightly then transfers the item cost to their Stripe account.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { purchaseId, receiptUrl } = await req.json();
  if (!purchaseId) return NextResponse.json({ error: "Missing purchase ID" }, { status: 400 });

  // Verify creator owns this purchase
  const { data: purchase } = await (supabase as any)
    .from("wishlist_purchases")
    .select("*")
    .eq("id", purchaseId)
    .eq("status", "paid_pending_purchase")
    .maybeSingle();

  if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });

  // The payee's Connect account, read with the service role (lib/payee.ts).
  // Migration 064 removes anon read on creator_profiles, so the embed that
  // used to supply this returns nothing. The parent row above is still read
  // through the RLS-enforcing client — that is what authorises the purchase;
  // this only answers where the money goes.
  const payee = await getPayeeCreator((purchase as any).creator_profile_id);
  if (!canReceivePayments(payee)) {
    return NextResponse.json({ error: "Creator has not connected payments yet." }, { status: 503 });
  }
  if (payee.user_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  if (!payee.stripe_account_id || !payee.stripe_onboarded) {
    return NextResponse.json({ error: "Connect your Stripe account first to receive reimbursement" }, { status: 400 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  // Transfer item cost (not service fee) to creator's connected account
  const transferAmount = Math.round(Number(purchase.item_price) * 100);

  const transferParams = new URLSearchParams({
    amount: String(transferAmount),
    currency: "usd",
    destination: payee.stripe_account_id,
    "metadata[wishlist_purchase_id]": purchaseId,
    "metadata[type]": "wishlist_reimbursement",
  });

  const transferRes = await fetch("https://api.stripe.com/v1/transfers", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: transferParams.toString(),
  });

  if (!transferRes.ok) {
    const err = await transferRes.text();
    console.error("Transfer failed:", err);
    return NextResponse.json({ error: "Transfer failed — contact support" }, { status: 500 });
  }

  const transfer = await transferRes.json();

  // Update purchase status
  await (supabase as any).from("wishlist_purchases").update({
    status: "creator_purchased",
    receipt_url: receiptUrl ?? null,
    transfer_stripe_id: transfer.id,
    updated_at: new Date().toISOString(),
  }).eq("id", purchaseId);

  return NextResponse.json({ ok: true, transferred: Number(purchase.item_price) });
}
