// Repoints the six DIRECT creator_profiles reads in payment routes at the
// service-role payee helper. Embed-based routes are handled separately, because
// their parent read must stay on the RLS-enforcing anon client.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');

// file -> { varName, idExpr }  (the existing variable that holds the profile)
const DIRECT = [
  { file: 'app/api/tip/route.ts',              varName: 'profile', idExpr: 'creatorProfileId' },
  { file: 'app/api/super-tip/route.ts',        varName: 'profile', idExpr: 'creatorProfileId' },
  { file: 'app/api/gift-subscription/route.ts',varName: 'profile', idExpr: 'creatorProfileId' },
  { file: 'app/api/messages/front-row/route.ts', varName: 'creator', idExpr: 'creatorProfileId' },
];

let changed = 0;
for (const t of DIRECT) {
  const p = path.join(ROOT, t.file);
  let src = fs.readFileSync(p, 'utf8');
  if (src.includes('getPayeeCreator')) { console.log('skip (done):', t.file); continue; }

  // Replace the direct creator_profiles lookup with the helper.
  // Matches:  const { data: X } = await (supabase as any)\n .from("creator_profiles")\n .select(...)\n .eq("id", ...)...maybeSingle();
  const re = new RegExp(
    `const\\s*\\{\\s*data:\\s*${t.varName}\\s*\\}\\s*=\\s*await\\s*\\(?supabase(?:\\s+as\\s+any)?\\)?[\\s\\S]{0,60}?\\.from\\((["'\`])creator_profiles\\1\\)[\\s\\S]*?maybeSingle\\(\\);`
  );
  const m = re.exec(src);
  if (!m) { console.log('!! pattern not found:', t.file); continue; }

  const replacement =
    `// Connect routing data. Read with the service role via lib/payee.ts:\n` +
    `  // migration 064 removes anon read on creator_profiles, and guests can pay,\n` +
    `  // so this cannot come from the cookie client any more.\n` +
    `  const ${t.varName} = await getPayeeCreator(${t.idExpr});`;

  src = src.slice(0, m.index) + replacement + src.slice(m.index + m[0].length);

  // import
  if (!/from "@\/lib\/payee"/.test(src)) {
    const i = src.indexOf('\n', src.indexOf('import '));
    src = src.slice(0, i + 1) + `import { getPayeeCreator } from "@/lib/payee";\n` + src.slice(i + 1);
  }

  fs.writeFileSync(p, src);
  changed++;
  console.log('repointed:', t.file);
}
console.log('\nfiles changed:', changed);
