# ASD-Edge-ST Product Design

## Product promise

ASD-Edge-ST helps a Tamil-speaking child practise one speech target at a time, receive calm and specific feedback, and share progress—not raw voice by default—with the adults supporting them. It is an assistive practice and review tool, not a diagnostic device or replacement for a speech-language pathologist.

The design is grounded in the [market research](research/market-research.md): short imitation loops from child speech apps, separated family/clinician modes from ASD and AAC products, hierarchical sound feedback from pronunciation platforms, offline school–home continuity from Indian learning products, and local processing from edge-speech runtimes.

## Roles

| Role | Primary job | Product surface | Data boundary |
|---|---|---|---|
| Child | Complete one predictable practice activity | `/play`, `/therapy/:lessonId` | Cannot manage accounts, consent, exports, caseloads, or admin data |
| Parent / caregiver | Set up the child, consent to processing, schedule practice, understand progress | `/dashboard`, `/parent`, `/settings`, `/reports` | Own child profile; controls recording retention and sharing |
| Clinician / therapist | Assign children, inspect phoneme evidence, add notes, choose next practice | `/therapist` | Assigned children only; raw audio only when separately consented |
| Admin / research | Manage users/content/model health and de-identified operations | `/admin` | Explicit admin role; research exports must be de-identified |

The existing `user` role represents the caregiver account plus its child profile. The child enters a simplified practice mode inside that account. Separate `therapist` and `admin` identities receive restricted workspaces.

## Core flows

### Caregiver onboarding

1. Choose “Parent / caregiver”.
2. Create the adult account and child profile; Tamil is the default language.
3. Review a plain-language voice-data notice.
4. Choose local processing (default) and whether raw recordings may be retained/shared. Declining raw-audio storage does not block practice.
5. Select sensory defaults: sound, autoplay, celebration intensity, reduced motion.
6. Arrive at the caregiver dashboard with “Start practice” as the primary action.

### Therapist onboarding

1. Choose “Therapist”.
2. Create a therapist account; production deployments require admin verification before caseload access.
3. Assign an existing child by caregiver email or accept a caregiver invitation.
4. Arrive at the caseload sorted by need, never by a public leaderboard.

### Child practice

```text
Ready → Listen → Watch placement → Record → Private processing → One calm feedback cue → Finish or try once more
```

- One primary action is visible at a time.
- Recording never begins automatically.
- A visual schedule stays in a fixed location.
- The target remains visible in Tamil script, with optional transliteration.
- Feedback names one successful element and at most one next action.
- The result exposes score provenance (`local`, `server_indicconformer`, `server_asr`, or `server_gop`) to adults, not as distracting child-facing chrome.

### Clinician review and annotation

1. Open a child in the caseload.
2. Review trend, attempts, strongest and weakest target, GOP/phoneme details, validation source and last activity.
3. Add a dated clinical note with a next-practice cue.
4. The caregiver sees the note as guidance; the child sees only the assigned activity.
5. Export a report containing scores, targets, provenance and notes; audio is excluded unless consent explicitly permits it.

### Privacy control

1. Caregiver opens Settings → Voice & privacy.
2. See processing location, purpose, retention duration and sharing state.
3. Change optional recording retention/sharing independently.
4. Export held data or request account deletion.
5. Consent history remains append-only for audit; the current state is easy to read.

## Information architecture

```text
Public
├── Home
├── Sign in
├── Parent / caregiver registration
└── Therapist registration

Caregiver account
├── Overview
├── Practice
│   ├── Guided Tamil lessons
│   ├── Low-sensory play activities
│   └── Assessment
├── Progress
│   ├── Speech analysis
│   ├── History
│   └── Reports
├── Care team
│   ├── Parent hub
│   ├── Appointments
│   └── Therapist notes
└── Account
    ├── Profile
    ├── Sensory settings
    ├── Voice & privacy
    └── Help

Therapist
├── Caseload
├── Child detail
├── Clinical notes
└── Assignments

Admin
├── Users and roles
├── Curriculum/content
├── Model/service health
├── Consent/deletion operations
└── De-identified research metrics
```

## ASD-specific interaction rules

- Navigation order and control placement stay stable.
- Minimum touch target is 44 × 44 CSS pixels, with larger recording controls.
- Background motion is absent by default; all motion respects `prefers-reduced-motion`.
- Audio, video and celebrations never autoplay unless the caregiver enables them.
- No timers that create pressure, public rankings, streak loss, flashing effects, surprise overlays, or negative error sounds.
- Color is redundant with label/icon/state text and never carries meaning alone.
- Progress language is neutral: “practising”, “ready to try again”, and “focus sound”; never “failed”, “bad”, or diagnostic language.
- Tamil script is the primary target presentation; transliteration and English explanation are optional aids.

## Accessibility target

The target is WCAG 2.1 Level AA across public, caregiver, therapist and admin surfaces:

- semantic landmarks and heading order;
- full keyboard navigation and visible focus;
- status and recording changes announced through live regions;
- contrast at AA thresholds, with non-color state indicators;
- responsive reflow at 320 CSS pixels;
- captions/transcripts for authored video and audio examples;
- user-controlled sound/motion/autoplay; and
- form errors associated with inputs and summarized clearly.

Automated accessibility checks are a regression net, not a conformance claim; keyboard, screen-reader, zoom/reflow, and cognitive walkthroughs remain required before clinical launch.

## Content and clinical safety

- Clinician-authored Tamil targets are versioned.
- Automated scores are labelled as practice estimates with validation source and timestamp.
- Low-confidence or unavailable recognizers cannot silently award a pass.
- Caregivers and clinicians can correct/annotate an attempt without rewriting raw model output.
- Every child-facing error has a safe retry or exit path.
- Research exports use pseudonymous identifiers and never include names, emails or audio by default.

## Success criteria

- A first-time caregiver can register, set consent and start a Tamil practice in under five minutes.
- A child can complete the practice loop without reading long instructions.
- A clinician can identify the weakest target and record the next cue in under one minute.
- Practice remains available when cloud scoring is unavailable; the UI accurately reports the fallback or unavailable state.
- No raw voice recording is retained or shared unless its specific consent is active.
