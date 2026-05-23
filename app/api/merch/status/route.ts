import { NextResponse } from "next/server";

export async function GET() {
  // Check Printful key — but never expose which backend we use
  const configured = !!process.env.PRINTFUL_API_KEY;
  return NextResponse.json({ configured });
}
