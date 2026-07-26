// Resend delivery webhook — the feedback loop the runner depends on.
//
// Without this the runner cannot honour "stop after a bounce or unsubscribe"
// or the 5% bounce pause, because nothing would ever record an outcome.
//
// Signed with Svix headers (Resend uses Svix). Verified with
// RESEND_WEBHOOK_SECRET before the payload is trusted, per the repo rule that
// every inbound webhook checks its signature first.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Svix signature: base64 HMAC-SHA256 over `${id}.${timestamp}.${body}`. */
function verify(raw: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;

  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sig = headers.get("svix-signature");
  if (!id || !ts || !sig) return false;

  // Reject anything older than five minutes to blunt replay.
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${ts}.${raw}`)
    .digest("base64");

  // The header carries a space-separated list of `v1,<sig>` entries.
  return sig.split(" ").some((part) => {
    const value = part.split(",")[1] ?? "";
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

const FIELD: Record<string, string> = {
  "email.delivered": "delivered_at",
  "email.bounced": "bounced_at",
  "email.opened": "opened_at",
  "email.clicked": "clicked_at",
  "email.complained": "complained_at",
};

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verify(raw, req.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let evt: any;
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const type = String(evt?.type ?? "");
  const field = FIELD[type];
  if (!field) return NextResponse.json({ ok: true, ignored: type });

  const providerId = evt?.data?.email_id ?? evt?.data?.id ?? null;
  const to = Array.isArray(evt?.data?.to) ? evt.data.to[0] : evt?.data?.to;
  if (!providerId && !to) return NextResponse.json({ ok: true, ignored: "no identifier" });

  const db: any = await createServiceClient();
  const at = new Date().toISOString();

  const patch: Record<string, unknown> = { [field]: at };
  if (type === "email.bounced") {
    patch.bounce_type = evt?.data?.bounce?.type ?? evt?.data?.type ?? "unknown";
  }

  let q = db.from("prospect_outreach").update(patch);
  q = providerId ? q.eq("provider_id", providerId) : q.eq("subject", evt?.data?.subject ?? "");
  const { data: rows } = await q.select("prospect_id");

  // A hard bounce or a spam complaint ends contact with that person for good.
  if ((type === "email.bounced" || type === "email.complained") && rows?.length) {
    const ids = Array.from(new Set<string>(rows.map((r: any) => r.prospect_id as string)));
    await db
      .from("creator_prospects")
      .update({ do_not_contact: true, follow_up_at: null, updated_at: at })
      .in("id", ids);

    if (to) {
      await db
        .from("email_opt_outs")
        .upsert({ email: String(to).trim().toLowerCase() }, { onConflict: "email" });
    }
  }

  return NextResponse.json({ ok: true });
}
