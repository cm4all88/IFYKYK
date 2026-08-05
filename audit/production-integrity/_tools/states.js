// Phase 8: compare CHECK constraint allowed values against status literals written in code.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));
const refs = JSON.parse(fs.readFileSync(path.join(__dirname, 'refs.json'), 'utf8'));

// 1. Extract enumerated check constraints:  col in ('a','b',...)
const enums = {}; // table.col -> {allowed:[], src}
for (const [t, def] of Object.entries(schema.tables)) {
  for (const c of def.checks || []) {
    const e = c.expr.replace(/\s+/g, ' ');
    const m = e.match(/([\w"]+)\s*(?:=\s*any\s*\(\s*array)?\s*in\s*\(([^)]*)\)/i)
      || e.match(/^\(?\s*([\w"]+)\s+in\s+\(([^)]*)\)/i);
    if (m) {
      const col = (c.column || m[1]).replace(/"/g, '');
      const vals = [...m[2].matchAll(/'([^']*)'/g)].map(x => x[1]);
      if (vals.length) {
        const k = `${t}.${col}`;
        enums[k] = enums[k] || { allowed: new Set(), srcs: [] };
        vals.forEach(v => enums[k].allowed.add(v));
        enums[k].srcs.push(c.src);
      }
    }
  }
}

// 2. Find status literals written/filtered in code per table
const STATUS_COLS = ['status', 'tier', 'creator_type', 'kind', 'media_type', 'content_rating',
  'moderation_status', 'lock_type', 'post_type', 'category', 'condition', 'billing_period', 'platform', 'reason', 'type'];
const used = {}; // table.col -> Map(value -> [file:line])

function note(table, col, val, loc, op) {
  const k = `${table}.${col}`;
  used[k] = used[k] || new Map();
  if (!used[k].has(val)) used[k].set(val, []);
  used[k].get(val).push(`${loc} [${op}]`);
}

for (const r of refs) {
  if (r.kind !== 'query' || !r.table) continue;
  const loc = `${r.file}:${r.line}`;
  for (const o of r.ops) {
    const b = o.body;
    if (o.op === 'eq' || o.op === 'neq') {
      const m = b.match(/^\s*["'`](\w+)["'`]\s*,\s*["'`]([^"'`]*)["'`]/);
      if (m && STATUS_COLS.includes(m[1])) note(r.table, m[1], m[2], loc, o.op);
    } else if (o.op === 'in') {
      const m = b.match(/^\s*["'`](\w+)["'`]\s*,\s*\[([^\]]*)\]/);
      if (m && STATUS_COLS.includes(m[1])) {
        [...m[2].matchAll(/["'`]([^"'`]+)["'`]/g)].forEach(x => note(r.table, m[1], x[1], loc, 'in'));
      }
    } else if (o.op === 'insert' || o.op === 'update' || o.op === 'upsert') {
      for (const col of STATUS_COLS) {
        const re = new RegExp(`(?:^|[{,]\\s*)${col}\\s*:\\s*["'\`]([^"'\`]*)["'\`]`, 'g');
        let m2; while ((m2 = re.exec(b))) note(r.table, col, m2[1], loc, o.op);
      }
    }
  }
}

const out = [];
out.push('# State / status value reconciliation\n');
out.push('## A. Values used in code that violate a DB CHECK constraint\n');
let violations = 0;
for (const [k, vals] of Object.entries(used).sort()) {
  const e = enums[k];
  if (!e) continue;
  for (const [v, locs] of vals) {
    if (!e.allowed.has(v)) {
      violations++;
      out.push(`- **${k} = \`${v}\`** — NOT in CHECK (${[...e.allowed].map(x => `\`${x}\``).join(', ')}) [constraint from ${[...new Set(e.srcs)].join(', ')}]`);
      locs.forEach(l => out.push(`    - ${l}`));
    }
  }
}
if (!violations) out.push('_none detected by literal analysis_');

out.push('\n## B. Enumerated CHECK constraints and their code coverage\n');
for (const [k, e] of Object.entries(enums).sort()) {
  const u = used[k] ? [...used[k].keys()] : [];
  const unreachable = [...e.allowed].filter(v => !u.includes(v));
  out.push(`- \`${k}\` allowed: ${[...e.allowed].map(x => `\`${x}\``).join(', ')}`);
  out.push(`  - used in code: ${u.length ? u.map(x => `\`${x}\``).join(', ') : '_none_'}`);
  if (unreachable.length) out.push(`  - never written/read by code: ${unreachable.map(x => `\`${x}\``).join(', ')}`);
}

out.push('\n## C. Status columns written by code with NO CHECK constraint in migrations\n');
for (const [k, vals] of Object.entries(used).sort()) {
  if (enums[k]) continue;
  const [t, c] = k.split('.');
  if (!schema.tables[t]) continue;
  if (!['status', 'tier', 'moderation_status', 'category', 'condition'].includes(c)) continue;
  out.push(`- \`${k}\` — free-form, values seen: ${[...vals.keys()].map(x => `\`${x}\``).join(', ')}`);
}

fs.writeFileSync(path.join(__dirname, 'states.md'), out.join('\n'));
console.log(out.join('\n'));
