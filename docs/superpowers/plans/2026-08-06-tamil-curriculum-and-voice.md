# Tamil Curriculum and Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver 12 Tamil-vowel lessons, four Tamil-word lessons, a dedicated Indian Tamil neural voice path across sessions, and remove Pippin from therapy training.

**Architecture:** Keep curriculum data authoritative in the backend and expose it through the existing therapy API. Extend the existing allow-listed narration service into a provider-neutral Tamil voice service backed by Azure Speech, then use one frontend narrator utility for remote audio with exact `ta-IN` browser fallback.

**Tech Stack:** FastAPI, Pydantic settings, httpx, React 18, TanStack Query, Web Speech API, Vitest, pytest, Playwright.

## Global Constraints

- Curriculum order is exactly `அ ஆ இ ஈ உ ஊ எ ஏ ஐ ஒ ஓ ஔ அம்மா அப்பா மரம் பழம்`.
- Primary voice is Azure `ta-IN-PallaviNeural` with locale `ta-IN`.
- Tamil fallback must not deliberately select an English voice.
- Pippin is removed only from therapy/training sessions.
- Provider credentials remain server-side and all synthesis text is allow-listed.

---

### Task 1: Canonical therapy curriculum

**Files:**
- Modify: `backend/app/routers/therapy.py`
- Modify: `backend/app/routers/evaluation.py`
- Test: `backend/tests/test_therapy_curriculum.py`

**Interfaces:**
- Produces: `LESSONS: list[dict]` with 16 stable lessons and `voice_key` per lesson.
- Consumes: Existing authenticated `/api/therapy/lessons` and `/api/therapy/lessons/{id}` routes.

- [ ] Write a failing table-driven test asserting 16 ordered symbols, romanizations, phonemes, IDs, types, and `ta-IN` voice metadata.
- [ ] Run `python -m pytest tests/test_therapy_curriculum.py -q` and confirm it fails because only six legacy lessons exist.
- [ ] Replace the legacy lesson list with all 12 vowels and four words and extend evaluation target validation to the same 16 IDs.
- [ ] Run the focused backend tests and confirm they pass.

### Task 2: Indian Tamil neural voice service

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/.env.example`
- Modify: `backend/app/services/story_voice.py`
- Modify: `backend/app/routers/story_voice.py`
- Test: `backend/tests/test_story_voice.py`

**Interfaces:**
- Consumes: allow-listed `line_id` from the existing `GET /api/story-voice/{line_id}` endpoint.
- Produces: cached MP3 bytes synthesized using Azure locale `ta-IN` and voice `ta-IN-PallaviNeural`.

- [ ] Write failing service tests for Azure endpoint headers, escaped SSML carrying `xml:lang="ta-IN"`, Pallavi voice selection, caching, missing configuration, and invalid line IDs.
- [ ] Run `python -m pytest tests/test_story_voice.py -q` and confirm the Azure-contract tests fail.
- [ ] Add `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, and default `TAMIL_SPEECH_VOICE=ta-IN-PallaviNeural`; implement Azure REST synthesis behind the existing allow-listed service.
- [ ] Add voice entries for all curriculum targets and shared therapy prompts, then run focused tests to green.

### Task 3: Shared frontend Tamil narrator

**Files:**
- Modify: `frontend/src/features/characters/characterVoice.js`
- Modify: `frontend/src/utils/speechRepeat.js`
- Modify: `frontend/src/services/api.js`
- Test: `frontend/src/features/characters/characterVoice.test.js`
- Test: `frontend/src/utils/speechRepeat.test.js`

**Interfaces:**
- Produces: exact-locale `selectInstalledVoice`, and `repeatPhrase` defaults to `ta-IN` for Tamil content.
- Consumes: existing story voice endpoint and Web Speech APIs.

- [ ] Write failing tests proving exact `ta-IN` is preferred and an English voice is never chosen for Tamil fallback.
- [ ] Run focused Vitest tests and confirm failures against the English-first behavior.
- [ ] Add locale-aware voice selection and make Tamil repeat/praise use `ta-IN` with calm teaching pitch/rate.
- [ ] Run focused frontend tests to green.

### Task 4: Training roadmap and Pippin removal

**Files:**
- Modify: `frontend/src/pages/TrainingPage.jsx`
- Modify: `frontend/src/components/therapy/SlideManager.jsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/pages/TrainingPage.test.jsx`
- Test: `frontend/src/components/therapy/SlideManager.test.jsx`

**Interfaces:**
- Consumes: `therapyAPI.getLessons()` returning the 16 canonical lesson records.
- Produces: an unlocked, ordered 16-item roadmap and a full-width Pippin-free therapy layout.

- [ ] Write failing rendered tests for all 16 roadmap links and absence of the Pippin training panel.
- [ ] Run focused Vitest tests and confirm the legacy six-item/Pippin behavior fails.
- [ ] Render the roadmap from the therapy query, remove `PippinTrainingCoach`, its activity state, and the two-column training CSS.
- [ ] Run focused tests to green.

### Task 5: Regression and rendered verification

**Files:**
- Modify only defects found by verification in the files above.

**Interfaces:**
- Consumes: completed backend/frontend implementation.
- Produces: evidence that API, build, and training interactions work.

- [ ] Run `python -m pytest` from `backend`.
- [ ] Run `npm test -- --run` and `npm run build` from `frontend`.
- [ ] Restart the local API if needed and verify `/health`, `/api/therapy/lessons`, and the frontend respond.
- [ ] Use repository Playwright (Browser plugin is unavailable) to validate Training -> vowel lesson -> Listen on desktop and mobile, with console and screenshot checks.
