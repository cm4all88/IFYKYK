// Parses supabase/migrations/*.sql + 01-migrations.sql into a schema inventory JSON.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const MIG = path.join(ROOT, 'supabase/migrations');

const files = fs.readdirSync(MIG).filter(f => f.endsWith('.sql')).sort();
const extra = [path.join(ROOT, '01-migrations.sql')].filter(f => fs.existsSync(f));

const schema = {}; // table -> {columns:{name:{type,source}}, pk, fks:[], uniques:[], checks:[], rls:bool, policies:[], source}
const functions = [];
const triggers = [];
const views = [];
const buckets = [];
const storagePolicies = [];
const indexes = [];

function tbl(name, src) {
  name = name.replace(/^public\./, '').replace(/"/g, '');
  if (!schema[name]) schema[name] = { columns: {}, pk: null, fks: [], uniques: [], checks: [], rls: false, policies: [], createdIn: src, touchedIn: [] };
  if (!schema[name].touchedIn.includes(src)) schema[name].touchedIn.push(src);
  return schema[name];
}

// split a parenthesized column list at top level commas
function splitTop(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

function parseColumnDef(def, table, src, t) {
  const low = def.toLowerCase();
  // table level constraints
  if (/^(primary\s+key|unique|check|constraint|foreign\s+key|exclude)/.test(low)) {
    if (/^primary\s+key/.test(low)) {
      const m = def.match(/\(([^)]*)\)/); if (m) t.pk = splitTop(m[1]).map(c => c.replace(/"/g, ''));
    } else if (/^unique/.test(low)) {
      const m = def.match(/\(([^)]*)\)/); if (m) t.uniques.push({ cols: splitTop(m[1]).map(c => c.replace(/"/g, '')), src });
    } else if (/^check/.test(low)) {
      t.checks.push({ expr: def.replace(/^check\s*/i, '').trim(), src });
    } else if (/^constraint/.test(low)) {
      const nm = def.match(/^constraint\s+(\S+)\s+(.*)$/is);
      if (nm) parseColumnDef(nm[2], table, src, t);
    } else if (/^foreign\s+key/.test(low)) {
      const m = def.match(/foreign\s+key\s*\(([^)]*)\)\s*references\s+([\w".]+)\s*(?:\(([^)]*)\))?/is);
      if (m) t.fks.push({ cols: splitTop(m[1]), refTable: m[2].replace(/^public\./, '').replace(/"/g, ''), refCols: m[3] ? splitTop(m[3]) : [], src });
    }
    return;
  }
  // regular column
  const m = def.match(/^("?[\w]+"?)\s+([\s\S]+)$/);
  if (!m) return;
  const name = m[1].replace(/"/g, '');
  const rest = m[2];
  const typeM = rest.match(/^([\w]+(?:\s+precision)?(?:\s*\([^)]*\))?(?:\[\])?(?:\s+with(?:out)?\s+time\s+zone)?)/i);
  const type = typeM ? typeM[1].trim() : rest.trim().split(/\s+/)[0];
  t.columns[name] = {
    type,
    notNull: /\bnot\s+null\b/i.test(rest),
    default: (rest.match(/\bdefault\s+([^,]+?)(?:\s+(?:not\s+null|references|check|unique|primary)\b|$)/i) || [])[1]?.trim() || null,
    src,
  };
  if (/\bprimary\s+key\b/i.test(rest)) t.pk = [name];
  if (/\bunique\b/i.test(rest)) t.uniques.push({ cols: [name], src, inline: true });
  const ref = rest.match(/references\s+([\w".]+)\s*(?:\(([^)]*)\))?/i);
  if (ref) t.fks.push({ cols: [name], refTable: ref[1].replace(/^public\./, '').replace(/"/g, ''), refCols: ref[2] ? splitTop(ref[2]) : [], src, inline: true });
  const chk = rest.match(/\bcheck\s*(\([\s\S]*)$/i);
  if (chk) {
    // balance parens
    let depth = 0, expr = '';
    for (const ch of chk[1]) { expr += ch; if (ch === '(') depth++; if (ch === ')') { depth--; if (depth === 0) break; } }
    t.checks.push({ column: name, expr, src });
  }
}

function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

// Extract $$ ... $$ bodies so they don't confuse statement splitting
function statements(sql) {
  const out = [];
  let i = 0, cur = '', inDollar = false, tag = '';
  while (i < sql.length) {
    if (!inDollar) {
      const m = sql.slice(i).match(/^\$([\w]*)\$/);
      if (m) { inDollar = true; tag = m[0]; cur += tag; i += tag.length; continue; }
      if (sql[i] === ';') { out.push(cur); cur = ''; i++; continue; }
    } else {
      if (sql.startsWith(tag, i)) { inDollar = false; cur += tag; i += tag.length; continue; }
    }
    cur += sql[i]; i++;
  }
  if (cur.trim()) out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
}

for (const f of [...files.map(x => path.join(MIG, x)), ...extra]) {
  const src = path.basename(f);
  const raw = stripComments(fs.readFileSync(f, 'utf8'));
  for (const stmt of statements(raw)) {
    const s = stmt.replace(/\s+/g, ' ').trim();
    const low = s.toLowerCase();

    let m;
    // CREATE TABLE
    if ((m = s.match(/^create\s+table\s+(?:if\s+not\s+exists\s+)?([\w".]+)\s*\(([\s\S]*)\)\s*$/i))) {
      const t = tbl(m[1], src);
      for (const def of splitTop(m[2])) parseColumnDef(def, m[1], src, t);
      continue;
    }
    // ALTER TABLE ... ADD COLUMN
    if ((m = s.match(/^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w".]+)\s+([\s\S]*)$/i))) {
      const tname = m[1]; const body = m[2]; const t = tbl(tname, src);
      if (/^enable\s+row\s+level\s+security/i.test(body)) { t.rls = true; t.rlsSrc = src; continue; }
      if (/^disable\s+row\s+level\s+security/i.test(body)) { t.rls = false; t.rlsDisabledIn = src; continue; }
      for (const clause of splitTop(body)) {
        let c;
        if ((c = clause.match(/^add\s+column\s+(?:if\s+not\s+exists\s+)?([\s\S]+)$/i))) parseColumnDef(c[1], tname, src, t);
        else if ((c = clause.match(/^add\s+constraint\s+(\S+)\s+([\s\S]+)$/i))) parseColumnDef(`constraint ${c[1]} ${c[2]}`, tname, src, t);
        else if ((c = clause.match(/^add\s+(primary\s+key|unique|check|foreign\s+key)([\s\S]+)$/i))) parseColumnDef(`${c[1]}${c[2]}`, tname, src, t);
        else if ((c = clause.match(/^drop\s+column\s+(?:if\s+exists\s+)?([\w"]+)/i))) { delete t.columns[c[1].replace(/"/g, '')]; t.dropped = t.dropped || []; t.dropped.push({ col: c[1], src }); }
        else if ((c = clause.match(/^drop\s+constraint\s+(?:if\s+exists\s+)?(\S+)/i))) { t.droppedConstraints = t.droppedConstraints || []; t.droppedConstraints.push({ name: c[1], src }); }
        else if ((c = clause.match(/^alter\s+column\s+([\w"]+)\s+([\s\S]+)$/i))) { t.alters = t.alters || []; t.alters.push({ col: c[1].replace(/"/g, ''), what: c[2], src }); }
        else if ((c = clause.match(/^rename\s+column\s+([\w"]+)\s+to\s+([\w"]+)/i))) { t.renames = t.renames || []; t.renames.push({ from: c[1], to: c[2], src }); }
      }
      continue;
    }
    // CREATE POLICY
    if ((m = s.match(/^create\s+policy\s+("([^"]+)"|'([^']+)'|[\w]+)\s+on\s+([\w".]+)([\s\S]*)$/i))) {
      const pname = m[2] || m[3] || m[1];
      const tname = m[4].replace(/^public\./, '').replace(/"/g, '');
      const rest = m[5];
      const isStorage = /^storage\./i.test(m[4]);
      const rec = {
        name: pname, table: tname, src,
        for: (rest.match(/\bfor\s+(all|select|insert|update|delete)\b/i) || [])[1]?.toLowerCase() || 'all',
        to: (rest.match(/\bto\s+([\w, ]+?)\s+(?:using|with check)/i) || [])[1]?.trim() || null,
        using: (rest.match(/\busing\s*(\([\s\S]*?\))\s*(?:with check|$)/i) || [])[1] || null,
        withCheck: (rest.match(/\bwith\s+check\s*(\([\s\S]*)$/i) || [])[1] || null,
        raw: rest.trim(),
      };
      if (isStorage) storagePolicies.push(rec);
      else tbl(tname, src).policies.push(rec);
      continue;
    }
    if ((m = s.match(/^drop\s+policy\s+(?:if\s+exists\s+)?("([^"]+)"|'([^']+)'|[\w]+)\s+on\s+([\w".]+)/i))) {
      const pname = m[2] || m[3] || m[1];
      const tname = m[4].replace(/^public\./, '').replace(/"/g, '');
      if (/^storage\./i.test(m[4])) {
        const i2 = storagePolicies.findIndex(p => p.name === pname && p.table === tname);
        if (i2 >= 0) storagePolicies.splice(i2, 1);
      } else {
        const t = schema[tname]; if (t) { const i2 = t.policies.findIndex(p => p.name === pname); if (i2 >= 0) t.policies.splice(i2, 1); }
      }
      continue;
    }
    if ((m = s.match(/^create\s+(?:or\s+replace\s+)?function\s+([\w".]+)\s*\(([^)]*)\)([\s\S]*)$/i))) {
      functions.push({ name: m[1], args: m[2], src, securityDefiner: /security\s+definer/i.test(m[3]), body: stmt.slice(0, 2000) });
      continue;
    }
    if ((m = s.match(/^create\s+trigger\s+(\S+)([\s\S]*?)\son\s+([\w".]+)([\s\S]*)$/i))) {
      triggers.push({ name: m[1], table: m[3].replace(/^public\./, ''), src, def: s.slice(0, 400) });
      continue;
    }
    if ((m = s.match(/^create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+([\w".]+)/i))) {
      views.push({ name: m[1].replace(/^public\./, ''), src, def: s.slice(0, 600) });
      continue;
    }
    if ((m = s.match(/^create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(\S+)\s+on\s+([\w".]+)\s*(?:using\s+\w+\s*)?\(([^)]*)\)([\s\S]*)$/i))) {
      indexes.push({ name: m[1], table: m[2].replace(/^public\./, '').replace(/"/g, ''), cols: splitTop(m[3]).map(c => c.replace(/"/g, '')), unique: /^create\s+unique/i.test(s), where: (m[4].match(/\bwhere\s+([\s\S]+)$/i) || [])[1] || null, src });
      if (/^create\s+unique/i.test(s)) {
        const t = tbl(m[2], src);
        t.uniques.push({ cols: splitTop(m[3]).map(c => c.replace(/"/g, '')), src, viaIndex: m[1], partial: (m[4].match(/\bwhere\s+([\s\S]+)$/i) || [])[1] || null });
      }
      continue;
    }
    if (/insert\s+into\s+storage\.buckets/i.test(s)) {
      const ids = [...s.matchAll(/values\s*\(\s*'([^']+)'/gi)].map(x => x[1]);
      const all = [...s.matchAll(/\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(true|false)/gi)];
      for (const a of all) buckets.push({ id: a[1], name: a[2], public: a[3] === 'true', src, stmt: s.slice(0, 400) });
      if (!all.length) for (const id of ids) buckets.push({ id, src, stmt: s.slice(0, 400) });
      continue;
    }
    if ((m = s.match(/^drop\s+table\s+(?:if\s+exists\s+)?([\w".]+)/i))) {
      const n = m[1].replace(/^public\./, '').replace(/"/g, '');
      if (schema[n]) { schema[n].droppedIn = src; }
      continue;
    }
  }
}

const out = { tables: schema, functions, triggers, views, buckets, storagePolicies, indexes, migrationFiles: files };
fs.writeFileSync(path.join(__dirname, 'schema.json'), JSON.stringify(out, null, 2));

// Human summary
const lines = [];
for (const [name, t] of Object.entries(schema).sort()) {
  lines.push(`TABLE ${name}${t.droppedIn ? ' [DROPPED in ' + t.droppedIn + ']' : ''}  (created:${t.createdIn}) rls=${t.rls}`);
  lines.push(`  cols: ${Object.keys(t.columns).sort().join(', ')}`);
  if (t.pk) lines.push(`  pk: ${t.pk.join(',')}`);
  for (const u of t.uniques) lines.push(`  unique: (${u.cols.join(',')})${u.partial ? ' WHERE ' + u.partial : ''} [${u.src}]`);
  for (const fk of t.fks) lines.push(`  fk: ${fk.cols.join(',')} -> ${fk.refTable}(${fk.refCols.join(',')})`);
  for (const c of t.checks) lines.push(`  check: ${(c.column ? c.column + ' ' : '')}${c.expr.replace(/\s+/g, ' ').slice(0, 220)}`);
  for (const p of t.policies) lines.push(`  policy[${p.for}] ${p.name} :: using=${(p.using || '').replace(/\s+/g, ' ').slice(0, 160)} check=${(p.withCheck || '').replace(/\s+/g, ' ').slice(0, 160)}`);
  lines.push('');
}
lines.push('=== BUCKETS ==='); buckets.forEach(b => lines.push(`  ${b.id} public=${b.public} [${b.src}]`));
lines.push('=== STORAGE POLICIES ==='); storagePolicies.forEach(p => lines.push(`  ${p.name} for=${p.for} [${p.src}] :: ${p.raw.replace(/\s+/g, ' ').slice(0, 300)}`));
lines.push('=== FUNCTIONS ==='); functions.forEach(f => lines.push(`  ${f.name}(${f.args}) secdef=${f.securityDefiner} [${f.src}]`));
lines.push('=== TRIGGERS ==='); triggers.forEach(t => lines.push(`  ${t.name} on ${t.table} [${t.src}]`));
lines.push('=== VIEWS ==='); views.forEach(v => lines.push(`  ${v.name} [${v.src}]`));
fs.writeFileSync(path.join(__dirname, 'schema.txt'), lines.join('\n'));
console.log(`tables=${Object.keys(schema).length} funcs=${functions.length} trig=${triggers.length} views=${views.length} buckets=${buckets.length} storagePolicies=${storagePolicies.length} indexes=${indexes.length}`);
console.log(Object.keys(schema).sort().join(' '));
