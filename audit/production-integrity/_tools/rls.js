const s = require('./schema.json');
const norm = v => (v || '').replace(/\s+/g, ' ').replace(/[()]/g, '').trim().toLowerCase();
const rows = [];
for (const [t, d] of Object.entries(s.tables)) {
  if (d.droppedIn) continue;
  for (const p of d.policies) {
    const u = norm(p.using), w = norm(p.withCheck);
    const permissive = u === 'true' || w === 'true';
    const isWrite = ['all', 'insert', 'update', 'delete'].includes(p.for);
    if (permissive) rows.push({ t, p, u, w, isWrite });
  }
}
console.log('=== PERMISSIVE POLICIES (USING true / WITH CHECK true) ===');
console.log('--- WRITE-CAPABLE (anon can modify) ---');
rows.filter(r => r.isWrite).forEach(r =>
  console.log(`  [${r.p.for.toUpperCase()}] ${r.t}."${r.p.name}"  TO=${r.p.to || 'PUBLIC (no TO clause)'}  using=${r.u || '-'} check=${r.w || '-'}  [${r.p.src}]`));
console.log('--- READ-ONLY (anon can read all rows) ---');
rows.filter(r => !r.isWrite).forEach(r =>
  console.log(`  [${r.p.for.toUpperCase()}] ${r.t}."${r.p.name}"  TO=${r.p.to || 'PUBLIC (no TO clause)'}  [${r.p.src}]`));
console.log(`\nwrite-capable=${rows.filter(r => r.isWrite).length}  read-only=${rows.filter(r => !r.isWrite).length}`);

// sensitive columns on those write-capable tables
const SENS = /ip|user_agent|email|address|shipping|phone|stripe|ccbill|claim_code|token|secret|dob|birth|payout|amount|balance|credit/i;
console.log('\n=== SENSITIVE COLUMNS ON PERMISSIVE TABLES ===');
[...new Set(rows.map(r => r.t))].forEach(t => {
  const cols = Object.keys(s.tables[t].columns).filter(c => SENS.test(c));
  if (cols.length) console.log(`  ${t}: ${cols.join(', ')}`);
});
