import dns from 'node:dns/promises';
import https from 'node:https';

const hosts = ['mysportfolio.net', 'www.mysportfolio.net'];

async function resolve(host) {
  try {
    const [a, aaaa, cname] = await Promise.all([
      dns.resolve4(host).catch(() => []),
      dns.resolve6(host).catch(() => []),
      dns.resolveCname(host).catch(() => []),
    ]);
    return { host, ok: a.length + aaaa.length + cname.length > 0, a, aaaa, cname };
  } catch (error) {
    return { host, ok: false, error: error.message };
  }
}

function fetchHead(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', timeout: 10000, headers: { 'user-agent': 'sportfolio-ops/1.0' } }, (res) => {
      resolve({ url, ok: (res.statusCode ?? 500) < 500, status: res.statusCode, location: res.headers.location ?? null });
      res.resume();
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (error) => resolve({ url, ok: false, error: error.message }));
    req.end();
  });
}

const dnsResults = await Promise.all(hosts.map(resolve));
const webResults = await Promise.all([
  fetchHead('https://mysportfolio.net/'),
  fetchHead('https://mysportfolio.net/login'),
  fetchHead('https://mysportfolio.net/live/session'),
  fetchHead('https://mysportfolio.net/live/review'),
  fetchHead('https://sportfolio-app-b1gc.vercel.app/'),
]);

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), dns: dnsResults, http: webResults }, null, 2));

const rootOk = webResults.find((r) => r.url === 'https://mysportfolio.net/')?.ok;
const sessionOk = webResults.find((r) => r.url === 'https://mysportfolio.net/live/session')?.ok;
const reviewOk = webResults.find((r) => r.url === 'https://mysportfolio.net/live/review')?.ok;
if (!dnsResults.find((r) => r.host === 'mysportfolio.net')?.ok || !rootOk || !sessionOk || !reviewOk) {
  process.exitCode = 1;
}
