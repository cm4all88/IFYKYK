import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { claimRejection, isValidClaimCodeFormat } from "@/lib/claim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  malformed: "This link is not valid.",
  not_found: "This link is not valid.",
  already_claimed: "This page has already been claimed. Try signing in instead.",
  expired: "This invitation has expired. Ask us for a fresh link and we'll send one right over.",
};

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const code = String(body?.code || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  // Shape check before any database work: /api/claim is unauthenticated and
  // runs with the service role, so a malformed code must never reach the DB.
  if (!isValidClaimCodeFormat(code)) {
    return NextResponse.json({ error: MESSAGES.malformed }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const admin = await createServiceClient();
  const nowIso = new Date().toISOString();

  // Read first, but only to explain a refusal. The UPDATE below is the
  // authority on whether this claim actually happens.
  const { data: preview } = await (admin as any)
    .from("creator_profiles")
    .select("claimed_at, claim_expires_at")
    .eq("claim_code", code)
    .maybeSingle();

  const rejection = claimRejection(code, preview);
  if (rejection) {
    return NextResponse.json({ error: MESSAGES[rejection] }, { status: 400 });
  }

  // ── Atomic single-use claim ───────────────────────────────────────
  // The previous implementation read the row, checked claimed_at, mutated the
  // auth user, and only then marked the row claimed. Two concurrent requests
  // with the same code both passed the check and the second one's credentials
  // won — an account takeover for any link that got forwarded.
  //
  // Claiming the row FIRST closes that. Postgres serialises the two UPDATEs;
  // the loser re-evaluates its WHERE after the winner commits, finds
  // claim_code already NULL, and matches nothing.
  const { data: claimed, error: claimErr } = await (admin as any)
    .from("creator_profiles")
    .update({ claimed_at: nowIso, claim_code: null })
    .eq("claim_code", code)
    .is("claimed_at", null)
    .or(`claim_expires_at.is.null,claim_expires_at.gt.${nowIso}`)
    .select("id, user_id, handle")
    .maybeSingle();

  if (claimErr) {
    return NextResponse.json({ error: "Could not set up your account. Try again." }, { status: 500 });
  }
  if (!claimed) {
    // Lost the race, or the row changed between the preview read and here.
    return NextResponse.json({ error: MESSAGES.already_claimed }, { status: 400 });
  }

  const { error: uErr } = await (admin as any).auth.admin.updateUserById(claimed.user_id, {
    email, password, email_confirm: true,
  });

  if (uErr) {
    // Hand the code back so the creator can retry — otherwise a duplicate
    // email address would burn their invitation permanently.
    await (admin as any)
      .from("creator_profiles")
      .update({ claimed_at: null, claim_code: code })
      .eq("id", claimed.id);

    const m = (uErr.message || "").toLowerCase();
    const taken = m.includes("already") || m.includes("registered") || m.includes("exists");
    return NextResponse.json(
      { error: taken ? "That email is already in use." : "Could not set up your account. Try again." },
      { status: 400 }
    );
  }

  // ── Acquisition attribution ───────────────────────────────────────
  // If this page came from a prospect, record that they joined. Attribution
  // is a server-side join through creator_profile_id — there is no cookie,
  // no query parameter, and nothing the creator could drop by opening the
  // link in a different browser.
  //
  // Non-fatal by design: the claim itself has already succeeded, and failing
  // the request now would tell the creator their account setup broke when it
  // did not. `stage` is a reporting field; creator_profiles.claimed_at is the
  // real record of what happened.
  try {
    await (admin as any)
      .from("creator_prospects")
      .update({ stage: "joined", updated_at: nowIso })
      .eq("creator_profile_id", claimed.id)
      .neq("stage", "joined");
  } catch { /* reporting only — never fail a successful claim */ }

  return NextResponse.json({ ok: true, handle: claimed.handle });
}
