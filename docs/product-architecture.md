# Sportfolio product architecture

## Product decision

The app optimises for useful evidence in 5–10 seconds during a PE lesson. It is not an assessment spreadsheet and it is not a social network. Evidence is private by default and media is the primary interface.

## Screen map

| Area | Primary job | V1 |
|---|---|---|
| Teacher Home | See next lesson, coverage blind spots and reflection queue | Yes |
| Classes | Find pupils quickly and view evidence coverage | Yes |
| Quick Capture | Record or select media, choose multiple pupils, tap tags and save | Yes |
| Pupil Sportfolio | Review visual learning timeline, goals and reflections | Yes |
| Evidence detail | Playback, feedback and reflection response | Yes |
| Student view | Only the signed-in student's own portfolio | Yes |
| Admin | Manage people, tags, activities and archive/export | Foundation only |

## Critical flow

1. Teacher opens the already-selected Grade 5A class.
2. Teacher records a 12-second video.
3. Teacher taps four pupil faces.
4. Teacher taps `Basketball`, `Decision Making` and `SHOW`.
5. Teacher saves. A portfolio item is created once, with four private pupil links.
6. Later, the teacher requests a reflection. Each selected pupil can add text or voice.

## Permissions

| Actor | Can access |
|---|---|
| Student | Their own profile, items shared with them, own reflections/goals |
| Teacher | Classes they teach, members, attached evidence and review queue |
| School admin | Entire school tenant, configuration and archive/export |
| Parent (future) | Only teacher-published items for linked child |

Every query is constrained by `school_id`; every portfolio item is constrained by membership and an item-to-student link. No user role is inferred from editable profile metadata.

## Implementation sequence

1. Validate prototype with 3–5 HIBA PE teachers using the exact Grade 5A capture task.
2. Create Supabase project, apply migration, private media bucket and tested RLS policies.
3. Add sign-in and seed a staff-only pilot school.
4. Replace mock capture with camera/upload, resumable upload status and multi-pupil item links.
5. Add student portal, text/voice reflections and teacher review queue.
6. Pilot one class before importing school-wide data.

## Non-negotiable safeguards

- Private bucket and short-lived signed media URLs.
- No public pupil profiles.
- Audit important publish, export and delete operations.
- Explicit retention, archive and permanent-deletion actions.
- No pupil media or metadata used for training AI models.
