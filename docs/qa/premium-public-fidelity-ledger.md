# Premium Public Fidelity Ledger

**Reviewed:** 2026-08-30  
**Implementation captures:**

- `docs/qa/premium-public-1536x1024.png`
- `docs/qa/premium-public-390x844.png`

**Accepted concepts:**

- `docs/design/premium-public-hero-concept.png`
- `docs/design/premium-public-workflow-concept.png`
- `docs/design/premium-public-privacy-concept.png`

## Concept generation record

The image generation skill produced three 1536×1024 references. The prompt directed a premium editorial healthcare web product with true white canvas, deep navy typography, restrained indigo actions, teal evidence states, amber attention states, fine borders, modest shadows, a code-native caregiver dashboard preview, no stock children, no testimonials, no pricing, and exact ASD-Edge-ST public copy. Follow-up concept prompts extended the same system into the Listen/Practise/Review workflow, family/therapist shared-plan views, evidence anatomy, consent controls, CTA band, and footer.

Generated originals were copied from:

- `C:\Users\BhaviChasvi\.codex\generated_images\01a04efa-82b1-7d01-ac9a-700e8267dd8a\exec-af4c0843-896f-46b3-93b0-24788ed601da.png`
- `C:\Users\BhaviChasvi\.codex\generated_images\01a04efa-82b1-7d01-ac9a-700e8267dd8a\exec-c29835e0-ff32-4280-af30-416e02289733.png`
- `C:\Users\BhaviChasvi\.codex\generated_images\01a04efa-82b1-7d01-ac9a-700e8267dd8a\exec-b122068e-0633-4df0-b53e-acb9f4074359.png`

## Fidelity comparison

| Dimension | Concept target | Implemented result | Status |
|---|---|---|---|
| Hierarchy | Quiet 76px header; editorial hero; product preview on the right. | Header, headline scale, CTA priority, and preview placement closely match at 1536×1024. | Match |
| Typography | Deep navy Space Grotesk display with restrained body copy. | Existing font tokens are reused with the approved weights, scale, and compact tracking. | Match |
| Color | White/soft-gray canvas, navy ink, indigo action, teal evidence, amber attention. | Tokens are scoped to the public page and used consistently by semantic role. | Match |
| Surfaces | Fine borders and modest shadows; no decorative card wall. | Major preview/loop/evidence surfaces use restrained depth and grouped composition. | Match |
| Product preview | Code-native caregiver workspace with transparent sample context. | Implemented in semantic HTML/CSS; no screenshot or fake interactive control is exposed. | Match |
| Workflow | Listen, Practise, Review in one calm connected loop. | Three connected steps retain the exact sequence and evidence-oriented copy. | Match |
| Roles | Family and therapist views visibly share one plan. | Asymmetric role grid pairs home guidance with an evidence review table. | Match |
| Privacy | Dark technical evidence section with consent and no-raw-audio status. | Evidence anatomy and active consent row closely match the concept. | Match |
| Claims | No fabricated metrics, testimonials, or guaranteed clinical outcomes. | Old testimonial/marketing sections were removed; copy stays descriptive and inspectable. | Match |
| Mobile | Single-column narrative, reachable menu, uncut copy and CTAs. | 390×844 capture is within bounds after fixing the preview-induced grid expansion. | Match |
| Motion | Minimal and reduced-motion safe. | Only short control transitions and smooth section movement remain; reduced motion disables them. | Match |

## Intentional differences

- The generated dashboard preview is recreated in HTML/CSS so it remains crisp, translatable, and responsive.
- The desktop capture contains the hero fold; the rest of the page follows the two continuation concepts in the same live document.
- The mobile fold prioritizes headline, copy, actions, and assurances before the preview. This makes the account choice and privacy posture readable without horizontal compression.

Both implementation captures were inspected at original resolution with `view_image`. The mobile regression test additionally checks the bounding boxes of the headline, lead copy, and hero actions rather than relying only on document overflow.
