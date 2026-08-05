// After migration 064, anon loses SELECT on creator_profiles and authenticated
// keeps only `creator_profiles_own_select` (user_id = auth.uid()).
//
// Any remaining read on a NON-service client that is not scoped to the caller
// will start returning nothing. This finds them so none is missed.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');

function walk(d, acc = []) {
  if (!fs.existsSync(d)) return acc;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!['node_modules', '.next', '.git'].includes(e.name)) walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
let files = [];
for (const d of ['app', 'lib', 'components', 'hooks']) walk(path.join(ROOT, d), files);
files = files.filter(f => !f.includes('__tests__') && !f.includes('production-integrity'));

const OWNER = /\.eq\(\s*["']user_id["']\s*,\s*(user\.id|uid|user\?\.id|session)/;
const results = { safeService: [], safeOwner: [], insertUpdate: [], NEEDS_FIX: [] };

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const usesService = /createServiceClient/.test(src);

  const re = /\.from\((["'`])creator_profiles\1\)/g;
  let m;
  while ((m = re.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length;
    // window covering the whole chained statement
    const win = src.slice(m.index, m.index + 400).split(';')[0];

    if (/\.(insert|update|upsert|delete)\s*\(/.test(win)) { results.insertUpdate.push(`${rel}:${line}`); continue; }
    if (usesService) { results.safeService.push(`${rel}:${line}`); continue; }
    if (OWNER.test(win)) { results.safeOwner.push(`${rel}:${line}`); continue; }
    results.NEEDS_FIX.push({ loc: `${rel}:${line}`, snippet: win.replace(/\s+/g, ' ').slice(0, 130) });
  }
}

console.log(`service-client reads (RLS bypassed, fine): ${results.safeService.length}`);
console.log(`owner-scoped reads (covered by creator_profiles_own_select): ${results.safeOwner.length}`);
console.log(`writes (covered by existing own insert/update policies): ${results.insertUpdate.length}`);
console.log(`\n=== READS THAT WILL BREAK (${results.NEEDS_FIX.length}) ===`);
for (const r of results.NEEDS_FIX) console.log(`  ${r.loc}\n      ${r.snippet}`);
