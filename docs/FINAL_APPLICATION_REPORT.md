# Final application experience and verification report

Scope: the 77-section user brief supplied on 6 September 2026, applied to the
existing application. Implementation and verification completed on 7 September
2026. Interim development logs are retained separately from passing evidence.

Running locally: **http://127.0.0.1:5174**, with API **http://127.0.0.1:8000**.
The final startup check confirms database, ONNX speech and both vowel models
ready; `all_twelve_ready` is true. Isolated QA services have been stopped.
Model hashes and verification totals are saved in
`.runlogs/final-verification-summary.json`. Restart instructions are in README.

## What was completed

| Requested area | Implemented behavior |
|---|---|
| Application audit | Reviewed route/auth/storage/audio/model architecture, current reports, learning/game flows and the supplied local references. Preserved the existing app and unrelated work. Historical architecture proposals are now marked as such; CURRENT_ARCHITECTURE.md describes the real pipeline. |
| Tamil curriculum | Twelve vowels in Tamil order, five short/long pairs, separate ஐ/ஔ practice, eight words and six sentences. Existing Tamil research and audio attribution remain linked. |
| Microphone | Seven-second automatic capture, no Stop button in vowel practice, float WAV where supported, native fallback, visible level/timer, permission and network recovery, cleanup on leaving. |
| Model audit | Independently exercised all twelve vowels, cross-target recognition and silence/quiet/noisy/repeated input; found a separate diphthong-quality gap. Baseline and later model results are kept separate. |
| Short and long sounds | Identity is independent of the selected target and duration. Short/long is a fitted voiced-duration estimate; surrounding recording silence is excluded. It cannot infer an intentionally prolonged short articulation independently of duration. |
| Diphthong improvements | A separate classifier is selected by speaker-separated validation, preserving the paired model weights. Failed candidates are not deployed. A confident diphthong can veto a misleading paired-vowel score. |
| Results | Tamil detected-vowel labels, measured duration, confidence separate from points, encouraging retries. Diphthong identity-match points explicitly do not claim perfect pronunciation. |
| Pippin | Reused original SVG kitten. Randomized blinks with occasional double blink, visibly closing eyes, breathing/tail/paw/head movement and real listening, processing, teaching, success and retry reactions. |
| Character lifecycle | Unique SVG IDs, timer/listener cleanup, hidden-tab pause and OS/saved reduced-motion support. Standalone voice-echo Pippin is preserved; home links directly to it. |
| Demo | Direct home entry to the complete learner experience; same recording and scoring routes. Duplicate-click guard, error/retry and cancellation when leaving. |
| Training | Learn, listen, record, result, retry, next lesson and saved progress remain connected. Removed an obsolete “coming soon” message from the existing pronunciation guide. |
| Games | Six separate vowel modes with incorrect/correct rounds, progression, completion, restart and exit. Full game lifecycle tests supplement previous entry-point tests. |
| Fonts and visual design | Existing ivory/forest design retained. Noto Sans Tamil, Inter, Poppins and Space Grotesk served locally with SIL licenses; 21 WOFF2 assets total 367,444 bytes. |
| Motion and parallax | Headline entrance/underline, existing slide/reveal/card transitions, shared route entrance and bounded pointer/scroll depth on decoration. No scroll interception or per-frame React renders for parallax. |
| Accessibility/responsive | Keyboard carousel controls, clear disabled autoplay under reduced motion, saved comfort toggle, visible focus, Tamil language tags and mobile/tablet/desktop checks. |
| Reliability/performance | Root render/lazy-load recovery, visible sign-in loading, local font loading, bounded animation scheduling, no hidden-tab character loops, abortable demo login and existing recording resource ownership. |
| QA and remaining limits | Unit/API tests, browser workflows, native microphone capture, production build and model measurements are reported separately below. No universal recognition or clinical accuracy claim. |

## Findings corrected during review

- The original animated blink changed an eyebrow path while the eyes remained
  open. The implementation now closes the visible eye group and displays lids.
- Hidden-tab handling initially stopped only the blink timer. It now also pauses
  all CSS character animations.
- A pending demo login could redirect a page after navigation. The request is
  cancelled when its component unmounts.
- Reduced-motion slideshow controls could imply autoplay was running while it
  was disabled. The Play control and explanation now reflect the actual state.
- The existing IPA speech-presence gate used whole-recording energy. Short
  sounds surrounded by silence could be rejected despite audible speech. The
  updated gate measures detected active-frame energy and retains raw RMS for
  diagnostics.
- Full game completion testing found that React's development effect replay
  could send an extra empty session-creation request. Session creation now waits
  for a cancellable task; cleanup can prevent the transient request, and stale
  responses remain guarded. Tests assert one initial session and one new session
  after restart. An independent lifecycle review found no cancellation issue.

## Recognition evidence

The earlier paired model has 81.90% identity, 94.87% length and 77.48% combined
accuracy on its 6,078 original held-out segments. These are model-dataset metrics,
not a promise for every browser, child, accent or microphone.

The new baseline audit used 240 human clips: 20 per vowel from the same four
reserved speakers. Paired vowels accepted 157/200 with 139/157 correct joint
predictions. The previous generic IPA path accepted 39/40 diphthongs but matched
only 15/39 exactly; seven-second silence reduced its acceptance to 15/40. This
motivated the auxiliary model. The new sample's seed differs from the earlier
200-clip audit, so those figures are not an improvement comparison.

The frozen auxiliary model uses 80 MFCC statistics plus 20 temporal-change
features and recognizes seven vowel identities. On 7,316 historical held-out
segments it achieves 80.62% identity accuracy. Its confidence gate retains 76.16%
of segments with 89.20% accuracy among retained predictions. AI recall is 88.31%;
AU recall is 51.49%. These identity metrics do not measure short/long accuracy
or final runtime quality gates.

The original 200-clip paired runtime audit and 120 corruption cases were rerun
unchanged. Every result row and summary matches the previous report: 161/200
accepted, 135/161 accepted joint predictions correct, identical predictions
after silence padding, and all 120 corrupted recordings rejected. The auxiliary
veto introduces no regression on this fixed sample.

See [Diphthong model report](DIPHTHONG_MODEL_REPORT.md) for the frozen classifier,
failed candidates, validation gate, final held-out measurements and regression
impact. The initial audit had already inspected some reserved speakers; later
training candidates use validation for selection and disclose that prior test
visibility. There is no fresh external population benchmark.

## Verification evidence

Final test counts, browser versions, runtime comparisons and production status
are recorded below. Development runs interrupted for
host memory pressure and failures corrected during implementation remain in
`.runlogs/` for traceability and are not counted as successful final runs.

- Backend: **275 passed**, with 15 existing deprecation warnings
  (`.runlogs/diphthong-backend-tests.log`).
- Frontend: **279 passed across 59 files**
  (`.runlogs/final-frontend-verified.log`).
- Browser workflows: **89 distinct cases verified across the broad run and
  targeted reruns**. The first 71 cases passed in `final-browser-verified.log`.
  After correcting duplicate session creation, the affected vowel suite passed
  17 of 18 cases; its remaining failure selected a hidden SVG description.
  The corrected visible-instruction locator then passed all five game-entry
  cases (`final-vowel-games-verified.log`, `final-game-instructions-verified.log`).
  All six full game lifecycles, the ten-recording evaluation, session restart,
  progress export and microphone cleanup passed. These API-fixture workflow
  tests exercise native browser recording but do not establish model accuracy.
- ESLint: **passed**, zero warnings (`.runlogs/final-lint-verified.log`).
- Production build: **passed**, 3 minutes 4 seconds during host load
  (`.runlogs/final-build-verified.log`). The initial JavaScript entry is
  244.12 kB (81.26 kB gzip); the separate legacy therapy route chunk is
  851.81 kB (228.09 kB gzip), retaining a build size warning.
  No performance score or low-end-device frame-rate benchmark is claimed.
- Real diphthong browser/API/model integration: **6 cases, 52 checks passed**:
  AI, AU, AU at −40 dB, an AI recording against an AU prompt, silence and repeated
  AI. Automatic seven-second capture and ended microphone tracks were checked
  for every case (`.runlogs/diphthong-live-results.json`). These are selected
  licensed human integration fixtures, not a new accuracy benchmark.
- Real paired-vowel browser/API/model integration: **15 cases, 139 checks
  passed**, including ten vowel/length classes, two −40 dB recordings, wrong
  target, silence and repetition. The final run uploaded float WAV in all
  fifteen cases, saved each completed attempt once and reported no JavaScript
  errors (`.runlogs/quiet-live-results.json`). An earlier run's ordinary O
  recording used supported WebM and was correctly recognized; that run failed
  an overly strict format assertion. The final harness distinguishes supported
  native formats and still specifically requires float WAV for quiet cases.
- Built application smoke: **20 checks passed**, including the real one-click
  demo login, protected routes, complete catalog, local font/assets, Pippin,
  database readiness and both model engines
  (`.runlogs/vowel-production-verification.json`).
- Tamil word/sentence integration: **60 checks passed** against the actual API,
  MongoDB and ONNX model, covering all 26 reference assets, idempotent saving,
  target independence, privacy export, native seven-second word/sentence capture,
  responsive pages and five persisted attempts
  (`.runlogs/tamil-live-verification.json`). Synthetic reference input produced
  scores of 33.33 for the direct word example and 12.5 for the direct sentence
  example; the browser word recording scored 66.67. These low/variable phoneme
  comparison scores underline the lack of validated human word/sentence accuracy.
- Browser compatibility: Chromium **20 checks**; Edge 152 **23 checks**;
  Firefox 153 **23 distinct checks across the layout and capture runs**, plus
  **11 forced native-fallback checks**. Home, Tamil hub and practice layouts
  were checked at 360/768/1440 px; screenshots were visually reviewed.
  Firefox's first capture used native WebM, and later captures verified float
  WAV support. A forced worklet failure produced a valid WebM fallback; the
  actual backend decoder read 7.0135 seconds of finite audio. Review details and
  intermediate harness failures are retained in `.runlogs/final-experience-review.md`.

## Practical limits

No speech model here is 100% accurate. ஔ and some rounded-vowel distinctions are
particularly difficult. Quiet-signal recovery cannot restore information already
lost to clipping, quantization or background noise. A clear retry is preferable
to an invented confident match.

Word and sentence scores remain experimental acoustic phoneme comparisons. They
are not Tamil transcripts, semantic validation or clinically validated speech
assessments. Browser-generated/fake-device recordings test the browser pipeline;
they are not independent human accuracy measurements. Physical microphone capture
alone likewise does not validate pronunciation recognition.

This pass verifies the web project and shared backend. It does not claim new
Android device testing, Safari/iOS microphone testing, hosted deployment, offline
inference, payments or services requiring accounts that are not configured.

## Sources and reproduction

Run the documented scripts from the workspace using the existing Python virtual
environment and frontend dependencies. Model reproducibility and data licensing
are in the individual model reports; font licenses are in
`frontend/public/assets/fonts/`.

Motion preferences follow the [W3C guidance on interaction animation](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).
Parallax uses the independent CSS [translate property](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/translate)
so it can coexist with the existing entrance/orbit transforms. These design
choices do not constitute a claim of a complete WCAG conformance audit.
