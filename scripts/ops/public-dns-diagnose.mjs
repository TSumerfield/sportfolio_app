const domain = 'mysportfolio.net';
const queries = [
  ['NS', domain],
  ['A', domain],
  ['CNAME', domain],
  ['A', `www.${domain}`],
  ['CNAME', `www.${domain}`],
];

async function google(name, type) {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}&cd=0&do=1`;
  const res = await fetch(url, { headers: { accept: 'application/dns-json', 'user-agent': 'sportfolio-ops/1.0' } });
  const body = await res.json();
  return {
    resolver: 'google',
    name,
    type,
    httpStatus: res.status,
    dnsStatus: body.Status,
    authenticData: body.AD,
    answer: (body.Answer ?? []).map((r) => ({ name: r.name, type: r.type, ttl: r.TTL, data: r.data })),
    authority: (body.Authority ?? []).map((r) => ({ name: r.name, type: r.type, ttl: r.TTL, data: r.data })),
    comment: body.Comment ?? null,
  };
}

async function cloudflare(name, type) {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
  const res = await fetch(url, { headers: { accept: 'application/dns-json', 'user-agent': 'sportfolio-ops/1.0' } });
  const body = await res.json();
  return {
    resolver: 'cloudflare',
    name,
    type,
    httpStatus: res.status,
    dnsStatus: body.Status,
    authenticData: body.AD,
    answer: (body.Answer ?? []).map((r) => ({ name: r.name, type: r.type, ttl: r.TTL, data: r.data })),
    authority: (body.Authority ?? []).map((r) => ({ name: r.name, type: r.type, ttl: r.TTL, data: r.data })),
    comment: body.Comment ?? null,
  };
}

const results = [];
for (const [type, name] of queries) {
  for (const resolver of [google, cloudflare]) {
    try {
      results.push(await resolver(name, type));
    } catch (error) {
      results.push({ resolver: resolver.name, name, type, error: error.message });
    }
  }
}

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));

const apexA = results.filter((r) => r.name === domain && r.type === 'A');
if (!apexA.some((r) => r.dnsStatus === 0 && r.answer?.length)) process.exitCode = 1;
