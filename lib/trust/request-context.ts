// Request context captured for fraud review on every tip checkout attempt.
// Deliberately small: IP, coarse location from Vercel's edge headers, user
// agent. No fingerprinting scripts, no device ids.

export type RequestContext = {
  ip: string | null;
  country: string | null;
  region: string | null;
  userAgent: string | null;
};

type HeaderLike = { get(k: string): string | null };

export function requestContextFrom(h: HeaderLike): RequestContext {
  const xff = h.get("x-forwarded-for");
  const rawIp = (xff ? xff.split(",")[0] : h.get("x-real-ip")) ?? "";
  const ip = rawIp.trim().slice(0, 64) || null;
  const clip = (v: string | null, n: number) => (v ? v.slice(0, n) : null);
  return {
    ip,
    country: clip(h.get("x-vercel-ip-country"), 8),
    region: clip(h.get("x-vercel-ip-country-region"), 16),
    userAgent: clip(h.get("user-agent"), 400),
  };
}

/** IPv4 /24 or IPv6 /48 prefix, for "same network" grouping. Null when unparseable. */
export function networkPrefix(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  if (ip.includes(":")) {
    const parts = ip.split(":").filter((p) => p.length > 0);
    if (parts.length >= 3) return `${parts.slice(0, 3).join(":")}::/48`;
  }
  return null;
}
