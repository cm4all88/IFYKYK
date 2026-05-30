import { NextResponse } from "next/server";
import { getSecret } from "@/lib/settings";

export async function GET() {
  // Check Printful key via the shared resolver (platform_settings DB, then env).
  // Never expose which backend we use.
  const configured = !!(await getSecret("LOUDCAP_API_KEY"));
  return NextResponse.json({ configured });
}
