import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { decodeUnsubEmail, verifyUnsubscribeSignature } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Records an email opt-out. The link in every email footer is signed, so a
// caller cannot opt somebody else out by guessing their address.
//
// POST rather than GET on purpose: mail clients and security scanners
// pre-fetch links, and a GET opt-out would unsubscribe people who never
// clicked anything.
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }

  const encoded = String(body?.e || "");
  const sig = String(body?.s || "");
  if (!encoded || !sig) return NextResponse.json({ error: "Missing link parameters" }, { status: 400 });

  const email = decodeUnsubEmail(encoded);
  if (!email) return NextResponse.json({ error: "This link is not valid." }, { status: 400 });

  if (!verifyUnsubscribeSignature(email, sig)) {
    return NextResponse.json({ error: "This link is not valid." }, { status: 400 });
  }

  const admin = await createServiceClient();
  const { error } = await (admin as any)
    .from("email_opt_outs")
    .upsert(
      { email: email.trim().toLowerCase(), reason: "user_unsubscribed" },
      { onConflict: "email" }
    );

  if (error) return NextResponse.json({ error: "Could not record your request. Try again." }, { status: 500 });

  return NextResponse.json({ ok: true, email });
}
