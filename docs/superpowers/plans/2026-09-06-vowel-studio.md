# Vowel Studio implementation plan

Goal: Deliver the user's complete vowel-learning redesign with real seven-second microphone capture, independently measured vowel identity and length, six playable modes, evaluation sessions and evidence-backed progress.

Architecture: Preserve existing FastAPI, MongoDB, React and Android contracts. Add a bounded vowel-analysis module beside the ONNX phoneme pipeline, a versioned trained artifact and reproducible speaker-held-out evaluation. A reusable React Vowel Studio drives practice, games and evaluation through one recording state machine. Signed server receipts remain the source of persisted scores. Existing clinical, account and legacy therapy routes remain available.

Tech stack: Python/NumPy/SciPy/scikit-learn, FastAPI/PyMongo, React/Vite, CSS/Canvas/Framer Motion, pytest/Vitest/Playwright.

Spec: User attachment `C:/Users/BhaviChasvi/.codex/attachments/2fbf62b6-90da-4894-9936-0af91d9f62b0/pasted-text.txt`.

Global constraints: No questions or approval pauses; preserve current dirty work and other workspace processes. No invented metrics, transcripts, duration labels or progress. Public dataset attribution retained. No user audio persisted by default. Seven seconds refers to actual capture after permission, not countdown or analysis. Respect reduced motion and keyboard accessibility. Do not claim clinical validation or universal accuracy.

## Task 1 — Audit and design
Inspect relevant microphone, phoneme, progress, routes, assets and tests; record findings and create a visual concept. Keep the existing Pippin identity. Define API interfaces before independent implementation.

## Task 2 — Acoustic vowel model
Own backend/app/services/vowel_analysis.py, backend/scripts/vowel_*, backend/tests/test_vowel_analysis.py, backend/models/vowel-classifier and data attribution/evaluation documentation. Download/inspect the licensed Mendeley Tamil vowel dataset (10.17632/2dnxmvm22k.1), validate labels, segment actual vowels, extract stable spectral/periodicity/energy/duration features. Train identity and length using disjoint speakers, abstain on unsuitable audio, report identity/length/combined precision-recall-F1 and confusion matrices. Expose analyze_vowel(audio_bytes, target_phoneme) returning compatible evidence plus vowel_analysis, score_components and debug feature data. Never infer length from the entire recording or a CTC spike.

## Task 3 — Server learning sessions
Own backend/app/routers/vowels.py, backend/app/services/vowel_progress.py and focused tests. Add authenticated /api/vowels/catalog, /analyze, /progress, /sessions, /sessions/{id}/complete routes. Analyze invokes Task 2; signed/idempotent records protect score and session integrity. Server-generated ten-class challenge sequences, per-target mastery, XP, streak milestones and session summaries. Reuse canonical curriculum and auth. Integrate router into main only after coordinated review.

## Task 4 — Seven-second practice interface
Own frontend/src/features/vowels/* and focused tests. Add reusable pure recording lifecycle with permission state, seven-second deadline, analyser waveform, automatic upload/processing, abort/unmount cleanup and duplicate-start prevention. Build a reusable studio for practice, ten-challenge evaluation and six games. Result includes identity, short/long, measured duration, confidence, component scores, meaningful retry guidance, Pippin states and persisted progress. Maintain legacy recorder contracts.

## Task 5 — Premium application design
Create original concept; implement shared token system, landing page, simple Home/Practice/Games/Evaluate/Progress navigation and circular recording composition. New learning routes use the studio; preserve all original routes, role protections and care features. Restyle the shared existing shell. Integrate real progress without fabricated counters. Responsive desktop/mobile, visible focus, accessible status, sound and reduced-motion controls.

## Task 6 — Review and verification
Review each independent interface and final integration. Run focused tests, all relevant backend/frontend regression suites, production build, browser recording/permission/no-speech/retry/game/evaluation/progress flows and real server inference with held-out human vowels. Verify physical microphone if available. Persist an honest completion report with measured model metrics, tests, screenshots and limitations; restart the production preview with final artifacts.

## Preflight interface review
| Tasks | Shared boundary | Decision |
| --- | --- | --- |
| 2 / 3 | analyze_vowel bytes + canonical target | Compatible evidence dictionary; model unavailability is unscorable, never a fabricated score. |
| 3 / 4 | catalog, sessions, analyze, progress | Publish request/response contract before frontend integration. Server owns challenges and saved scores. |
| 4 / 5 | studio components and CSS tokens | Studio is self-contained; integration owns routing and shared shell. |
| 1–6 | Existing application | Keep legacy interfaces; new modules are additive before replacing entry pages. |

Each task's files, tests and intended behavior agree. Implementation proceeds in the supplied workspace as explicitly requested; independent modules may be delegated under the subagent-driven-development skill, with bounded ownership and subsequent review. No automatic commits, merges or publication.

## Execution status

Tasks 1–6 are implemented and verified. Final evidence: 190 backend tests, 234
frontend tests, 64 browser regression cases (including the three fixed layout
rechecks and two added auth/public regressions), 140 real HTTP integration checks and 108 real browser/model/database
checks. Production build and local service readiness passed. See
`docs/VOWEL_STUDIO_COMPLETION_REPORT.md` and the visual fidelity ledger for
the measured results, implementation choices and remaining recognition limits.
