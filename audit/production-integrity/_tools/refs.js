// Scans app/, lib/, components/, hooks/, middleware.ts for Supabase query chains and
// extracts table + column references. Handles multi-line chains and template-literal selects.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const DIRS = ['app', 'lib', 'components', 'hooks', 'config', 'tools'];
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));

function walk(d, acc = []) {
  if (!fs.existsSync(d)) return acc;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!['node_modules', '.next', '.git'].includes(e.name)) walk(p, acc); }
    else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
let files = [];
for (const d of DIRS) walk(path.join(ROOT, d), files);
files.push(path.join(ROOT, 'middleware.ts'));
files = files.filter(f => fs.existsSync(f) && !f.includes('audit' + path.sep + 'production-integrity'));

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

// Grab a balanced call argument list starting at the '(' index
function grabCall(src, openIdx) {
  let depth = 0, i = openIdx, inS = null, esc = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (inS) { if (ch === inS) inS = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inS = ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') { depth--; if (depth === 0) return { body: src.slice(openIdx + 1, i), end: i }; }
  }
  return { body: src.slice(openIdx + 1), end: src.length };
}

// After a .from(...) call, walk forward collecting chained method calls until the chain ends.
function chainAfter(src, start) {
  const ops = [];
  let i = start;
  const MAX = 4000;
  const limit = Math.min(src.length, start + MAX);
  while (i < limit) {
    const m = /^[\s\r\n]*\.\s*([A-Za-z_$][\w$]*)\s*\(/.exec(src.slice(i));
    if (!m) break;
    const openIdx = i + m[0].length - 1;
    const { body, end } = grabCall(src, openIdx);
    ops.push({ op: m[1], body, at: i });
    i = end + 1;
  }
  return { ops, end: i };
}

const results = [];
const RE_FROM = /\.\s*from\s*\(/g;
const RE_RPC = /\.\s*rpc\s*\(/g;
const RE_STORAGE = /\.\s*storage\s*\.\s*from\s*\(/g;

// column tokens from a select() string: handles nested "rel(a,b)" and "alias:col"
function selectCols(sel) {
  const cleaned = sel.replace(/^[`'"]|[`'"]$/g, '');
  const out = [];
  let depth = 0, cur = '', nestedStack = [];
  const parts = [];
  for (const ch of cleaned) {
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth--; cur += ch; continue; }
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  for (let p of parts) {
    p = p.trim();
    if (!p) continue;
    const nest = p.match(/^([\w:!.]+)\s*\(([\s\S]*)\)$/);
    if (nest) {
      out.push({ kind: 'embed', raw: p, rel: nest[1], inner: nest[2] });
      continue;
    }
    if (p.includes('${')) { out.push({ kind: 'dynamic', raw: p }); continue; }
    const alias = p.match(/^([\w]+)\s*:\s*(.+)$/);
    const col = (alias ? alias[2] : p).trim();
    out.push({ kind: 'col', raw: p, col: col.replace(/::.*$/, '').trim() });
  }
  return out;
}

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');

  // storage.from
  RE_STORAGE.lastIndex = 0;
  let sm;
  while ((sm = RE_STORAGE.exec(src))) {
    const openIdx = sm.index + sm[0].length - 1;
    const { body, end } = grabCall(src, openIdx);
    const { ops } = chainAfter(src, end + 1);
    results.push({ kind: 'storage', file: rel, line: lineOf(src, sm.index), bucket: body.trim(), ops: ops.map(o => ({ op: o.op, body: o.body.replace(/\s+/g, ' ').slice(0, 300) })) });
  }

  // rpc
  RE_RPC.lastIndex = 0;
  let rm;
  while ((rm = RE_RPC.exec(src))) {
    const openIdx = rm.index + rm[0].length - 1;
    const { body } = grabCall(src, openIdx);
    results.push({ kind: 'rpc', file: rel, line: lineOf(src, rm.index), fn: body.split(',')[0].trim(), body: body.replace(/\s+/g, ' ').slice(0, 300) });
  }

  // from
  RE_FROM.lastIndex = 0;
  let m;
  while ((m = RE_FROM.exec(src))) {
    // skip `.storage.from(` (already handled) — check preceding text
    const before = src.slice(Math.max(0, m.index - 40), m.index);
    if (/storage\s*$/.test(before)) continue;
    const openIdx = m.index + m[0].length - 1;
    const { body, end } = grabCall(src, openIdx);
    const { ops } = chainAfter(src, end + 1);
    const tblRaw = body.trim();
    const tblLit = tblRaw.match(/^["'`]([^"'`]+)["'`]$/);
    results.push({
      kind: 'query',
      file: rel,
      line: lineOf(src, m.index),
      table: tblLit ? tblLit[1] : null,
      tableExpr: tblLit ? null : tblRaw.replace(/\s+/g, ' ').slice(0, 120),
      ops: ops.map(o => ({ op: o.op, body: o.body.replace(/\s+/g, ' ').slice(0, 600) })),
    });
  }
}

fs.writeFileSync(path.join(__dirname, 'refs.json'), JSON.stringify(results, null, 2));

// ---------- Cross reference ----------
const problems = [];
const knownTables = new Set(Object.keys(schema.tables));
const authTables = new Set(['users']); // auth.users
const eff = JSON.parse(fs.readFileSync(path.join(__dirname,'effective.json'),'utf8'));
const colsOf = t => new Set(eff.known[t] || Object.keys(schema.tables[t]?.columns || {}));
const UNRELIABLE = new Set(eff.noBaseDDL);

// Filter columns used in filter ops
const FILTER_OPS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains', 'containedBy', 'order', 'not', 'filter', 'rangeGt', 'overlaps']);

const tableUse = {};
for (const r of results) {
  if (r.kind !== 'query') continue;
  if (!r.table) { problems.push({ type: 'dynamic-table', file: r.file, line: r.line, detail: r.tableExpr }); continue; }
  tableUse[r.table] = (tableUse[r.table] || 0) + 1;
  if (!knownTables.has(r.table)) {
    problems.push({ type: 'unknown-table', file: r.file, line: r.line, table: r.table });
    continue;
  }
  const cols = colsOf(r.table);
  const t = schema.tables[r.table];
  for (const o of r.ops) {
    if (o.op === 'select') {
      const sel = o.body.trim();
      if (!sel || /^["'`]\*/.test(sel)) continue;
      if (sel.includes('${')) { problems.push({ type: 'dynamic-select', file: r.file, line: r.line, table: r.table, detail: sel.slice(0, 200) }); }
      const lit = sel.match(/^["'`]([\s\S]*?)["'`]\s*(?:,|$)/);
      if (!lit) continue;
      for (const c of selectCols(lit[1])) {
        if (c.kind === 'col') {
          if (c.col === '*' || c.col === '' || c.col.startsWith('count')) continue;
          if (!cols.has(c.col)) problems.push({ type: 'unknown-column', op: 'select', file: r.file, line: r.line, table: r.table, column: c.col });
        } else if (c.kind === 'embed') {
          problems.push({ type: 'embed-relation', file: r.file, line: r.line, table: r.table, rel: c.rel, inner: c.inner.slice(0, 120) });
        }
      }
    } else if (FILTER_OPS.has(o.op)) {
      const lit = o.body.match(/^\s*["'`]([^"'`$]+)["'`]/);
      if (!lit) continue;
      let col = lit[1].trim();
      if (o.op === 'order') col = col.split(/[,\s]/)[0];
      if (col.includes('(') || col.includes('.') || col.includes('->')) continue;
      if (!cols.has(col)) problems.push({ type: 'unknown-column', op: o.op, file: r.file, line: r.line, table: r.table, column: col });
    } else if (o.op === 'insert' || o.op === 'update' || o.op === 'upsert') {
      // object literal keys at top level
      const b = o.body.trim();
      const keys = [...b.matchAll(/(?:^|[{,]\s*)([A-Za-z_][\w]*)\s*:/g)].map(x => x[1]);
      for (const k of new Set(keys)) {
        if (['data', 'error', 'count', 'onConflict', 'ignoreDuplicates', 'returning', 'defaultToNull'].includes(k)) continue;
        if (!cols.has(k)) problems.push({ type: 'unknown-column', op: o.op, file: r.file, line: r.line, table: r.table, column: k, evidence: b.slice(0, 200) });
      }
      if (o.op === 'upsert') {
        const oc = b.match(/onConflict\s*:\s*["'`]([^"'`]+)["'`]/);
        const ocCols = oc ? oc[1].split(',').map(s => s.trim()) : null;
        const uniq = (t.uniques || []).map(u => u.cols.slice().sort().join(','));
        const pk = t.pk ? t.pk.slice().sort().join(',') : null;
        const target = ocCols ? ocCols.slice().sort().join(',') : pk;
        problems.push({
          type: 'upsert', file: r.file, line: r.line, table: r.table,
          onConflict: oc ? oc[1] : '(none → PK)',
          matchesUnique: target ? (uniq.includes(target) || target === pk) : false,
          availableUniques: uniq, pk,
        });
      }
      if (o.op === 'insert') {
        const provided = new Set(keys);
        const missing = [];
        for (const [cn, cd] of Object.entries(t.columns)) {
          if (cd.notNull && !cd.default && !provided.has(cn) && cn !== 'id') missing.push(cn);
        }
        if (missing.length) problems.push({ type: 'insert-missing-notnull', file: r.file, line: r.line, table: r.table, missing, evidence: b.slice(0, 200) });
      }
    }
  }
}

problems.forEach(p=>{ if(p.table && UNRELIABLE.has(p.table) && p.type==='unknown-column') p.confidence='unverified-base-ddl'; else if(p.type==='unknown-column') p.confidence='confirmed'; });
fs.writeFileSync(path.join(__dirname, 'problems.json'), JSON.stringify(problems, null, 2));
const byType = {};
for (const p of problems) byType[p.type] = (byType[p.type] || 0) + 1;
console.log('queries:', results.filter(r => r.kind === 'query').length, 'rpc:', results.filter(r => r.kind === 'rpc').length, 'storage:', results.filter(r => r.kind === 'storage').length);
console.log('problem counts:', JSON.stringify(byType, null, 2));
console.log('\n--- unknown tables ---');
console.log([...new Set(problems.filter(p => p.type === 'unknown-table').map(p => p.table))].join('\n'));
console.log('\n--- tables never referenced in code ---');
console.log(Object.keys(schema.tables).filter(t => !tableUse[t]).join(' '));
