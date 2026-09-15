# Interactive SVG Bunny Replacement Design

## Goal

Remove the Mitra GLTF robot and its dedicated React components from the frontend. Replace its visible landing-page role with an original, responsive SVG bunny inspired by the supplied soft green-hooded character reference. The replacement must feel alive through blinking, waving, expression, and gentle idle motion without WebGL or raster character assets.

## Scope

- Replace the `MitraRobot` usage in the landing-page hero with a reusable `InteractiveBunny` React component.
- Remove `MitraRobot.jsx`, `MitraCompanion.jsx`, and `public/mitra_robot.gltf` after confirming there are no remaining consumers.
- Remove visible Mitra naming and robot-specific copy from the replaced hero area.
- Preserve unrelated Three.js functionality. `CandleScene` and the Kavi/Pippin interactive character stage remain unchanged, so the Three.js packages stay installed.
- Preserve the current hero layout, statistics, badge, responsive breakpoint, and overall visual hierarchy.

## Character Design

The character will be an original vector illustration rather than a trace of the supplied reference. It will use:

- a white rounded bunny face with large dark eyes and small highlights;
- long ears emerging from a bright green hood;
- pink inner ears, nose, and cheeks;
- a compact green outfit with simple seam and pocket details;
- separate left and right arm groups, feet, tail, facial features, and ear groups;
- soft SVG gradients and restrained filters to fit the polished landing-page hero.

All visible character geometry will be native SVG paths, ellipses, circles, and groups. No embedded bitmap, external image, canvas, GLTF, or WebGL renderer will be used.

## Component API and States

`InteractiveBunny` will accept the existing character-facing concepts where useful:

- `mood`: `idle`, `happy`, `listen`, `thinking`, `encourage`, or `celebrate`;
- `audioLevel`: normalized microphone intensity for optional mouth response;
- `size`: rendered character height;
- `showBubble` and `message`: accessible speech-bubble content;
- `className`: layout integration.

The landing page will use the happy state and new companion wording without the Mitra name. State classes and data attributes will make behavior testable without relying on animation timing.

## Motion System

Animation will be applied to small wrapper groups and SVG parts:

- **Blink:** both eyelids close briefly on a non-distracting staggered cycle. CSS timing will include unequal pauses so the blink does not feel mechanical.
- **Wave:** one arm rotates from the shoulder in the happy state; celebrate raises and alternates both hands.
- **Idle:** the outer character wrapper moves vertically by a few pixels to simulate breathing.
- **Ears:** slight counter-rotation follows the body motion.
- **Face:** the mouth changes scale while listening or when `audioLevel` is non-zero; mood classes adjust eyebrow and mouth posture.
- **Interaction:** pointer hover/focus triggers a short greeting wave without requiring a click.

Animations use transforms and opacity only. Transform origins will be explicit for reliable scaling. `prefers-reduced-motion: reduce` disables continuous motion and leaves a clear static expression.

## Accessibility

- The character container has one descriptive `role="img"` label based on mood and message.
- Decorative SVG internals are hidden from assistive technology.
- The speech bubble remains readable HTML text.
- Motion does not communicate essential information by itself.
- Reduced-motion preferences are honored.
- The SVG keeps a stable `viewBox` and responsive dimensions to avoid layout shift.

## Integration and Cleanup

The new component will live outside the `three` directory, under the interactive component area. `LandingPage.jsx` will import it directly. After replacement, repository-wide searches must return no `MitraRobot`, `MitraCompanion`, `mitra_robot.gltf`, or visible `MITRA` references.

The Three.js dependencies will not be removed because they are still used by the candle exercise and other interactive characters. This cleanup is intentionally limited to the Mitra model.

## Testing and Verification

- Component tests confirm semantic labeling, speech-bubble rendering, mood state, and SVG-only output with no canvas.
- A landing-page test confirms the bunny renders and Mitra copy does not.
- Repository search verifies all Mitra model files and imports are gone.
- The complete Vitest suite and production build must pass.
- The live landing page will be checked at desktop and mobile widths for clipping, stable layout, readable bubble text, blink/wave motion, and reduced-motion behavior.
- A screenshot will be visually inspected to confirm the SVG reads as a polished green-hooded bunny and fits the existing hero composition.

## Success Criteria

The project contains no Mitra model asset or Mitra React component. The landing hero displays a scalable original bunny made entirely from live SVG geometry. Its eyes blink, its hands move, its body and ears have gentle motion, its expressions respond to mood, it remains usable with reduced motion, and all automated and visual checks pass.
