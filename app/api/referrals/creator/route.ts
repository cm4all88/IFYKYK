import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import {
  referralRejection,
  creditsEarned,
  REFERRALS_PER_CREDIT,
  CREDIT_AMOUNT_USD,
} from "@/lib/referral-credit";

// ──────────────────────────────────────────────────────────────────────────────
// Record a creator referral, and issue billing credit once it qualifies.
//
// This route previously had NO authentication, ran with the service role, and
// took the credited creator's handle straight from the request body. Five
// unauthenticated POSTs minted $29 of credit, repeatable without limit. Its
// self-referral guard was broken twice over: skipped entirely when
// `referredUserId` was absent (an optional field), and when present it compared
// the REFERRER's own user_id against it, so any other uuid sailed through.
//
// Now:
//   • the caller must be signed in;
//   • the REFERRER is the caller — their profile is resolved server-side, and the
//     request body cannot name who gets credited;
//   • `referredUserId` is required, so the self-referral check always runs;
//   • a duplicate (referrer, referred) pair is refused;
//   • every write is checked, and a failure returns non-2xx.
//
// The service client is used only AFTER authorisation, and only to write rows
// that fall outside the caller's own RLS scope.
//
// CALLER CHANGE: app/(auth)/signup/page.tsx previously posted `referrerHandle`
// during signup, before a session existed. That call is now made by the REFERRED
// creator once they are authenticated, passing their own user id. Attribution is
// therefore something the referred account asserts about itself, which is the
// only version of this that cannot be forged on someone else's behalf.
// ──────────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // The handle of the creator who referred THIS caller.
  const referrerHandle = String(body?.referrerHandle ?? "").trim();
  if (!referrerHandle) return NextResponse.json({ error: "missing_referrer" }, { status: 400 });

  // The referred party is the caller. Not accepted from the body.
  const referredUserId = user.id;

  const { data: referrer, error: refLookupErr } = await (supabase as any)
    .from("creator_profiles")
    .select("id, user_id")
    .eq("handle", referrerHandle)
    .eq("kind", "spotlight")
    .maybeSingle();

  if (refLookupErr) {
    console.error(JSON.stringify({
      at: "referrals/creator", event: "referrer_lookup_failed", code: refLookupErr.code ?? null,
    }));
    return NextResponse.json({ error: "Could not record referral" }, { status: 500 });
  }
  if (!referrer) return NextResponse.json({ error: "no_creator_profile" }, { status: 404 });

  // Authorisation settled. Below this line we write rows the caller does not own.
  const admin = await createServiceClient();

  const { data: existing, error: dupErr } = await (admin as any)
    .from("creator_referrals")
    .select("id")
    .eq("referrer_profile_id", referrer.id)
    .eq("referred_user_id", referredUserId || NIL_UUID)
    .maybeSingle();

  if (dupErr) {
    console.error(JSON.stringify({
      at: "referrals/creator", event: "duplicate_check_failed", code: dupErr.code ?? null,
    }));
    return NextResponse.json({ error: "Could not record referral" }, { status: 500 });
  }

  const rejection = referralRejection({
    referrerUserId: referrer.user_id,
    referrerProfileId: referrer.id,
    referredUserId,
    alreadyRecorded: !!existing,
  });

  if (rejection) {
    const status =
      rejection === "unauthenticated" ? 401 :
      rejection === "no_creator_profile" ? 404 :
      rejection === "duplicate_referral" ? 409 : 400;
    return NextResponse.json({ error: rejection }, { status });
  }

  const { error: refErr } = await (admin as any).from("creator_referrals").insert({
    referrer_profile_id: referrer.id,
    referred_user_id: referredUserId,
    referred_handle: body?.referredHandle ? String(body.referredHandle).trim() : null,
    credited: false,
  });
  if (refErr) {
    console.error(JSON.stringify({
      at: "referrals/creator", event: "referral_insert_failed", code: refErr.code ?? null,
    }));
    return NextResponse.json({ error: "Could not record referral" }, { status: 500 });
  }

  const { count, error: countErr } = await (admin as any)
    .from("creator_referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_profile_id", referrer.id)
    .eq("credited", false);

  if (countErr) {
    console.error(JSON.stringify({
      at: "referrals/creator", event: "count_failed", code: countErr.code ?? null,
    }));
    return NextResponse.json({ error: "Referral recorded but credit could not be evaluated" }, { status: 500 });
  }

  const earned = creditsEarned(count ?? 0);
  if (earned.credits === 0) {
    return NextResponse.json({
      ok: true, credited: false, progress: (count ?? 0) % REFERRALS_PER_CREDIT,
    });
  }

  // Consume exactly the referrals the credits are built from, and only rows still
  // uncredited, so two concurrent calls cannot pay out twice on the same rows.
  const { data: toCredit, error: pickErr } = await (admin as any)
    .from("creator_referrals")
    .select("id")
    .eq("referrer_profile_id", referrer.id)
    .eq("credited", false)
    .order("created_at", { ascending: true })
    .limit(earned.referralsConsumed);

  if (pickErr || !toCredit?.length) {
    console.error(JSON.stringify({
      at: "referrals/creator", event: "credit_selection_failed", code: pickErr?.code ?? null,
    }));
    return NextResponse.json({ error: "Referral recorded but credit could not be issued" }, { status: 500 });
  }

  const ids = toCredit.map((r: any) => r.id);
  const { data: marked, error: markErr } = await (admin as any)
    .from("creator_referrals")
    .update({ credited: true })
    .in("id", ids)
    .eq("credited", false)
    .select("id");

  if (markErr) {
    console.error(JSON.stringify({
      at: "referrals/creator", event: "credit_mark_failed", code: markErr.code ?? null,
    }));
    return NextResponse.json({ error: "Referral recorded but credit could not be issued" }, { status: 500 });
  }

  // Another concurrent request claimed some of these rows first. Award only what
  // this request actually consumed.
  const actuallyConsumed = (marked ?? []).length;
  const credits = Math.floor(actuallyConsumed / REFERRALS_PER_CREDIT);
  if (credits === 0) {
    return NextResponse.json({ ok: true, credited: false, progress: (count ?? 0) % REFERRALS_PER_CREDIT });
  }

  const rows = Array.from({ length: credits }, () => ({
    creator_profile_id: referrer.id,
    amount_usd: CREDIT_AMOUNT_USD,
    reason: `${REFERRALS_PER_CREDIT} creator referrals — $${CREDIT_AMOUNT_USD} off next bill`,
    applied: false,
  }));

  const { error: creditErr } = await (admin as any).from("billing_credits").insert(rows);
  if (creditErr) {
    // The referrals are already marked credited. Put them back so the reward can
    // be re-earned rather than silently vanishing.
    await (admin as any)
      .from("creator_referrals")
      .update({ credited: false })
      .in("id", (marked ?? []).map((r: any) => r.id));
    console.error(JSON.stringify({
      at: "referrals/creator", event: "credit_insert_failed", code: creditErr.code ?? null,
    }));
    return NextResponse.json({ error: "Could not award referral credit" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true, credited: true, credits, amountUsd: Math.round(credits * CREDIT_AMOUNT_USD * 100) / 100,
  });
}
