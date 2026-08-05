// Repoints anonymous creator_profiles reads at the safe `creator_public` view.
// Owner-scoped reads (.eq("user_id", user.id)) and service-role reads are left alone.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');

// Files where EVERY creator_profiles read is an anonymous public read.
const SWAP_ALL = [
  'app/explore/page.tsx',
  'app/sitemap.ts',
  'app/api/search/route.ts',
  'lib/discovery.ts',
  'app/[creator]/CreatorWorld.tsx',
  'app/[creator]/CampaignFirstPage.tsx',
  'app/preview/[creator]/page.tsx',
  'app/[creator]/page.tsx',
];

// Files with a mix — swap only the listed line numbers' statements by matching text.
const SWAP_SOME = [
  { file: 'app/api/recommendations/route.ts', all: true },
  { file: 'hooks/useCreator.ts', onlyHandleLookup: true },
];

let touched = 0;
const report = [];

function swapTable(src) {
  return src.replace(/\.from\((["'`])creator_profiles\1\)/g, '.from($1creator_public$1)');
}

for (const rel of SWAP_ALL) {
  const p = path.join(ROOT, rel);
  let src = fs.readFileSync(p, 'utf8');
  const before = (src.match(/from\((["'`])creator_profiles\1\)/g) || []).length;
  if (!before) { report.push(`skip ${rel} (no reads)`); continue; }
  src = swapTable(src);
  fs.writeFileSync(p, src);
  touched++;
  report.push(`swapped ${before} read(s) -> creator_public : ${rel}`);
}

for (const s of SWAP_SOME) {
  const p = path.join(ROOT, s.file);
  let src = fs.readFileSync(p, 'utf8');
  if (s.all) {
    const before = (src.match(/from\((["'`])creator_profiles\1\)/g) || []).length;
    src = swapTable(src);
    fs.writeFileSync(p, src);
    touched++;
    report.push(`swapped ${before} read(s) -> creator_public : ${s.file}`);
  } else if (s.onlyHandleLookup) {
    // Only the by-handle (public) lookup. The by-user_id lookup is owner-scoped
    // and keeps reading the base table under creator_profiles_own_select.
    src = src.replace(
      /\.from\((["'`])creator_profiles\1\)(\s*\n\s*)\.select\((["'`])\*\3\)(\s*\n\s*)\.eq\((["'`])handle\5/,
      `.from($1creator_public$1)$2.select($3PUBLIC_SELECT$3)$4.eq($5handle$5`
    );
    fs.writeFileSync(p, src);
    touched++;
    report.push(`swapped by-handle read -> creator_public : ${s.file}`);
  }
}

console.log(report.join('\n'));
console.log('\nfiles touched:', touched);
console.log('\n--- remaining select("*") against creator_public ---');
for (const rel of [...SWAP_ALL, ...SWAP_SOME.map(s => s.file)]) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const m = src.match(/from\((["'`])creator_public\1\)[^;]{0,80}select\((["'`])\*\2\)/g);
  if (m) console.log(' ', rel, '->', m.length, 'occurrence(s) need an explicit column list');
}
