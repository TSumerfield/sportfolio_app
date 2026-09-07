const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const mode = process.argv[2] ?? 'check';
const rootTarget = process.env.SPORTFOLIO_ROOT_TARGET?.trim() || '0d22fe3c2f9ad714.vercel-dns-017.com';
const wwwTarget = process.env.SPORTFOLIO_WWW_TARGET?.trim() || rootTarget;

if (!token || !zoneId) {
  console.error('Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID');
  process.exit(2);
}
if (!['check', 'fix'].includes(mode)) {
  console.error('Usage: node scripts/ops/cloudflare-dns.mjs [check|fix]');
  process.exit(2);
}

const base = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function cf(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers ?? {}) } });
  const body = await res.json();
  if (!res.ok || body.success === false) throw new Error(JSON.stringify(body.errors ?? body));
  return body;
}

async function list(name) {
  const body = await cf(`${base}?name=${encodeURIComponent(name)}&per_page=100`);
  return body.result;
}

async function remove(id) {
  await cf(`${base}/${id}`, { method: 'DELETE' });
}

async function create(name, target) {
  await cf(base, {
    method: 'POST',
    body: JSON.stringify({ type: 'CNAME', name, content: target, ttl: 1, proxied: false }),
  });
}

async function ensureCname(name, target) {
  const records = await list(name);
  const relevant = records.filter((r) => ['A', 'AAAA', 'CNAME'].includes(r.type));
  const correct = relevant.find((r) => r.type === 'CNAME' && r.content === target && r.proxied === false);
  const conflicts = relevant.filter((r) => !correct || r.id !== correct.id);

  if (mode === 'check') {
    return { name, target, correct: Boolean(correct), records: relevant.map(({ id, type, name, content, proxied }) => ({ id, type, name, content, proxied })) };
  }

  for (const record of conflicts) await remove(record.id);
  if (!correct) await create(name, target);
  return { name, target, fixed: true };
}

const results = [];
results.push(await ensureCname('mysportfolio.net', rootTarget));
results.push(await ensureCname('www.mysportfolio.net', wwwTarget));

console.log(JSON.stringify({ mode, zoneId, results }, null, 2));
if (mode === 'check' && results.some((r) => r.correct === false)) process.exitCode = 1;
