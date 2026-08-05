// Inserts the auth guard into the six session-gated AI routes.
// /api/advisor/signup is handled separately (pre-auth, rate limited).
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');

const TARGETS = [
  { file: 'app/api/advisor/bio/route.ts', requireProfile: false, note: 'Generates a creator bio. No current caller in the codebase; gated rather than deleted in case it is reached dynamically.' },
  { file: 'app/api/campaigns/assist/route.ts', requireProfile: true, note: 'Reached from the creator dashboard and the admin campaign builder.' },
  { file: 'app/api/tiers/assist/route.ts', requireProfile: true, note: 'Reached from the creator dashboard.' },
  { file: 'app/api/posts/tags/route.ts', requireProfile: true, note: 'Reached from the creator dashboard composer.' },
  { file: 'app/api/onboarding/route.ts', requireProfile: false, note: 'Reached from /onboarding, after signup. A profile may not exist yet, so only a session is required.' },
  { file: 'app/api/studio/build/route.ts', requireProfile: true, note: 'Builds page content. Reached from the creator dashboard and the admin page builder.' },
];

let changed = 0;
for (const t of TARGETS) {
  const p = path.join(ROOT, t.file);
  let src = fs.readFileSync(p, 'utf8');

  if (src.includes('requireCreatorSession')) { console.log('skip (already gated):', t.file); continue; }

  // 1. import
  const importLine = `import { requireCreatorSession, isGuardFailure } from "@/lib/ai-guard";\n`;
  const firstImportEnd = src.indexOf('\n', src.indexOf('import '));
  src = src.slice(0, firstImportEnd + 1) + importLine + src.slice(firstImportEnd + 1);

  // 2. guard as the first statement of POST
  const re = /export\s+async\s+function\s+POST\s*\(([^)]*)\)\s*\{/;
  const m = re.exec(src);
  if (!m) { console.log('!! no POST found:', t.file); continue; }

  const guard =
    `\n  // Anthropic spend is billed to the platform. ${t.note}\n` +
    `  const guard = await requireCreatorSession({ requireProfile: ${t.requireProfile} });\n` +
    `  if (isGuardFailure(guard)) return guard.response;\n`;

  src = src.slice(0, m.index + m[0].length) + guard + src.slice(m.index + m[0].length);

  // 3. ensure nodejs runtime + dynamic (these call an external API)
  if (!/export const runtime/.test(src)) {
    src = src.replace(/\n(const |export const |async function |export async function )/, `\nexport const runtime = "nodejs";\n$1`);
  }

  fs.writeFileSync(p, src);
  changed++;
  console.log('gated:', t.file, '(requireProfile=' + t.requireProfile + ')');
}
console.log('\nfiles changed:', changed);
