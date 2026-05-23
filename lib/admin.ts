import { createClient } from "@/lib/supabase-server";

/**
 * Admin access is controlled by NEXT_PUBLIC_ADMIN_EMAIL env var.
 * Set this in Vercel to your email address.
 * No code deploy required to change admin — just update the env var.
 */
export async function isAdmin(): Promise<boolean> {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  if (!adminEmail) return false;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email?.toLowerCase() === adminEmail.toLowerCase();
}
