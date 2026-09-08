# Build log: Pilot release gate

Date: 2026-09-08

## Completed
- Added invite-only pilot access backed by `sportfolio_pilot_access` RLS.
- Restored secure passwordless magic-link sign-in and role-aware callback routing.
- Added first-time teacher setup for up to five classes.
- Added roster creation during class setup and pupil additions to existing classes.
- Enforced the five-class pilot limit server-side with an authenticated trigger.
- Added teacher ownership for created pupil records and RLS for teacher-managed pilot rosters.
- Enforced the 10-second pilot video limit in Session Capture while preserving the selected clip when validation fails.
- Kept Session Capture offline queue/retry behavior intact.

## Verified
- Supabase `sportfolio-media` remains private.
- All current `sportfolio_*` tables have RLS enabled.
- Existing teacher emails were retained as active pilot access entries.
- Unapproved authenticated users see no teacher classes or pilot allowlist rows and cannot create a class.
- A sixth class is rejected server-side.
- TypeScript and production build passed for each coherent milestone.
- Vercel deployment succeeded for onboarding, video guardrail and pupil-addition milestones.
- Production DNS/HTTPS health was green before the release changes; latest Vercel commit status is green.
- Supabase security advisor reports no Sportfolio RLS/schema vulnerability; only password leaked-password protection warning remains, which is not used by the magic-link-only pilot.

## Deliberately deferred / needs device verification
- Final authenticated magic-link journey must still be exercised manually on an actual iPad/email client because this environment cannot receive the pilot magic-link email or retain the authenticated browser session.
- Classic `/live` capture remains available, but Session Capture is the supported pilot courtside capture path and contains the enforced 10-second video guard.
- Reflection account provisioning for pupils is not part of the first teacher-only access handoff.

## Next
- Run one real-device teacher smoke test: magic link → setup → class/pupils → Session Capture → save → Review/Sportfolio.
- Fix any issue found before distributing pilot access externally.
