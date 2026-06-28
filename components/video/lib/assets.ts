// Studio/runtime-safe asset resolver. Absolute URLs, blob/data URIs, and
// root-relative paths pass through; anything else is served from /public.
export const asset = (p?: string): string | undefined => {
  if (!p) return undefined;
  if (/^(https?:|blob:|data:|\/)/.test(p)) return p;
  return '/' + p;
};
