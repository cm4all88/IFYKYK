const fs = require('fs');
const path = require('path');
const DIR = path.resolve(__dirname, '..');
const j = JSON.parse(fs.readFileSync(path.join(DIR, 'AUDIT_EVIDENCE.json'), 'utf8'));

const out = [];
out.push('# Findings');
out.push('');
out.push('Every finding with severity, file, line, evidence, impact and recommended fix.');
out.push('Machine-readable equivalent: `AUDIT_EVIDENCE.json`.');
out.push('');
out.push('| Severity | Count |');
out.push('|---|---|');
const counts = {};
j.findings.forEach(f => counts[f.severity] = (counts[f.severity] || 0) + 1);
['critical', 'high', 'medium', 'low'].forEach(s => out.push('| ' + s + ' | ' + (counts[s] || 0) + ' |'));
out.push('| **total** | **' + j.findings.length + '** |');
out.push('');
out.push('**Verification levels**');
out.push('');
out.push('- **CONFIRMED** — proven by comparing code against committed SQL and/or generated types. No runtime access needed.');
out.push('- **CONFIRMED-SCHEMA-DIVERGENCE-RISK** — proven against every schema artifact in the repository, but the live database has documented out-of-band drift. One SQL query confirms or clears it.');
out.push('- **RISK** — requires runtime or configuration verification to confirm exploitability.');
out.push('');

const bySev = {};
j.findings.forEach(f => (bySev[f.severity] = bySev[f.severity] || []).push(f));

for (const sev of ['critical', 'high', 'medium', 'low']) {
  const list = bySev[sev] || [];
  out.push('');
  out.push('---');
  out.push('');
  out.push('## ' + sev.toUpperCase() + ' (' + list.length + ')');
  out.push('');
  for (const f of list) {
    out.push('### ' + f.id + ' — ' + f.title);
    out.push('');
    out.push('**Severity:** ' + f.severity + ' · **Category:** ' + f.category + ' · **Verification:** ' + f.verification);
    out.push('');
    out.push('**Location:** `' + f.file + (f.line ? ':' + f.line : '') + '`');
    out.push('');
    out.push('**Evidence**');
    out.push('');
    out.push('```');
    out.push(f.evidence);
    out.push('```');
    out.push('');
    out.push('**Detail** — ' + f.detail);
    out.push('');
    out.push('**Impact** — ' + f.impact);
    out.push('');
    out.push('**Fix** — ' + f.recommendation);
    out.push('');
  }
}
fs.writeFileSync(path.join(DIR, 'FINDINGS.md'), out.join('\n'));
console.log('FINDINGS.md:', out.length, 'lines,', j.findings.length, 'findings');
