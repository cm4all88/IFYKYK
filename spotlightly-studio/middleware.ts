import {NextRequest, NextResponse} from 'next/server';

// Optional password gate. Set STUDIO_USER and STUDIO_PASS in the host (Vercel)
// to require login. If they are unset, the studio is open (fine for local dev).
export function middleware(req: NextRequest) {
  const user = process.env.STUDIO_USER;
  const pass = process.env.STUDIO_PASS;
  if (!user || !pass) return NextResponse.next();

  const header = req.headers.get('authorization');
  if (header?.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      const i = decoded.indexOf(':');
      const u = decoded.slice(0, i);
      const p = decoded.slice(i + 1);
      if (u === user && p === pass) return NextResponse.next();
    } catch {
      // fall through to challenge
    }
  }
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {'WWW-Authenticate': 'Basic realm="Spotlightly Studio"'},
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|assets|favicon.ico).*)'],
};
