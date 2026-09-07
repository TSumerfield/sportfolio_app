# Sportfolio Agent Operations

This repository is designed so an autonomous coding agent can diagnose and repair the production app without needing a human to shuttle screenshots between services.

## Production control plane

- GitHub: source, CI and controlled operational workflows
- Vercel: production deployment and custom domains
- Supabase: auth, Postgres, private storage and RLS
- Cloudflare: DNS for `mysportfolio.net`

## Safety boundary

Cloudflare credentials must be least-privilege and scoped only to the `mysportfolio.net` zone. Never use a Global API Key. The DNS operator in this repository only touches A, AAAA and CNAME records for `mysportfolio.net` and, when explicitly configured, `www.mysportfolio.net`. It does not touch MX, SPF, DKIM or verification TXT records.

DNS mutation is only allowed through the manual `Sportfolio Production Ops` workflow using operation `dns-fix` and exact confirmation text `FIX_MYSPORTFOLIO_DNS`.

## One-time GitHub configuration

Add repository secrets:

- `CLOUDFLARE_API_TOKEN`: Cloudflare API token scoped to Zone DNS Edit for `mysportfolio.net`
- `CLOUDFLARE_ZONE_ID`: Cloudflare zone ID for `mysportfolio.net`

Add repository variables:

- `SPORTFOLIO_ROOT_TARGET`: `0d22fe3c2f9ad714.vercel-dns-017.com`
- `SPORTFOLIO_WWW_TARGET`: exact Vercel-provided DNS target for `www.mysportfolio.net` once known. Leave unset until verified in Vercel.

Do not store Vercel or Supabase service-role credentials in client code.

## Agent operating sequence

For a production incident:

1. Inspect the latest GitHub commit, CI run and Vercel deployment status.
2. Run `node scripts/ops/production-health.mjs` or the `health` operation in `Sportfolio Production Ops`.
3. If DNS is implicated, run `dns-check` first.
4. Compare Cloudflare state with the exact Vercel DNS target. Never invent or infer a truncated target.
5. Only if the mismatch is confirmed, run `dns-fix` with the required confirmation.
6. Re-run production health and verify the public domain over HTTPS.
7. For app changes, run the production build and functional checks, deploy, then verify the deployed capability.
8. Update the concise build log with completed, verified, blocked and next.

## Production health checks

`scripts/ops/production-health.mjs` checks:

- public DNS for `mysportfolio.net`
- public DNS for `www.mysportfolio.net`
- HTTPS response for the root domain
- legacy `/login` route availability
- Vercel production URL availability

The scheduled GitHub workflow runs this health check every six hours.

## GrokBot / external agent rule

Prefer giving the agent GitHub access and letting it trigger these guarded workflows rather than giving it broad raw infrastructure credentials. If direct Cloudflare API access is used, retain the same least-privilege zone restriction and never grant account-wide DNS access.
