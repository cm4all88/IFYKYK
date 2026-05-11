import { createClient } from "@/lib/supabase-server";

/**
 * The single designated admin user_id. Hardcoded by design — there is one admin.
 * Changing this requires a code deploy, which is the right amount of friction
 * for "who can edit platform credentials."
 */
export const ADMIN_USER_ID = "9b5ac2dc-ea4f-4bac-b2ef-70608562568a";

/**
 * Server-side check: is the current request from the admin user?
 * Returns true/false. Use in server components and route handlers.
 *
 * USAGE:
 *   if (!(await isAdmin())) notFound();
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id === ADMIN_USER_ID;
}
