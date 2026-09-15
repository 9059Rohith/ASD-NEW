# ASD-Edge-ST End-to-End Rebuild Design

## Approved source

This design implements the user-provided rebuild brief dated 2026-08-30. The instruction “no more questions” authorizes reasonable design decisions and continuous execution without intermediate approval prompts.

## Research position

The [market report](../../research/report-source.md) establishes the product gap: launched child speech apps, ASD/AAC tools, scoring platforms, Indian learning apps and edge runtimes each cover part of the need, but the reviewed market does not combine Tamil articulation, ASD-specific low-sensory practice, phoneme-level evidence, clinician review and edge-local processing.

## Product design

The normative flows, information architecture, role model, ASD interaction rules, accessibility target and safety language are defined in [PRODUCT_DESIGN.md](../../PRODUCT_DESIGN.md).

## Technical architecture

The normative component boundaries, data flow, schema, edge strategy, latency budgets, privacy controls and deployment topology are defined in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Implementation scope

The existing React/Vite, FastAPI/MongoDB, Android and ML pipeline remain the implementation base. The rebuild closes launch-readiness gaps without discarding tested functionality:

1. Make caregiver, therapist and admin onboarding/routing explicit while preserving child mode inside the caregiver account.
2. Add purpose-specific, append-only voice-data consent records and a caregiver settings surface.
3. Add clinician notes and next-target cues with assigned-child authorization.
4. Ensure score provenance and GOP/syllable detail remain visible in adult review surfaces.
5. Refresh the primary shell/dashboard against a generated low-sensory design concept and verify desktop/mobile fidelity.
6. Add a reproducible demo seed covering caregiver/child, therapist, evaluations, consent and notes.
7. Document local, Docker and edge deployment paths and verify automated and browser workflows.

## Out of scope for this delivery

- Clinical efficacy or diagnostic claims.
- Silent replacement of the existing Wav2Vec2/forced-alignment/GOP implementation.
- Shipping an unvalidated quantized model to production browsers.
- Collecting research audio without explicit, separate consent and ethics approval.
- Replacing the native Android or Unity subprojects when their current integration contract remains valid.

## Acceptance criteria

- The research, product design and architecture documents are present and cited.
- Parent/caregiver, therapist and admin identities reach only their permitted surfaces.
- A caregiver can inspect and change optional audio retention/sharing consent.
- A therapist can view assigned child speech evidence and create a note/next target.
- The child recording loop returns transparent validation state/source and never awards a fabricated pass when recognition is unavailable.
- Demo data makes the care loop demonstrable after one seed command.
- Backend and frontend unit tests pass; production frontend build succeeds.
- The primary workflow is browser-tested on desktop and mobile, and the implementation is visually compared with the accepted generated concept.
