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

function fetchBody(url, redirects = 0) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'GET', timeout: 10000, headers: { 'user-agent': 'sportfolio-ops/1.0', 'cache-control': 'no-cache' } }, (res) => {
      const status = res.statusCode ?? 500;
      const location = res.headers.location;
      if (status >= 300 && status < 400 && location && redirects < 5) {
        res.resume();
        const next = new URL(location, url).toString();
        resolve(fetchBody(next, redirects + 1));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ url, finalUrl: url, ok: status < 500, status, body }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (error) => resolve({ url, ok: false, error: error.message, body: '' }));
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

const [apexPage, wwwPage] = await Promise.all([
  fetchBody('https://mysportfolio.net/'),
  fetchBody('https://www.mysportfolio.net/'),
]);

const landingMarker = 'Make learning in movement';
const loginMarker = 'Sign in to Sportfolio';
const contentChecks = [apexPage, wwwPage].map((page) => ({
  url: page.url,
  finalUrl: page.finalUrl,
  status: page.status,
  hasLandingMarker: page.body?.includes(landingMarker) ?? false,
  hasLoginFormMarker: page.body?.includes('Send secure sign-in link') ?? false,
}));

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), dns: dnsResults, http: webResults, content: contentChecks }, null, 2));

const rootOk = webResults.find((r) => r.url === 'https://mysportfolio.net/')?.ok;
const sessionOk = webResults.find((r) => r.url === 'https://mysportfolio.net/live/session')?.ok;
const reviewOk = webResults.find((r) => r.url === 'https://mysportfolio.net/live/review')?.ok;
const landingOk = contentChecks.every((r) => r.hasLandingMarker && !r.hasLoginFormMarker);
if (!dnsResults.find((r) => r.host === 'mysportfolio.net')?.ok || !rootOk || !sessionOk || !reviewOk || !landingOk) {
  process.exitCode = 1;
}
