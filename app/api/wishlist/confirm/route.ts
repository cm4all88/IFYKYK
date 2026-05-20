import { NextRequest, NextResponse } from "next/server";
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
    .select("*, creator:creator_profile_id(id, user_id, stripe_account_id, stripe_onboarded)")
    .eq("id", purchaseId)
    .eq("status", "paid_pending_purchase")
    .maybeSingle();

  if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  if (purchase.creator.user_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  if (!purchase.creator.stripe_account_id || !purchase.creator.stripe_onboarded) {
    return NextResponse.json({ error: "Connect your Stripe account first to receive reimbursement" }, { status: 400 });
  }

  const { STRIPE_SECRET_KEY } = await getSecrets(["STRIPE_SECRET_KEY"]);
  if (!STRIPE_SECRET_KEY) return NextResponse.json({ error: "Payments unavailable" }, { status: 503 });

  // Transfer item cost (not service fee) to creator's connected account
  const transferAmount = Math.round(Number(purchase.item_price) * 100);

  const transferParams = new URLSearchParams({
    amount: String(transferAmount),
    currency: "usd",
    destination: purchase.creator.stripe_account_id,
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
    stripe_transfer_id: transfer.id,
    updated_at: new Date().toISOString(),
  }).eq("id", purchaseId);

  return NextResponse.json({ ok: true, transferred: Number(purchase.item_price) });
}
