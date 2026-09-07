# Build log: Mobile Open Sportfolio fix

Date: 2026-09-07

## Completed
- Fixed mobile landing-page `Open Sportfolio` interactions that could fail to navigate reliably.
- Mobile taps on existing `/live` entry CTAs now route explicitly into `/live/session`, the primary teacher Capture Studio.
- Added touch/pointer protection so decorative landing layers cannot intercept the mobile CTA.
- Desktop `/live` navigation remains unchanged.

## Verified
- PR #8 TypeScript check passed.
- PR #8 production build passed.
- PR #8 merged to `main` as `b9e3f159728ed57577f7f6036004570630c574a2`.
- Production Vercel deployment completed successfully.

## Next
- Continue mobile/iPad QA across the teacher entry, class selection, Session Capture, Review and pupil Sportfolio paths.
