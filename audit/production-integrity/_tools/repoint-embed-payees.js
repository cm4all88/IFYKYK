// Payment routes that reached the payee through a PostgREST embed
// (`creator:creator_profile_id(...)`). That embed resolves against
// creator_profiles, so it returns null once migration 064 removes anon read.
//
// The PARENT read stays on the anon client on purpose — it is what enforces
// "only an active product / a live listing / a real tier can be paid for".
// Only the payee lookup moves to the service role.
//
// Anchored on the exact `if (!<parent>) return` guard so it cannot land on a
// lookalike identifier such as `campaignId`.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');

const FILES = [
  { file: 'app/api/campaigns/donate/route.ts',         parent: 'campaign' },
  { file: 'app/api/digital/purchase/route.ts',         parent: 'product' },
  { file: 'app/api/marketplace/purchase/route.ts',     parent: 'listing' },
  { file: 'app/api/merch/checkout/route.ts',           parent: 'product' },
  { file: 'app/api/posts/unlock/route.ts',             parent: 'post' },
  { file: 'app/api/social-addbacks/purchase/route.ts', parent: 'addback' },
  { file: 'app/api/subscribe/tier/route.ts',           parent: 'tier' },
  { file: 'app/api/wishlist/confirm/route.ts',         parent: 'purchase' },
];

let changed = 0;
const problems = [];

for (const t of FILES) {
  const p = path.join(ROOT, t.file);
  let src = fs.readFileSync(p, 'utf8');
  if (src.includes('getPayeeCreator')) { console.log('skip (done):', t.file); continue; }

  const esc = t.parent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 1. EXACT anchor: `if (!<parent>) return` — nothing else can match.
  const anchor = new RegExp(`^([ \\t]*if \\(!${esc}\\) return [^\\n]*\\n)`, 'm');
  const am = anchor.exec(src);
  if (!am) { problems.push(`${t.file}: no 'if (!${t.parent}) return' anchor`); continue; }

  // 2. Drop the embed from the select list.
  const hadEmbed = /,\s*creator:creator_profile_id\([^)]*\)/.test(src);
  if (!hadEmbed) { problems.push(`${t.file}: no creator embed found`); continue; }
  src = src.replace(/,\s*creator:creator_profile_id\([^)]*\)/g, '');

  // 3. Repoint the alias. After the canReceivePayments guard, `payee` is
  //    narrowed to PayableCreator, so no non-null assertions are needed.
  src = src.replace(new RegExp(`\\b${esc}\\.creator\\?\\.`, 'g'), 'payee.');
  src = src.replace(new RegExp(`\\b${esc}\\.creator\\.`, 'g'), 'payee.');
  src = src.replace(new RegExp(`\\b${esc}\\.creator\\b(?!\\.)`, 'g'), 'payee');

  // 4. Insert the lookup directly after the parent not-found guard.
  const am2 = anchor.exec(src);
  const at = am2.index + am2[0].length;
  const lookup =
    `\n  // The payee's Connect account, read with the service role (lib/payee.ts).\n` +
    `  // Migration 064 removes anon read on creator_profiles, so the embed that\n` +
    `  // used to supply this returns nothing. The parent row above is still read\n` +
    `  // through the RLS-enforcing client — that is what authorises the purchase;\n` +
    `  // this only answers where the money goes.\n` +
    `  const payee = await getPayeeCreator((${t.parent} as any).creator_profile_id);\n` +
    `  if (!canReceivePayments(payee)) {\n` +
    `    return NextResponse.json({ error: "Creator has not connected payments yet." }, { status: 503 });\n` +
    `  }\n`;
  src = src.slice(0, at) + lookup + src.slice(at);

  // 5. import
  if (!/from "@\/lib\/payee"/.test(src)) {
    const i = src.indexOf('\n', src.indexOf('import '));
    src = src.slice(0, i + 1) + `import { getPayeeCreator, canReceivePayments } from "@/lib/payee";\n` + src.slice(i + 1);
  }

  fs.writeFileSync(p, src);
  changed++;
  console.log('repointed:', t.file);
}

console.log('\nfiles changed:', changed);
if (problems.length) { console.log('\nPROBLEMS (handle manually):'); problems.forEach(x => console.log('  ' + x)); }
