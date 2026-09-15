# Interactive SVG Bunny Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Mitra GLTF robot with an original animated green-hooded SVG bunny and remove every Mitra-specific asset, component, import, and visible label.

**Architecture:** A focused `InteractiveBunny` React component owns accessible markup and SVG anatomy, while a colocated stylesheet owns transform-only mood and ambient animations. The landing page consumes the component through a small prop API; unrelated Three.js exercises remain untouched.

**Tech Stack:** React 18, inline SVG, CSS keyframes/media queries, Vitest, Testing Library, Vite

## Global Constraints

- Use only native live SVG geometry for the bunny; do not embed canvas, WebGL, GLTF, or bitmap character art.
- Preserve the landing hero layout, statistics, badge, responsive breakpoint, and hierarchy.
- Keep Three.js packages because unrelated candle and Kavi/Pippin experiences still use them.
- Honor `prefers-reduced-motion: reduce` and do not rely on motion to communicate state.
- Remove all `MitraRobot`, `MitraCompanion`, `mitra_robot.gltf`, and visible `MITRA` references.

---

### Task 1: Build the SVG character contract

**Files:**
- Create: `frontend/src/components/interactive/InteractiveBunny.jsx`
- Create: `frontend/src/components/interactive/InteractiveBunny.css`
- Create: `frontend/src/components/interactive/InteractiveBunny.test.jsx`

**Interfaces:**
- Consumes: `{ mood, audioLevel, size, showBubble, message, className }` props.
- Produces: `InteractiveBunny` default React component with `data-testid="interactive-bunny"`, `data-mood`, one accessible image label, optional HTML bubble, and decorative inline SVG.

- [ ] **Step 1: Write failing semantic and renderer tests**

```jsx
render(<InteractiveBunny mood="happy" showBubble message="Hello!" />)
expect(screen.getByTestId('interactive-bunny')).toHaveAttribute('data-mood', 'happy')
expect(screen.getByRole('img')).toHaveAccessibleName(/happy.*Hello/i)
expect(screen.getByText('Hello!')).toBeInTheDocument()
expect(document.querySelector('svg')).toBeInTheDocument()
expect(document.querySelector('canvas')).not.toBeInTheDocument()
```

- [ ] **Step 2: Run the component test and verify missing-module failure**

Run: `npm test -- --run src/components/interactive/InteractiveBunny.test.jsx`
Expected: FAIL because `InteractiveBunny.jsx` does not exist.

- [ ] **Step 3: Implement accessible SVG anatomy and CSS motion**

Create stable groups named `bunny-ear`, `bunny-arm`, `bunny-eye`, `bunny-eyelid`, `bunny-mouth`, and `bunny-body`. Use gradients for the green hood/body, white face, pink ear/cheek details, dark eyes, feet, pocket, flower, and tail. Apply blink, wave, idle, ear, mouth, hover/focus, mood, and reduced-motion rules to group transforms and opacity.

- [ ] **Step 4: Run the focused component test**

Run: `npm test -- --run src/components/interactive/InteractiveBunny.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit the component**

```bash
git add frontend/src/components/interactive/InteractiveBunny.jsx frontend/src/components/interactive/InteractiveBunny.css frontend/src/components/interactive/InteractiveBunny.test.jsx
git commit -m "feat: add interactive SVG bunny companion"
```

### Task 2: Replace Mitra and delete model artifacts

**Files:**
- Modify: `frontend/src/pages/LandingPage.jsx`
- Create: `frontend/src/pages/LandingPage.bunny.test.jsx`
- Delete: `frontend/src/components/three/MitraRobot.jsx`
- Delete: `frontend/src/components/three/MitraCompanion.jsx`
- Delete: `frontend/public/mitra_robot.gltf`

**Interfaces:**
- Consumes: `InteractiveBunny` from Task 1.
- Produces: landing hero with a happy bunny, greeting bubble, existing hero badge, and no Mitra references.

- [ ] **Step 1: Write a failing landing integration test**

```jsx
render(<MemoryRouter><LandingPage /></MemoryRouter>)
expect(screen.getByTestId('interactive-bunny')).toBeInTheDocument()
expect(screen.queryByText(/MITRA/i)).not.toBeInTheDocument()
```

- [ ] **Step 2: Run the integration test and confirm it fails on the existing robot**

Run: `npm test -- --run src/pages/LandingPage.bunny.test.jsx`
Expected: FAIL because the landing page renders `MitraRobot`.

- [ ] **Step 3: Replace the import and hero usage**

Import `InteractiveBunny` directly, render it at the existing hero size with `mood="happy"`, `showBubble`, and companion copy that does not contain Mitra or robot terminology. Keep the existing motion wrapper and accuracy badge.

- [ ] **Step 4: Delete exact Mitra files and verify references are absent**

Run: `rg -n -i "MitraRobot|MitraCompanion|mitra_robot\.gltf|\bMITRA\b" frontend/src frontend/public`
Expected: no matches.

- [ ] **Step 5: Run focused tests and commit integration cleanup**

Run: `npm test -- --run src/pages/LandingPage.bunny.test.jsx src/components/interactive/InteractiveBunny.test.jsx`
Expected: PASS.

```bash
git add -A frontend/src/pages/LandingPage.jsx frontend/src/pages/LandingPage.bunny.test.jsx frontend/src/components/three frontend/public/mitra_robot.gltf
git commit -m "refactor: replace Mitra model with SVG bunny"
```

### Task 3: Full verification and visual QA

**Files:**
- Modify only if verification finds a concrete defect in Task 1 or Task 2 files.

**Interfaces:**
- Consumes: completed SVG component and landing integration.
- Produces: evidence that the feature is test-clean, build-clean, responsive, animated, and accessible.

- [ ] **Step 1: Run the complete frontend suite**

Run: `npm test -- --run`
Expected: all tests pass.

- [ ] **Step 2: Build production assets**

Run: `npm run build`
Expected: Vite exits 0 with no unresolved Mitra asset.

- [ ] **Step 3: Inspect the live desktop and mobile landing page**

Open the running frontend at desktop width and a mobile width. Confirm the desktop hero shows the full bunny and readable bubble without clipping, while the existing mobile breakpoint remains stable. Confirm the DOM has SVG and no canvas in the bunny subtree.

- [ ] **Step 4: Inspect motion and accessibility**

Confirm visible blink, hand wave, idle body movement, ear movement, and happy expression. Emulate reduced motion and confirm continuous animations stop. Inspect the captured desktop screenshot directly for polish and reference-inspired green-hooded bunny anatomy.

- [ ] **Step 5: Restore generated tracked build artifacts and report results**

If `frontend/dist/index.html` changes only because of verification, restore it so the worktree contains only intended source changes and the user's earlier uncommitted work.
