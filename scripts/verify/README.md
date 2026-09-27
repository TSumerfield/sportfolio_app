# Roster-import verifier

`npm run verify:roster` proves one journey end to end, with no human checking:
paste a fictional roster into the real `/live/setup` page, then confirm in
Postgres that the pupils, class links and transformed fields were saved, then
confirm `/live/session` renders them after a fresh load, then delete all
synthetic state. Prints `VERIFY PASS|FAIL`; `--json` for machine output.
Exit 0 pass, 1 fail, 2 environment error.

Runs entirely on 127.0.0.1: throwaway Postgres cluster, the repo's
`supabase/migrations/`, PostgREST, a tiny Supabase-shaped gateway, a
production build of the app, headless Chrome. Any browser request to a
non-local host is blocked (production Supabase, PostHog and fonts are never
contacted). No production credentials are used or needed.

Needs: Postgres 17 binaries (`PG_BIN`, default `/usr/lib/postgresql/17/bin`),
PostgREST 12+ (`POSTGREST_BIN`), Chrome (`CHROME_BIN`), Node 20+, `npm ci`.

Known differences from production:
- `reconstructed-untracked-schema.sql`: the core `sportfolio_*` tables and
  the membership/tag policies are NOT in the repo migrations (created outside
  version control), so they are reconstructed. Replace with a schema-only dump
  of production to remove this gap.
- `supabase-shim.sql` stands in for Supabase's `auth`/`storage` schemas and
  roles; sign-in is a locally signed session, not GoTrue email OTP.
- Runs `next build` into `.next/` with local-only env; rebuild before any
  manual production-style run.

Production schema trigger (decided 2026-09-27; do it just in time, not before):
before the next material change that touches Supabase persistence or schema,
first obtain a structure-only representation of the production schema and the
relevant access policies (no pupil data, no secrets) and make this local
environment match it, replacing `reconstructed-untracked-schema.sql`.
