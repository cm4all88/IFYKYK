import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // ── Admin protection ──────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    if (!session || !adminEmail || session.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return res;
  }

  // ── Not logged in ─────────────────────────────────────────────
  if (!session) {
    if (pathname === "/dashboard" || pathname === "/onboarding" || pathname === "/feed") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return res;
  }

  // ── Logged in — determine account type ───────────────────────
  const isCreatorRoute = pathname === "/dashboard" || pathname === "/onboarding";
  const isFanRoute = pathname === "/feed";
  const isRoot = pathname === "/";

  if (isRoot || isCreatorRoute || isFanRoute) {
    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("id, onboarding_completed_at")
      .eq("user_id", session.user.id)
      .eq("kind", "spotlight")
      .maybeSingle();

    const isCreator = !!profile;

    if (isRoot) {
      return NextResponse.redirect(new URL(isCreator ? "/dashboard" : "/feed", req.url));
    }

    if (!isCreator && isCreatorRoute) {
      return NextResponse.redirect(new URL("/feed", req.url));
    }

    if (isCreator && pathname === "/dashboard") {
      if (profile && !profile.onboarding_completed_at) {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }
    }
  }

  return res;
}

export const config = {
  matcher: ["/", "/dashboard", "/onboarding", "/feed", "/admin/:path*"],
};
