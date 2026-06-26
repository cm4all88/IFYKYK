import { createServiceClient } from "@/lib/supabase-server";

// Records where/what a creator signed in from, using Vercel's edge geo headers
// (present in production) and the request IP. Sets the "first seen" fields once,
// and refreshes the "last seen" fields every time. Never throws.
export async function recordPresence(userId: string, h: { get(k: string): string | null }) {
  try {
    const xff = h.get("x-forwarded-for");
    const ip = xff ? xff.split(",")[0].trim() : (h.get("x-real-ip") || null);
    const country = h.get("x-vercel-ip-country");
    const region = h.get("x-vercel-ip-country-region");
    let city = h.get("x-vercel-ip-city");
    if (city) { try { city = decodeURIComponent(city); } catch {} }
    const ua = h.get("user-agent");
    const now = new Date().toISOString();
    const admin = await createServiceClient();

    await (admin as any).from("creator_profiles")
      .update({ last_ip: ip, last_country: country, last_region: region, last_city: city, last_user_agent: ua, last_seen_at: now })
      .eq("user_id", userId);

    await (admin as any).from("creator_profiles")
      .update({ first_ip: ip, first_country: country, first_region: region, first_city: city, first_user_agent: ua, first_seen_at: now })
      .eq("user_id", userId).is("first_ip", null);
  } catch {
    // best effort only
  }
}
