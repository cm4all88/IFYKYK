import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

// Pure auth guard — the dashboard and other platform pages own their own chrome.
export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <>{children}</>;
}
