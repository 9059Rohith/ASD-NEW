# Premium Interaction Audit Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a premium public experience and verify every rendered control across the ASD-Edge-ST application.

**Architecture:** Replace the oversized marketing landing page with a semantic, scoped React page faithful to the approved generated concepts. Harden shared control styles without rewriting working feature logic, then use deterministic Playwright mocks to audit public and authenticated routes.

**Tech Stack:** React 18, React Router, Tailwind/CSS, Lucide, Vitest, Playwright, Vite.

**Workspace constraint:** Work in the existing shared dirty `main` worktree because it contains the active rebuild. Do not commit, reset, clean, or overwrite unrelated changes.

---

### Task 1: Lock the public interaction contract

**Files:**
- Create: `frontend/tests/premium-public-controls.spec.js`
- Test: `frontend/tests/premium-public-controls.spec.js`

- [ ] Add tests for desktop navigation labels, caregiver and clinician routes, and the final CTA actions.
- [ ] Add tests proving each in-page navigation action lands on and focuses its named section.
- [ ] Add a mobile test for menu open/close state and route navigation.
- [ ] Run `npx playwright test tests/premium-public-controls.spec.js`; confirm it fails against the old page for the expected missing premium contract.

### Task 2: Build the concept-faithful premium landing page

**Files:**
- Replace: `frontend/src/pages/LandingPage.jsx`
- Create: `frontend/src/pages/LandingPage.css`
- Modify: `frontend/src/index.css`
- Test: `frontend/tests/premium-public-controls.spec.js`

- [ ] Implement the quiet header, hero, workspace preview, practice loop, family/therapist views, evidence/privacy section, CTA band, and footer.
- [ ] Implement accessible section scrolling/focus and mobile navigation.
- [ ] Remove fabricated testimonials, inflated metrics, unsupported claims, obsolete contact submission, and dead marketing controls.
- [ ] Add reduced-motion, high-contrast focus, 44px targets, and 390px layout behavior.
- [ ] Run the new public control test until green.

### Task 3: Harden shared premium controls

**Files:**
- Modify: `frontend/src/components/ui/index.jsx`
- Modify: `frontend/src/index.css`
- Create: `frontend/src/components/ui/index.test.jsx`

- [ ] Add failing component tests for button type, disabled semantics, and accessible busy behavior.
- [ ] Update `GradientButton` and global control focus/disabled styles while preserving its existing public API.
- [ ] Run the focused Vitest file and lint affected code.

### Task 4: Audit every route and repair discovered controls

**Files:**
- Create: `frontend/tests/control-audit.spec.js`
- Modify: affected files under `frontend/src/pages/` and `frontend/src/components/`
- Create: `docs/qa/premium-control-audit.md`

- [ ] Inventory all declared buttons/links and group routes as public, caregiver, therapist, admin, therapy, and interactive activities.
- [ ] Add deterministic API/browser mocks and scan every route for blank names, unreachable focus, undersized targets, dead hash links, and horizontal overflow.
- [ ] Explicitly click each primary non-destructive workflow control and assert its visible outcome.
- [ ] For each defect, add a focused regression assertion before fixing the source.
- [ ] Record every route group, scanned control count, explicit interactions, and hardware/destructive exceptions in the audit artifact.

### Task 5: Visual fidelity and full verification

**Files:**
- Create: `docs/qa/premium-public-1536x1024.png`
- Create: `docs/qa/premium-public-390x844.png`
- Create: `docs/qa/premium-public-fidelity-ledger.md`

- [ ] Run the app and capture native-size desktop and mobile screenshots with Playwright.
- [ ] Inspect both screenshots with `view_image` and compare hierarchy, spacing, color, controls, and responsive behavior to all three concept images.
- [ ] Apply any material fidelity corrections and repeat the capture/inspection loop.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, and the full Playwright suite in `frontend/`.
- [ ] Run the backend test suite to confirm this frontend pass did not regress integration contracts.
- [ ] Use the React best-practices review and verification-before-completion skills before reporting completion.
