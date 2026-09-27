// True when the app is running on a developer / test / verification machine
// rather than a deployed site. Deployed builds (Vercel production and preview)
// are served from a public hostname, so they are never treated as local.
const LOCAL_HOST = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[?::1\]?|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|.+\.local|.+\.localhost)$/i;

export function isLocalRuntime(): boolean {
  if (typeof window !== "undefined") return LOCAL_HOST.test(window.location.hostname);
  // Server side: only a Vercel deployment counts as deployed.
  return process.env.VERCEL !== "1";
}

// Vercel exposes this to the browser by default; absent elsewhere.
export function isNonProductionDeployment(): boolean {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV;
  return Boolean(env) && env !== "production";
}
