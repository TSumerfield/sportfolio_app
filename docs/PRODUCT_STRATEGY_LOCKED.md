# Sportfolio Product Strategy — Locked

Status: LOCKED
Date: 2026-09-07

## Product thesis

Sportfolio captures fleeting evidence of physical learning and converts it into durable teacher memory, better attention, stronger professional judgement and evidence-backed outputs.

Public message:

> Notice every pupil. Remember their progress. Know what comes next.

Buyer message:

> Better evidence. Better assessment. Less reconstruction at report time.

Sportfolio is not a portfolio-first product. The portfolio is one output of a broader PE learning memory and attention system.

## Core jobs

Sportfolio must help a PE teacher:

1. Notice the right pupil.
2. Capture the important moment with almost no friction.
3. Remember what matters across lessons.
4. Prioritise who or what needs attention next.
5. Confirm professional judgement.
6. Turn accumulated evidence into useful outputs without duplicate work.

## Core loop

SET CONTEXT → NOTICE → CAPTURE → REMEMBER → PRIORITISE → ACT → REVISIT

The compounding learning loop is:

Evidence → pupil → activity → learning outcome → teacher observation → teacher-confirmed judgement → next learning step → future attention priority → new evidence → subsequent outcome → teacher correction → better future recommendation.

## Product rules

1. Routine lesson capture target is under 10 seconds.
2. Every recurring input must either improve future teacher judgement or remove future teacher work.
3. Sportfolio should tell the teacher what deserves attention, not merely display historical data.
4. Teacher professional judgement remains authoritative.
5. Context is set once where possible and inherited across captures.
6. One learning outcome is the default per capture; additional outcomes are optional, not the primary path.
7. Photo, short video and quick observation are evidence modes. No single media type is mandatory.
8. Capture and professional review are separate modes. Courtside capture stays lightweight; deeper judgement happens after or between lessons.
9. Privacy and safeguarding are architectural requirements, not optional UI features.
10. No feature ships merely because it is impressive. It must improve capture, memory, attention, judgement, workload or learning.

## Product layers

### 1. Capture

Preserve meaningful learning moments with almost zero friction.

Primary model: context-first Session Capture.

Teacher sets class, activity and 1–3 likely learning outcomes once. Subsequent captures inherit that context.

Routine flow:

Capture → pupil(s) → outcome → save

Target: under 10 seconds.

### 2. Memory

Sportfolio remembers what the teacher cannot reliably hold across dozens of pupils and lessons:

- evidence history
- observations
- learning outcomes
- previous teacher judgement
- current learning direction
- reflection history
- progress over time

### 3. Attention

Sportfolio converts memory into action.

Examples:

- pupils not observed recently
- stale learning targets
- current outcome coverage gaps
- pupils whose previous next step needs revisiting
- evidence gaps across a class

This layer creates weekly value and must avoid becoming a generic analytics dashboard.

### 4. Judgement

Teacher confirms learning decisions using concise actions such as:

Keep | Refine | Complete | Replace

Teacher corrections are stored as high-value professional judgement data.

### 5. Outputs

The same structured evidence should support, without duplicate data entry:

- pupil portfolio
- assessment support
- report summaries
- parent conference evidence
- moderation evidence
- handover information

Reports are a major periodic payoff, but not the sole wedge or daily reason to use Sportfolio.

### 6. Intelligence

Current priority is deterministic intelligence, not generative AI.

NOW:

- evidence-age alerts
- observation coverage gaps
- stale next-step alerts
- outcome coverage gaps
- attention prioritisation

LATER:

- teacher-in-the-loop suggested next steps
- evidence-backed summary assistance
- curriculum and programme patterns

Teacher-in-loop rule:

Suggestion → Accept / Edit / Ignore → teacher judgement stored → later evidence tests the judgement → future suggestions improve.

AI never owns the educational judgement.

## What not to build now

Do not prioritise:

- generic dashboards
- parent social feeds
- pupil-to-pupil browsing
- public profiles or public media URLs
- autonomous grading
- face recognition for pupil identification
- school-to-school pupil comparisons
- elaborate gamification
- generic AI chatbots
- large curriculum taxonomies that slow courtside capture
- inspection-first workflows
- horizontal expansion into other subjects before PE is proven

## Safeguarding principles

- Supabase Auth, Postgres, private Storage and RLS.
- Private `sportfolio-media` bucket.
- Signed media URLs only.
- Strict tenant and class isolation.
- No service-role keys in client code.
- No AI training on identifiable pupil media by default.
- No face recognition for pupil tagging.
- Failed uploads preserve local selections and provide obvious retry.
- Shared-device session leakage, incorrect tagging, retention/deletion, export and consent must be explicitly handled.

## Pilot truth test

The existential question is:

> Can a teacher repeatedly capture useful structured evidence inside a real PE lesson in under ten seconds without reducing teaching quality?

Primary pilot metrics:

- median routine capture time
- weekly active teachers
- captures per lesson
- percentage of pupils meaningfully evidenced over a rolling period
- week-4 and week-8 retention
- teacher-reported time added or saved
- report/assessment preparation time before vs after
- number of teacher decisions materially improved by the accumulated evidence

Do not optimise for raw upload counts or vanity engagement.

## Immediate build sequence

### P0 — Session Capture

- Set class/activity/learning context once.
- Context persists across rapid captures.
- Photo, short video and quick note.
- Multi-pupil tagging.
- One-tap primary outcome.
- Secure save with offline durability.
- Immediate haptic/visual Saved or Queued acknowledgement without modal interruption.
- Routine capture target under 10 seconds.

### P0 — Attention Engine

- Who has not been seen recently?
- Which next steps are stale?
- Which pupils lack evidence against today's learning focus?
- Which pupils deserve attention next?

The UI should be a subtle courtside cue, not a dashboard.

### P1 — Post-Lesson Review

- Short queue of evidence needing professional judgement.
- Keep / Refine / Complete / Replace.
- Store teacher-confirmed decisions and corrections.

### P1 — Evidence-Backed Summary

- Assemble evidence, outcomes, teacher notes and confirmed next steps into an auditable pupil summary.
- Teacher edits and approves.
- Avoid unsupported AI-generated claims.

### P1 — Head of PE Coverage

- Actionable coverage visibility across classes.
- No generic SaaS dashboard expansion.

### P2

- Selective pupil reflection.
- Carefully scoped parent/termly summary if pilot evidence supports it.

### Later

- Teacher-in-loop AI next-step suggestions.
- Report-language assistance.
- Curriculum intelligence.
- Department and programme patterns.
- Privacy-preserving benchmark intelligence where justified.

## Strategic moat

The defensible asset is not the capture UI, storage or generic AI.

The compounding asset is:

> Structured longitudinal evidence linked to teacher-confirmed educational judgement and subsequent outcomes.

Over time, Sportfolio becomes the institutional learning memory for physical education.

## Product principle

Build for the teacher in motion.

Less remembering. More noticing. Better teaching. Clearer evidence.

If a proposed feature does not strengthen that outcome, subtract it.
