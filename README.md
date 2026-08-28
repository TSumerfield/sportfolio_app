# Sportfolio

**Capture progress. Reflect. Improve.**

Sportfolio is a PE-first, private student portfolio platform. It is deliberately built around a teacher's real field-side workflow:

`CAPTURE → TAG → REFLECT → TRACK → CELEBRATE`

## Current prototype

The clickable V0.1 experience includes Teacher Home, Grade 5A class cards, a multi-pupil Quick Capture workflow, a student portfolio timeline and a reflection detail view. It uses realistic HIBA demo data and is fully responsive.

## Product boundaries

- V1: evidence capture, multi-pupil tagging, notes/voice notes, student reflection, goals, search and evidence coverage.
- V1.5: comparison, highlights, export and parent access.
- Later: curriculum mapping, annotation and AI assistance.

There are no public pupil portfolios, pupil-to-pupil browsing or AI use of pupil data.

## Stack

Next.js, TypeScript, Tailwind-ready styling and Supabase (Auth, PostgreSQL, Storage and RLS). The included prototype is intentionally mock-data only until a dedicated Supabase project and safeguarding setup are approved.

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` before connecting Supabase.

## Core schema and security

The initial relational database migration is in `supabase/migrations/20260828100000_initial_schema.sql`. It creates school-scoped, role-aware entities. RLS must remain enabled on every exposed table; media objects belong in private Storage buckets and are served only by time-limited signed URLs.

See `docs/product-architecture.md` for the screen map, permissions, user flows and implementation phases.
