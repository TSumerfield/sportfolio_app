# Sportfolio build log — 2026-09-03

## Completed
- Root homepage routes to the live authenticated Sportfolio workspace.
- Each class now exposes two explicit primary actions: Capture and View Sportfolio.
- Class Sportfolio shows pupil entry points plus all class evidence in one timeline.
- Pupil Sportfolio shows all saved evidence for that pupil.
- After a successful capture, the teacher can jump directly to the class Sportfolio.

## Verified
- Pending CI production build and deployment check.

## Blocked
- Custom-domain behaviour still needs verification against mysportfolio.net after deployment because the user's screenshots showed an older UI/auth callback than the current repository code.

## Next
- Verify the deployed domain serves this build and test class → Sportfolio → pupil → evidence → capture on iPhone/iPad.
