import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_ID = "9b5ac2dc-ea4f-4bac-b2ef-70608562568a";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  if (pathname !== "/" && pathname !== "/dashboard" && !pathname.startsWith("/admin")) return res;

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

  // Protect /admin — must be the admin user
  if (pathname.startsWith("/admin")) {
    if (!session || session.user.id !== ADMIN_ID) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return res;
  }

  if (!session) {
    if (pathname === "/dashboard") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return res;
  }

  // Logged in and hitting root — redirect to dashboard
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Logged in and hitting dashboard — check if onboarding is complete
  if (pathname === "/dashboard") {
    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("onboarding_completed_at")
      .eq("user_id", session.user.id)
      .eq("kind", "spotlight")
      .maybeSingle();

    if (profile && !profile.onboarding_completed_at) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/", "/dashboard", "/admin/:path*"],
};
