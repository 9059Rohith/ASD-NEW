# ASD-Edge-ST Premium Interaction Audit Design

**Status:** Approved for implementation on 2026-08-30. The user requested completion without further questions, so the generated concept direction is the accepted design baseline.

## Goal

Turn the existing ASD-Edge-ST web application into a calm, premium clinical product and verify every rendered button/control for accessibility, intent, and feedback. Preserve the already rebuilt caregiver, therapist, privacy, consent, and clinical-note workflows.

## Accepted visual direction

The implementation follows these generated concepts:

- `docs/design/premium-public-hero-concept.png`
- `docs/design/premium-public-workflow-concept.png`
- `docs/design/premium-public-privacy-concept.png`

The direction is editorial rather than decorative: true white canvas, deep navy type, restrained indigo actions, teal evidence states, and amber reserved for attention. Surfaces use fine borders and modest shadows. There are no testimonials, unsupported outcome claims, pricing, glass panels, neon gradients, or stock-child imagery.

## Public experience

The landing page becomes one coherent product narrative:

1. Quiet sticky navigation: How it works, For families, For therapists, Research & privacy, Sign in.
2. Hero: “Tamil speech practice, built around the child.” with caregiver registration and practice-loop actions.
3. A code-native caregiver workspace preview using transparent sample data.
4. A three-step practice loop: Listen, Practise, Review.
5. Role-specific family and therapist sections connected by one shared plan.
6. Inspectable evidence and consent controls, without overstating technical or clinical guarantees.
7. A final account-choice band and concise footer.

All in-page navigation uses real section IDs and moves focus to the destination heading after scrolling. Route actions use React Router links. The mobile menu reports `aria-expanded`, closes after selection, and never traps focus.

## Design system delta

- **Ink:** `#071642`
- **Action:** `#1734c6`
- **Evidence:** `#0f766e`
- **Attention:** `#b45309`
- **Canvas:** `#ffffff`
- **Soft canvas:** `#f6f8fc`
- **Border:** `#dce3ef`
- **Display type:** Space Grotesk with system fallback
- **Body type:** Inter with system fallback
- **Radius:** 14px controls, 20–28px major surfaces
- **Control height:** 44px minimum for primary interaction targets
- **Motion:** short opacity/translate transitions; disabled under reduced-motion preferences
- **Focus:** visible 3px indigo ring with offset on all keyboard-operable controls

## Component approach

The public page is rebuilt as a self-contained page with a scoped stylesheet, small data-driven sections, and native semantic HTML. The dashboard retains its current route architecture. Shared button primitives receive consistent focus, disabled, hover, and minimum-target behavior without changing their API.

## Control audit

The repository currently renders controls across public/auth, caregiver, therapist, admin, therapy, and interactive activity routes. Verification has two layers:

1. A static source audit inventories button declarations and flags native buttons that omit an explicit `type` unless they are intentional form submits.
2. Playwright loads the public and authenticated route groups with deterministic API mocks. It checks every visible enabled button/link for an accessible name, keyboard focusability, minimum target height, and visible focus treatment. Primary workflows are then clicked explicitly to confirm route, scroll, modal, state, download/print, and form outcomes.

Destructive controls are inspected but not activated. Hardware-dependent controls use browser mocks or their supported fallback paths.

## Error and loading behavior

- Buttons retain stable labels where possible and expose busy state through `disabled` plus readable text.
- Navigation actions never depend on unavailable APIs.
- Content remains readable if motion, microphone, camera, or speech synthesis is unavailable.
- No interaction is represented by a dead `href="#"` or an enabled control without a meaningful outcome.

## Responsive and accessibility constraints

The premium public experience is validated at 1536×1024 and 390×844. It must have no horizontal overflow, preserve logical heading order, support keyboard-only navigation, honor reduced motion, and maintain readable contrast. Icon-only buttons require accessible names.

## Verification evidence

Final evidence will include automated test output, a route/control matrix, desktop and mobile screenshots, and a fidelity ledger comparing the implementation to the three accepted concept images. The shared dirty `main` worktree is preserved; this pass does not commit, reset, or discard user changes.
