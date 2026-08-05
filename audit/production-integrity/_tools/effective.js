// Builds an "effective schema": migration DDL ∪ lib/database.types.ts Row types.
// For creator_profiles (which has no CREATE TABLE in repo) also unions the legacy
// public.creators base columns, since 004+ treat it as the renamed successor.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));

// --- parse database.types.ts Row blocks ---
const dts = fs.readFileSync(path.join(ROOT, 'lib/database.types.ts'), 'utf8');
const typeCols = {};
const tableRe = /^      (\w+): \{$/gm;
let m;
const marks = [];
while ((m = tableRe.exec(dts))) marks.push({ name: m[1], idx: m.index });
for (let i = 0; i < marks.length; i++) {
  const seg = dts.slice(marks[i].idx, i + 1 < marks.length ? marks[i + 1].idx : dts.length);
  const rowStart = seg.indexOf('Row: {');
  if (rowStart < 0) continue;
  const rowEnd = seg.indexOf('Insert:', rowStart);
  const row = seg.slice(rowStart, rowEnd > 0 ? rowEnd : seg.length);
  const cols = [...row.matchAll(/^\s{10}(\w+)(\??):\s*(.+)$/gm)].map(x => ({ name: x[1], type: x[3].trim() }));
  if (cols.length) typeCols[marks[i].name] = cols;
}

const effective = {};
for (const [t, def] of Object.entries(schema.tables)) {
  effective[t] = {
    migration: Object.keys(def.columns),
    types: (typeCols[t] || []).map(c => c.name),
    createdIn: def.createdIn,
    hasCreateTable: Object.keys(def.columns).length > 0 && def.createdIn !== undefined,
    rls: def.rls,
    policies: def.policies,
    checks: def.checks,
    uniques: def.uniques,
    pk: def.pk,
    fks: def.fks,
  };
}
// creator_profiles special case
if (effective.creator_profiles && effective.creators) {
  effective.creator_profiles.inheritedFromCreators = effective.creators.migration;
}

const known = {};
for (const [t, e] of Object.entries(effective)) {
  const set = new Set([...e.migration, ...e.types]);
  if (t === 'creator_profiles') for (const c of e.inheritedFromCreators || []) set.add(c);
  // universal implicit
  known[t] = set;
}
// tables whose base DDL is absent → column checks are UNRELIABLE
const noBaseDDL = [];
for (const [t, def] of Object.entries(schema.tables)) {
  const hasPk = !!def.pk;
  const created = def.createdIn;
  // If the first file that touched it only ALTERs, there's no CREATE TABLE
  if (!hasPk && !def.droppedIn) noBaseDDL.push(t);
}

fs.writeFileSync(path.join(__dirname, 'effective.json'), JSON.stringify({
  known: Object.fromEntries(Object.entries(known).map(([k, v]) => [k, [...v].sort()])),
  noBaseDDL,
  typeTables: Object.keys(typeCols),
}, null, 2));

console.log('Tables with NO CREATE TABLE in repo migrations (column checks unreliable):');
console.log(' ', noBaseDDL.join(', '));
console.log('\ncreator_profiles effective known columns (' + known.creator_profiles.size + '):');
console.log(' ', [...known.creator_profiles].sort().join(', '));
