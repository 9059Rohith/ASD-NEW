# Premium Control Audit

**Date:** 2026-08-30  
**Scope:** ASD-Edge-ST public, authentication, caregiver, therapist, admin, therapy, and Play & Practice experiences.

## Coverage

- Static inventory: 217 button/link declarations across 56 React source files.
- Browser render matrix: 46 route-role combinations.
- Public/auth routes: 7.
- Caregiver, therapy, and interactive routes: 29.
- Therapist route views: 9.
- Admin route views: 1.
- Explicit non-destructive workflow coverage remains in `frontend/tests/page-functionality.spec.js` and the feature-specific Playwright files.

Every browser-rendered control was checked for a readable accessible name, keyboard reachability, a minimum 32px legacy target, and a valid destination. The rebuilt public experience uses a 44px minimum target. Every route was also checked for unexpected redirect and page-level horizontal overflow.

## Defects found and repaired

| Area | Defect | Repair |
|---|---|---|
| Clinician registration | A direct visit to `/clinician-register` was treated as private after the anonymous `/auth/me` response. | Added the route to the API interceptor's public-path allowlist. |
| Login and admin login | Password reveal icons had no accessible name and only a 20px target. | Added dynamic Show/Hide password labels and the shared minimum target rule. |
| Password recovery | Text buttons rendered below the minimum target height. | Applied the shared minimum native-button target. |
| Video library | Bookmark buttons were icon-only and unnamed. | Added contextual Add/Remove labels plus `aria-pressed`. |
| Progress and settings | Icon-only dashboard return actions were unnamed. | Added “Back to dashboard” labels. |
| Calendar | Previous/next month icon buttons were unnamed. | Added explicit month-navigation labels. |
| Notifications | Three preference switches were unnamed and did not expose state. | Added contextual labels, `type="button"`, and `aria-pressed`. |
| Feedback | Five star-rating buttons were unnamed. | Added rating/meaning labels and selected-state semantics. |
| Mobile public hero | Fixed-width preview content widened the grid and clipped the headline and CTA labels. | Changed the mobile grid to `minmax(0, 1fr)`, constrained copy, and added a regression assertion for critical-content bounds. |

## Interaction evidence

The Playwright suite explicitly covers public navigation, registration/sign-in routes, mobile menu state, password reset, therapy media, Tamil speech synthesis, games, help/settings navigation, private camera lifecycle, report printing, profile actions, appointments, caregiver invoice behavior, and the premium public CTA/section interactions.

Destructive deletion controls were inspected for name, focus, target, and enabled state but were not activated. Microphone/camera/speech interactions use deterministic browser mocks or supported fallback paths. The Browser plugin was not available in this environment, so the repository's regular Playwright runner performed browser verification.

## Automated gates

- `frontend/tests/control-audit.spec.js`
- `frontend/tests/premium-public-controls.spec.js`
- `frontend/tests/premium-public-visual.spec.js`
- `frontend/tests/page-functionality.spec.js`

These gates prevent unnamed controls, dead hash links, unreachable public routes, clipped mobile hero content, and route-level overflow from returning.
