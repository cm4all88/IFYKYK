import {staticFile} from 'remotion';

// Server-side render resolver. Hosted URLs and data URIs pass through; relative
// or root-relative paths resolve from the bundled public/ folder. blob: URLs are
// browser-only and cannot be rendered server-side, so they are dropped.
export const asset = (p?: string): string | undefined => {
  if (!p) return undefined;
  if (/^(https?:|data:)/.test(p)) return p;
  if (p.startsWith('blob:')) return undefined;
  return staticFile(p.replace(/^\//, ''));
};
