# OM NAMAH SHIVAYAH 🙏

# MASTER EXECUTION PROMPT — COMPLETE THE EXISTING TAMIL KIDS LEARNING APP

You are a senior product engineer, Tamil learning designer, SVG animation engineer, accessibility engineer, backend engineer, AI orchestration engineer, QA engineer, and deployment engineer. Work in `C:\final_year_project`. **Implement the product in the repository; do not answer with a plan, mockup, or another prompt.** Start by auditing the existing code, then make and verify the changes. Preserve working functionality, existing user data, authentication, and the current backend contracts. Do not reset the dirty worktree or replace the application with a new scaffold.

## Exact product outcome

Create one coherent, responsive Tamil children's learning experience:

**Animated landing → existing login/sign-in → child dashboard → three-part training grid → item-specific human-led lesson → speech/recognition practice → five games → saved progress → recommendations → daily clinician PDF → configured delivery.**

The result must feel premium, playful, calm, and professionally designed. It must also work end to end. Do not add fake buttons, fake analytics, generic repeated SVGs, robotic teaching audio as the primary example, simulated external sends, or static reports presented as live data. Keep the existing login and sign-in flows and visual layout broadly intact; only fix inconsistencies or broken states there.

## Existing repository facts to respect

- React/Vite frontend and FastAPI/MongoDB backend already exist. The main training route `/training` and `/tamil` renders `frontend/src/pages/TamilLearningPage.jsx`; a selected item opens `/tamil/practice/:itemId`; recognition opens `/tamil/quiz/:itemId`. Reuse these flows.
- `backend/app/tamil_curriculum.py` already has 12 vowels, 18 consonants, ஃ, 216 உயிர்மெய் combinations, nine words, and eight sentences. Retain correct Tamil order and existing item IDs. The first four words are **அம்மா, அப்பா, மரம், நாய்**; the first two sentences are **அம்மா வீட்டில் இருக்கிறார்.** and **நாய் ஓடுகிறது.** These six must receive explicit end-to-end acceptance tests.
- `frontend/src/components/storybook/PippinStorybook.jsx` and the user-supplied SVG source at `C:\Users\BhaviChasvi\.codex\attachments\06ba609f-f8a6-459a-a9d1-8d76488456d6\pasted-text.txt` are the character-animation reference: mood-driven face, blinking, gaze, breathing, tail, paws, speech reaction, and reduced-motion behavior. Inspect both and extend this architecture. Do not copy one identical character or illustration across every Tamil item.
- Existing vowel training uses the learner-requested rule: **measured voiced vowel duration > 1.00 seconds = long; ≤ 1.00 seconds = short**. Exclude silence from the seven-second recording. Keep identity recognition independent of the prompted answer. ஐ and ஔ are glides evaluated by sound identity, not by this paired-vowel cutoff. A wrong length must never earn a high or successful score.
- Current Tamil word/sentence speech-to-text is not reliably available locally when the NeMo runtime is missing; generic phoneme fallback has mis-scored reference clips. Inspect `/health/speech`, make capability truthful, and do not claim speech scoring is accurate until a validated Tamil recognizer passes real held-out recordings. Keep writing, listening, and visual recognition usable if speech scoring is unavailable.
- `frontend/src/pages/LandingPage.jsx`, `frontend/src/pages/GamesPage.jsx`, `frontend/src/pages/UserDashboard.jsx`, `frontend/src/pages/ProgressPage.jsx`, the Tamil pages, `backend/app/routers/tamil.py`, `backend/app/routers/reports.py`, and existing auth, calendar, settings, and integration routes are starting points. Audit them before changing them.
- Existing deployment targets are Vercel for `frontend/`, Render for `backend/`, and MongoDB Atlas. Use `frontend/vercel.json`, `render.yaml`, `docs/DEPLOYMENT.md`, and the health endpoints. Do not invent a different deployment architecture without a concrete need.

## 1. Landing page: exceptional first impression

On first load, show Tamil learning immediately through animated SVG scenery: a character derived from the Pippin motion system, Tamil letters, flowers/leaves, and **beautiful butterflies**. Butterfly SVGs need distinct wing shapes and color treatments, articulated wing flaps, curved flight paths, gentle vertical drift, small rotations, depth, and occasional non-uniform timing. The scene must look alive rather than like identical objects looping on straight lines. Keep the main call to action and Tamil content readable. Avoid motion behind dense text. Pause nonessential animation when the page is hidden and honor the saved Reduce motion setting and `prefers-reduced-motion`; the static composition must still look complete. Keep login and sign-in working as they are.

## 2. Training: exactly three primary sections

The top-level learning choice on `/training` must be **Phonemes / Letters**, **Words**, and **Sentences**. Show three clear sections, then an ordered responsive grid within the chosen section. The Phonemes section may have subgroups for the 12 vowels, 18 consonants, one aytham, and 216 combined letters, but these are subgroups, not extra top-level sections. Use explicit canonical `display_order`; never depend on random sort or database insertion order. Preserve all existing catalog IDs and deep links.

Every tile shows the correct Tamil text, a distinct appropriate visual, its available human audio, and its stored learning state: not started, in progress, practiced, or mastered. Show completion and current focus without making color or motion the sole signal. Words appear in a stable pedagogical grid, with the first four above in their authored order. Sentences follow a simple-to-complex order. Tapping any tile opens its **dedicated existing training session** for that item, not a generic page or a dead preview. On return, the grid reflects saved progress. Do not lock lessons unless unlock logic is implemented, explained, and backed by stored progress.

## 3. Item-specific teacher-like lesson

For each selected letter, word, or sentence, run a gentle sequence: **picture appears once → large Tamil item appears → warm human Tamil teacher voice plays → child may replay → child practices or answers → encouraging feedback → progress saves → next item/recommendation**. Keep the picture, Tamil glyph, sound, and character reaction synchronized. Avoid automatically repeating the introduction every time the child revisits the page. Provide Replay and Skip controls with clear states.

Use **curated, licensed or directly recorded human Tamil speech** as the primary teaching audio. Record and document speaker, consent/license, dialect, pronunciation review, file format, checksum, and mapping to the exact catalog item. No English voice and no synthetic/robotic audio may silently substitute for a claimed human example. If a human recording is missing, show an honest availability state and keep non-audio activities usable; produce a precise missing-asset inventory. Do not manufacture audio or falsely mark the lesson complete. Tamil pronunciation and copy need review by a competent Tamil speaker.

Every one of the **31 basic symbols** needs an individually designed SVG illustration and meaningful motion, with its own teaching, idle, selected, correct, and retry states. Give each of the 216 combined letters a distinct item-specific SVG scene or compositional asset driven by its consonant and vowel; they must not render as 216 copies of the same picture with only a text swap. Share the renderer, tokens, and animation primitives, but keep item-specific illustration metadata and asset references in the centralized catalog. Use object associations only where linguistically/pedagogically sound. Optimize the assets and lazy-load offscreen scenes.

## 4. Five mandatory integrated games

Implement and expose exactly these five core games from the main Games page, with mouse, touch, keyboard, clear instructions, pause/retry, score, accuracy, attempt count, streak, and a saved result per session. All prompts and outcomes use the same Tamil catalog and item IDs as training.

1. **Letter Match:** match identical Tamil letters; tap-to-pair and optional drag interaction; gentle correction and celebration.
2. **Find the Letter:** find a requested glyph among curated confusables such as ல/ள/ழ; use valid deterministic distractor sets and difficulty levels.
3. **Picture → Word Match:** choose a word from a genuine picture, including யானை, நாய், அம்மா, and அப்பா when matching approved illustrations/audio exist. Add those words to the shared catalog if absent; never use emoji as the final picture asset.
4. **Listen & Choose:** play the human Tamil asset and choose the matching letter, then confusable letter, word, and sentence in later levels. If audio is missing, disable that item with an explanation rather than playing a fake sound.
5. **Word Builder:** tap or drag Tamil grapheme tiles to form valid authored words, for example **அ + ம் + மா → அம்மா**. Check the composed Tamil string after Unicode normalization, play the approved word audio, and advance from simple to harder words.

Use a server-owned result contract and idempotent request IDs for game persistence. Prevent duplicate points from retries, refreshes, or concurrent submissions. Game outcomes must update item mastery and weak-area analysis, and appear in Progress and Dashboard. Do not replace these games with unrelated microphone activities already in the repository; keep those activities as additional experiences.

## 5. One real progress and analytics system

Connect training, recognition, speaking, the five games, and reviews through one child-scoped event model. Each event records child ID, catalog item ID, activity type, result, score if actually scorable, duration, timestamp, and validated evidence metadata. Never treat an unscorable speech attempt as a zero or a success. Compute totals and trends from persisted events, not frontend constants. Expose explicit loading, empty, error, and retry states.

The Progress page must show lesson completion, phoneme/word/sentence mastery, five-game sessions and accuracy, practice frequency, streak, time spent, recent activity, strengths, weak areas, and change over time. The child dashboard should lead with a simple motivating next step; the caregiver dashboard should show the child's actual top-level analytics immediately. Explain denominators, time windows, and the meaning of every score. Build recommendations from recorded misses and review schedules, and show the evidence behind each recommendation. Do not fabricate improvement when insufficient history exists.

## 6. Multi-agent core with real responsibilities

Implement an observable, bounded orchestration pipeline. Give each agent typed input/output schemas, validation, permitted data, failure behavior, and traceable execution IDs:

- **Learning Agent:** derives item mastery and next lesson from progress events.
- **Practice Agent:** schedules repetitions based on missed and due items.
- **Game Agent:** adjusts curated difficulty and recommends one of the five games.
- **Speech Agent:** summarizes only validated pronunciation evidence and explicitly labels unavailable/unscorable results.
- **Analytics Agent:** computes daily and historical aggregates with deterministic formulas.
- **Report Agent:** converts validated aggregates into a clinician-readable structured report and PDF.
- **Integration Agent:** dispatches an approved report through configured channels and records delivery status.

Use deterministic rules for calculations; an LLM may help phrase a summary only from supplied, validated facts and must not invent diagnoses, progress, or missing results. Agents must not receive unrestricted database, file, network, or message-sending privileges. Persist job state, retries, error categories, and audit events. A failed agent must not corrupt learning progress or create a false report.

## 7. Daily doctor report and authorized integrations

Build a once-per-day, timezone-aware job (default `Asia/Kolkata`, configurable per caregiver) that collects the previous local day's activity, runs the analytics and report agents, generates and stores a versioned PDF, then delivers it to the **configured doctor/clinician** only when a caregiver has explicitly enabled that recipient and channel. Make scheduling idempotent by child, recipient, date, and report version. Support manual preview, download, resend, pause, consent withdrawal, and recipient change. Store delivery attempts and last success; failures must retain the PDF and allow safe retry without duplicate sends.

The PDF must render Tamil correctly with embedded licensed fonts, readable tables/charts, page numbers, date and time window, and clear sections: activities/time, phonemes, words, sentences, all five games, validated speech observations, trends when data exists, and specific next steps. Include provenance/limitations and distinguish educational practice from clinical diagnosis.

Provide production adapters for **email** and **official WhatsApp business messaging**, plus **calendar** integration for clinician-approved review/reminder events. Send the PDF only through channels that support that content and have valid credentials, permissions, recipient addresses/numbers, and consent. Do not use unofficial WhatsApp automation or claim that a calendar event delivered a PDF. Keep secrets server-side. If credentials or a doctor contact are absent, finish the adapter, settings UI, validation, queue, and local test harness, but show **Not configured** and do not send anything externally. Never put child data in logs or URLs.

## 8. Quality, accessibility, and deployment

Keep one visual system across landing, training, games, progress, and dashboard. Use semantic controls, visible focus, Tamil font support, generous touch targets, clear bilingual labels where useful, captions/alternatives for audio, 320px reflow, and a complete reduced-motion path. Animations should be purposeful and lightweight: butterfly flight, item introduction, audio-synced SVG reactions, correct/retry feedback, progress, and level-up. Respect paused/hidden/offscreen states. Avoid excessive motion and generic card-grid styling.

Verify on desktop, tablet, and mobile. Add meaningful backend tests for ordering, authorization, game persistence, mastery, idempotency, daily scheduling, PDF Tamil rendering, and integration retries. Add browser tests for landing motion/reduced motion, all three grids and item navigation, the first four words/two sentences, all five games, progress updates, dashboards, and report preview/download. Test real audio capability separately with held-out Tamil speakers; report false matches, abstentions, and limitations instead of declaring 100% accuracy. Run frontend tests/lint/build, backend tests, and production smoke checks. Audit every route/button and fix failures.

Prepare Vercel, Render, MongoDB, model/audio assets, CORS, secure cookies, secrets, scheduler, persistent PDF storage, and health/readiness endpoints for deployment. Do not deploy, publish, connect a live doctor channel, or send a real report until the required credentials/recipient/consent exist and the result is reviewable. Record exactly what is configured, tested, and still blocked by external assets or credentials.

## Execution order and final handoff

1. Audit the repository and map existing features to these requirements; preserve all working code and data.
2. Implement the centralized ordered catalog, training architecture, teacher sequence, and verified human audio assets.
3. Build distinct SVG scenes, landing butterflies, and the unified design/motion system.
4. Implement the five games and server-backed events/mastery.
5. Integrate Progress, Dashboard, and evidence-based recommendations.
6. Implement bounded agents, daily PDF generation, consented integrations, and observability.
7. Complete accessibility, performance, security, browser QA, backend QA, production build, and deployment preparation.
8. Start the local application and report the working URL, exact tests and results, files changed, deployed status, and every remaining external dependency. **Do not claim the product is complete if human Tamil recordings, validated Tamil speech recognition, doctor recipient/consent, or provider credentials are missing.**

Deliver the implemented application, not a proposal. Preserve the exact user journey: **SEE → HEAR → UNDERSTAND → SPEAK → PRACTICE → PLAY → IMPROVE**, supported by **MEASURE → ANALYZE → RECOMMEND → REPORT → INTEGRATE**.

# OM NAMAH SHIVAYAH 🙏
