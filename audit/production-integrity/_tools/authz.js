// Phase 3: authentication / authorization inventory for every route handler,
// admin page, and server action.
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

const all = walk(path.join(ROOT, 'app')).filter(f => !f.includes('production-integrity'));
const routes = all.filter(f => /route\.ts$/.test(f));
const pages = all.filter(f => /page\.tsx$/.test(f));

function routeUrl(f) {
  return '/' + path.relative(path.join(ROOT, 'app'), f)
    .replace(/\\/g, '/')
    .replace(/\/route\.ts$/, '')
    .replace(/\/page\.tsx$/, '')
    .replace(/\((?:[^)]+)\)\//g, '');
}

const rows = [];
for (const f of [...routes, ...pages]) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const isRoute = /route\.ts$/.test(f);
  const methods = isRoute
    ? [...src.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)/g)].map(m => m[1])
    : ['PAGE'];

  const r = {
    file: rel,
    url: routeUrl(f),
    kind: isRoute ? 'route' : (rel.includes('/admin/') ? 'admin-page' : 'page'),
    methods,
    getUser: /auth\.getUser\s*\(/.test(src),
    getSession: /auth\.getSession\s*\(/.test(src),
    isAdmin: /\bisAdmin\s*\(/.test(src),
    serviceClient: /createServiceClient\s*\(/.test(src),
    anonClient: /\bcreateClient\s*\(/.test(src),
    cronSecret: /CRON_SECRET|x-cron-secret/i.test(src),
    webhookSig: /verifyWebhook|verifyStripeSignature|createHmac|timingSafeEqual/.test(src),
    serverAction: /["']use server["']/.test(src),
    useClient: /^["']use client["']/m.test(src),
    // ownership signals
    scopedByUser: /\.eq\(\s*["']user_id["']\s*,\s*(user\.id|uid|session)/.test(src)
      || /\.eq\(\s*["']fan_user_id["']\s*,\s*(user\.id|uid)/.test(src)
      || /\.eq\(\s*["']creator_profile_id["']\s*,\s*(profile|creator)/.test(src),
    // request-supplied ids used in filters
    bodyIdInFilter: /\.eq\(\s*["']id["']\s*,\s*(body|params|searchParams|req)/.test(src)
      || /\.eq\(\s*["'](creator_profile_id|user_id|fan_user_id|post_id|product_id|listing_id|thread_id)["']\s*,\s*[a-zA-Z]*(Id|id)\b/.test(src),
    writes: /\.(insert|update|upsert|delete)\s*\(/.test(src),
    reads: /\.select\s*\(/.test(src),
    notFound: /notFound\s*\(/.test(src),
    redirectLogin: /redirect\(\s*["']\/login/.test(src),
    returns401: /401/.test(src),
    returns403: /403/.test(src),
    dynamic: (src.match(/export const dynamic\s*=\s*["'](\w+)["']/) || [])[1] || null,
    runtime: (src.match(/export const runtime\s*=\s*["'](\w+)["']/) || [])[1] || null,
  };

  // classify auth method
  const auth = [];
  if (r.webhookSig) auth.push('webhook-signature');
  if (r.cronSecret) auth.push('cron-secret');
  if (r.getUser) auth.push('getUser()');
  if (r.getSession && !r.getUser) auth.push('getSession()');
  if (r.isAdmin) auth.push('isAdmin()');
  if (!auth.length) auth.push('NONE');
  r.auth = auth;

  // risk flags
  const risk = [];
  const isAdminPath = rel.includes('/admin/');
  if (isAdminPath && !r.isAdmin) risk.push('ADMIN-PATH-WITHOUT-isAdmin');
  if (r.serviceClient && !r.isAdmin && !r.webhookSig && !r.cronSecret) risk.push('SERVICE-ROLE-WITHOUT-GATE');
  if (r.getSession && !r.getUser) risk.push('getSession-not-getUser');
  if (isRoute && auth[0] === 'NONE' && r.writes) risk.push('UNAUTH-WRITE');
  if (isRoute && auth[0] === 'NONE' && r.reads) risk.push('UNAUTH-READ');
  if (r.useClient && r.serviceClient) risk.push('SERVICE-ROLE-IN-CLIENT-COMPONENT');
  r.risk = risk;
  rows.push(r);
}

fs.writeFileSync(path.join(__dirname, 'authz.json'), JSON.stringify(rows, null, 2));

const risky = rows.filter(r => r.risk.length);
console.log('total surfaces:', rows.length, '| routes:', routes.length, '| pages:', pages.length);
console.log('\n=== RISK FLAGS ===');
const byRisk = {};
risky.forEach(r => r.risk.forEach(x => { byRisk[x] = (byRisk[x] || 0) + 1; }));
console.log(JSON.stringify(byRisk, null, 2));

for (const k of Object.keys(byRisk)) {
  console.log(`\n--- ${k} ---`);
  risky.filter(r => r.risk.includes(k)).forEach(r => console.log(`  ${r.file}  [${r.methods.join(',')}] auth=${r.auth.join('+')}`));
}
