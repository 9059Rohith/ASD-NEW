# ASD-Edge-ST Visual Fidelity Ledger

## Evidence

- Accepted caregiver concept: [`docs/design/asd-edge-st-caregiver-dashboard-concept.png`](../design/asd-edge-st-caregiver-dashboard-concept.png), native 1536 × 1024.
- Accepted therapist concept: [`docs/design/asd-edge-st-therapist-review-concept.png`](../design/asd-edge-st-therapist-review-concept.png), native 1536 × 1024.
- Implemented caregiver capture: [`docs/qa/caregiver-dashboard-1536x1024.png`](caregiver-dashboard-1536x1024.png), native 1536 × 1024.
- Implemented therapist capture: [`docs/qa/therapist-review-1536x1024.png`](therapist-review-1536x1024.png), native 1536 × 1024.
- Responsive capture: [`docs/qa/caregiver-dashboard-390x844.png`](caregiver-dashboard-390x844.png), native 390 × 844.

The two accepted concepts and both final desktop captures were inspected with `view_image` at original resolution. Browser QA used `agent-browser` against the live Vite/FastAPI/MongoDB stack. The final pages contained meaningful snapshots, reported no page errors, had no Vite overlay, and had no horizontal viewport overflow.

## Point-by-point comparison

| # | Concept decision | Implemented result | Status / reason |
|---:|---|---|---|
| 1 | 252 px pale rail, white canvas, thin cool borders | Shared `DashboardLayout` uses a 252 px `#F7F9FD` rail, white canvas, and `#D6DDEB` rules | Matched |
| 2 | Indigo selection with a left rule and code-native Tamil mark | Both roles use the `அ` mark and a pale indigo selected navigation row with a left rule | Matched |
| 3 | Caregiver greeting plus one solid practice action and one text history action | “Start practice” and “View session history” retain the same hierarchy, sizes, and positions | Matched |
| 4 | Predictable Listen → Record → Review plan rail | Three numbered steps, dashed desktop connectors, and a stable single-column mobile sequence | Matched |
| 5 | Teal progress evidence with simple numeric summaries | Live Recharts trend, 76% seeded average, 12 sessions, and no decorative/fabricated metric | Matched; values are API-derived |
| 6 | Tamil focus targets and care-team guidance in the right column | Lowest lesson rollups appear first with Tamil script; the newest caregiver-visible therapist note appears below | Matched |
| 7 | Therapist evidence table beside a clinical-note editor | Target, accuracy, attempts, review signal, note, next target, visibility, and Save are aligned in a 2/3–1/3 workspace | Matched |
| 8 | Explicit privacy cue in clinical review | “Raw audio not retained” appears with a shield above last activity | Matched |
| 9 | Calm status language rather than failure labels | “Review next”, “Developing”, and “Stable” are used with redundant color/text encoding | Matched |
| 10 | Desktop layout collapses without horizontal scrolling | Caregiver actions, plan, evidence, and side column stack at 390 px; browser overflow assertion returned true | Matched |

## Intentional deviations

- The therapist concept showed three summary blocks; the implementation shows four because the existing analysis contract exposes four distinct, clinically useful values: accuracy, GOP clarity, sound match, and airflow. No value was invented or merged for visual symmetry.
- The concept’s fixed “6 recent sessions · Last active today” became live `total_sessions` and `last_active` values. The structure remains the same while the copy reflects stored evidence.
- “Kavi’s speech review” is rendered as an eyebrow “Speech review” plus the `Kavi` H1. This preserves a cleaner accessible heading and avoids a curly apostrophe inside the child name.
- Desktop clinician navigation includes the existing Reports, Appointments, Profile, Help, Feedback, and About routes because they are functional surfaces already present in the product. The concept’s hierarchy and selected Caseload state are retained.

## Interaction verification

1. Signed in as the deterministic therapist account.
2. Opened Kavi from the evidence-sorted caseload.
3. Saved a caregiver-visible note with a next target.
4. Signed out and signed in as the deterministic caregiver account.
5. Confirmed the new note appeared in the caregiver dashboard.
6. Reran the deterministic seed and confirmed the QA database returned to 1 note, 6 evaluations, and 3 progress rollups.
