// Phase 2: silent-failure scanner.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const refs = JSON.parse(fs.readFileSync(path.join(__dirname, 'refs.json'), 'utf8'));

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

const MONEY = /amount|price|earn|payout|revenue|fee|net|gross|total|balance|credit|refund|charge|tip|paid|usd|cents/i;
const AUTHZ = /admin|auth|role|permission|owner|is_?admin|user_id|session|token|secret|verif/i;

const findings = [];
const add = (o) => findings.push(o);

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const lines = src.split('\n');
  const isRoute = /app[\/\\]api[\/\\].*route\.ts$/.test(rel);

  lines.forEach((ln, i) => {
    const n = i + 1;
    const t = ln.trim();

    // dangerous fallbacks
    let m;
    const fb = /(\w[\w.?\[\]']*)\s*(\?\?|\|\|)\s*(\[\]|0|""|''|`` |\{\}|false|null)/g;
    while ((m = fb.exec(ln))) {
      const expr = m[1];
      const sev = MONEY.test(expr) ? 'money' : AUTHZ.test(expr) ? 'authz' : 'other';
      add({ cat: 'fallback', file: rel, line: n, evidence: t.slice(0, 200), expr, op: m[2], val: m[3], sensitivity: sev });
    }

    // empty / log-only catch
    if (/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(t) || /\}\s*catch\s*(\([^)]*\))?\s*\{\s*\/\*/.test(t)) {
      add({ cat: 'empty-catch', file: rel, line: n, evidence: t.slice(0, 200) });
    }
    if (/\.catch\(\s*\(\s*\)\s*=>\s*\{?\s*\}?\s*\)/.test(t) || /\.catch\(\s*\(\)\s*=>\s*(null|undefined|0|\[\])\s*\)/.test(t)) {
      add({ cat: 'catch-swallow', file: rel, line: n, evidence: t.slice(0, 200) });
    }
    if (/catch\s*(\([^)]*\))?\s*\{\s*console\.(log|warn|error)/.test(t)) {
      add({ cat: 'catch-log-only', file: rel, line: n, evidence: t.slice(0, 200) });
    }

    // Promise.allSettled result unchecked
    if (/Promise\.allSettled/.test(t)) add({ cat: 'allSettled', file: rel, line: n, evidence: t.slice(0, 200) });

    // destructure that drops error
    if (/const\s*\{\s*data(\s*:\s*\w+)?\s*\}\s*=\s*await/.test(t)) {
      add({ cat: 'error-discarded', file: rel, line: n, evidence: t.slice(0, 200) });
    }

    // ok:true responses
    if (/NextResponse\.json\(\s*\{\s*ok:\s*true/.test(t) || /NextResponse\.json\(\s*\{\s*received:\s*true/.test(t)) {
      add({ cat: 'ok-true', file: rel, line: n, evidence: t.slice(0, 200) });
    }

    // floating promise: a bare supabase/fetch call statement not awaited
    if (/^\s*(supabase|\(supabase as any\)|fetch|send\w+|create\w+)\s*[.(]/.test(ln) && !/await|return|=|\.then|const|let|var/.test(ln.split('(')[0] + ln.slice(0, 40))) {
      if (/\.(insert|update|upsert|delete|from)\(/.test(ln)) add({ cat: 'floating-promise', file: rel, line: n, evidence: t.slice(0, 200) });
    }
  });

  // whole-file: routes that never inspect `error`
  if (isRoute) {
    const hasWrite = /\.(insert|update|upsert|delete)\s*\(/.test(src);
    const inspectsError = /\berror\b/.test(src) && /(if\s*\(\s*\w*[Ee]rror|error\s*\)|\{\s*error\s*\})/.test(src);
    if (hasWrite && !inspectsError) {
      add({ cat: 'route-write-no-error-check', file: rel, line: 1, evidence: 'route performs DB writes but never references an error result' });
    }
  }
}

// Per-query: writes whose result is discarded entirely
for (const r of refs) {
  if (r.kind !== 'query') continue;
  const write = r.ops.find(o => ['insert', 'update', 'upsert', 'delete'].includes(o.op));
  if (!write) continue;
  const src = fs.readFileSync(path.join(ROOT, r.file), 'utf8');
  const lines = src.split('\n');
  // look back up to 3 lines for assignment / await
  const ctxStart = Math.max(0, r.line - 4);
  const ctx = lines.slice(ctxStart, r.line + 1).join('\n');
  const captured = /const\s*\{[^}]*error[^}]*\}\s*=/.test(ctx);
  if (!captured) {
    findings.push({
      cat: 'write-result-ignored', file: r.file, line: r.line, table: r.table, op: write.op,
      evidence: (lines[r.line - 1] || '').trim().slice(0, 200),
    });
  }
}

fs.writeFileSync(path.join(__dirname, 'silent.json'), JSON.stringify(findings, null, 2));
const by = {};
findings.forEach(f => { by[f.cat] = (by[f.cat] || 0) + 1; });
console.log(JSON.stringify(by, null, 2));
console.log('\n--- money/authz-sensitive fallbacks ---');
findings.filter(f => f.cat === 'fallback' && f.sensitivity !== 'other')
  .forEach(f => console.log(`  [${f.sensitivity}] ${f.file}:${f.line}  ${f.evidence.slice(0, 130)}`));
