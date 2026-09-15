# ASD-Edge-ST Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the existing ASD-Edge-ST application as a role-safe, consent-aware, clinician-in-the-loop Tamil speech practice product while preserving the Wav2Vec2/forced-alignment/GOP pipeline.

**Architecture:** Extend the current React/Vite + FastAPI/MongoDB application through additive collections and focused role-aware components. Voice scoring remains behind `SpeechEvaluator`; new consent and clinical-note resources store auditable metadata while raw audio stays transient by default.

**Tech Stack:** React 18, Vite, Zustand, TanStack Query/axios, FastAPI, Pydantic 2, PyMongo Async, Wav2Vec2, AI4Bharat IndicConformer, torchaudio/DTW alignment, Vitest, pytest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-30-asd-edge-st-rebuild-design.md`

## Global Constraints

- Preserve existing uncommitted user changes; do not reset or replace them.
- Preserve the existing Wav2Vec2 CTC + forced-alignment + GOP integration and its normalized result contract.
- Raw voice is transient by default; optional retention, clinician sharing and de-identified research are independent consent purposes.
- Child practice remains low-sensory and never auto-records.
- WCAG 2.1 AA is the target; controls remain keyboard accessible and at least 44 × 44 CSS pixels where practical.
- New behavior is implemented test-first with an observed failing test.
- No production or clinical diagnostic claims.

---

### Task 1: Consent ledger and privacy API

**Files:**
- Create: `backend/app/models/consent.py`
- Create: `backend/app/routers/consent.py`
- Create: `backend/tests/test_consent.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/database.py`

**Interfaces:**
- Produces: `ConsentPurpose`, `ConsentUpdate`, `reduce_consent_records(records) -> dict`
- Produces: `GET /api/consent`, `PUT /api/consent`
- Current-state response: `{purposes, processing_location, raw_audio_default, policy_version}`

- [ ] **Step 1: Write failing reducer tests**

```python
def test_reduce_consent_records_uses_latest_event_per_purpose():
    records = [
        {"purpose": "recording_retention", "granted": False, "created_at": datetime(2026, 1, 1)},
        {"purpose": "recording_retention", "granted": True, "created_at": datetime(2026, 2, 1)},
    ]
    assert reduce_consent_records(records)["recording_retention"]["granted"] is True

def test_reduce_consent_records_defaults_optional_purposes_to_denied():
    assert reduce_consent_records([])["clinician_sharing"]["granted"] is False
```

- [ ] **Step 2: Run `python -m pytest tests/test_consent.py -q` and verify import failure**
- [ ] **Step 3: Implement strict consent models and the pure latest-event reducer**
- [ ] **Step 4: Add authenticated GET/PUT routes; append events rather than updating old records**
- [ ] **Step 5: Add `(user_id, created_at desc)` and `(user_id, purpose, created_at desc)` indexes**
- [ ] **Step 6: Run the consent tests and full backend tests**

### Task 2: Assigned-child clinical notes

**Files:**
- Create: `backend/app/models/clinical_note.py`
- Create: `backend/app/routers/clinical_notes.py`
- Create: `backend/tests/test_clinical_notes.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/database.py`

**Interfaces:**
- Consumes: authenticated users and the existing `therapist_id` assignment on a child user
- Produces: `ClinicalNoteCreate(text, next_target, caregiver_visible)`
- Produces: `GET /api/clinical-notes/{child_id}` and `POST /api/clinical-notes/{child_id}`

- [ ] **Step 1: Write failing tests for note normalization and role/assignment policy**

```python
def test_normalize_note_trims_text_and_next_target():
    note = normalize_note(ClinicalNoteCreate(text="  Practise slowly.  ", next_target="  அம்மா  "))
    assert note == {"text": "Practise slowly.", "next_target": "அம்மா", "caregiver_visible": True}

def test_can_access_child_rejects_unassigned_therapist():
    assert can_access_child({"_id": "t1", "role": "therapist"}, {"therapist_id": "t2"}) is False
```

- [ ] **Step 2: Run the targeted test and confirm missing-module failure**
- [ ] **Step 3: Implement models, pure authorization helper and response serializer**
- [ ] **Step 4: Add GET/POST routes: assigned therapist/admin can write; caregiver can read own visible notes**
- [ ] **Step 5: Add `(child_id, created_at desc)` index and include recent notes in therapist child detail only through the new API**
- [ ] **Step 6: Run targeted and full backend tests**

### Task 3: Role-aware onboarding, routing and navigation

**Files:**
- Create: `frontend/src/utils/roleRouting.js`
- Create: `frontend/src/utils/roleRouting.test.js`
- Create: `frontend/src/pages/ClinicianRegisterPage.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/pages/LoginPage.jsx`
- Modify: `frontend/src/pages/RegisterPage.jsx`
- Modify: `frontend/src/components/layout/DashboardLayout.jsx`
- Modify: `frontend/src/services/api.js`

**Interfaces:**
- Produces: `homeForRole(role)`, `canOpenRoleRoute(role, allow)`, `navGroupsForRole(groups, role)`
- Produces: public `/clinician-register` and therapist registration through existing `POST /api/therapist/register`

- [ ] **Step 1: Write failing tests for caregiver, therapist and admin destinations and navigation filters**

```javascript
expect(homeForRole('therapist')).toBe('/therapist')
expect(homeForRole('admin')).toBe('/admin')
expect(canOpenRoleRoute('user', ['therapist', 'admin'])).toBe(false)
expect(navGroupsForRole(NAV_GROUPS, 'therapist').flatMap(g => g.items).some(i => i.path === '/therapist')).toBe(true)
```

- [ ] **Step 2: Run `npm test -- src/utils/roleRouting.test.js` and verify import failure**
- [ ] **Step 3: Implement pure role routing functions**
- [ ] **Step 4: Gate caregiver, therapist and admin pages in `App.jsx`; redirect login/registration with `homeForRole`**
- [ ] **Step 5: Add the clinician registration page and link it from caregiver registration/sign-in surfaces**
- [ ] **Step 6: Filter sidebar groups by role while retaining account/help items**
- [ ] **Step 7: Run targeted and full frontend unit tests**

### Task 4: Caregiver consent surface and clinician annotation workflow

**Files:**
- Create: `frontend/src/features/consent/consentState.js`
- Create: `frontend/src/features/consent/consentState.test.js`
- Create: `frontend/src/components/privacy/VoicePrivacyPanel.jsx`
- Create: `frontend/src/features/clinicalNotes/noteState.js`
- Create: `frontend/src/features/clinicalNotes/noteState.test.js`
- Modify: `frontend/src/pages/SettingsPage.jsx`
- Modify: `frontend/src/pages/TherapistDashboard.jsx`
- Modify: `frontend/src/services/api.js`

**Interfaces:**
- Consumes: Task 1 consent API and Task 2 clinical note API
- Produces: `consentAPI.get/update`, `clinicalNotesAPI.list/create`
- Produces: caregiver voice/privacy controls and therapist note list/form

- [ ] **Step 1: Write failing tests for consent response normalization and note draft validation**

```javascript
expect(normalizeConsent({ purposes: {} }).recording_retention).toBe(false)
expect(validateNoteDraft({ text: ' ', next_target: '' })).toEqual({ valid: false, message: 'Add a clinical note.' })
```

- [ ] **Step 2: Run targeted tests and verify missing imports**
- [ ] **Step 3: Implement the pure state helpers**
- [ ] **Step 4: Add API clients and `VoicePrivacyPanel` with loading, success, failure and accessible status states**
- [ ] **Step 5: Mount the panel in Settings and preserve existing export/deletion controls**
- [ ] **Step 6: Add note history and an accessible note form to the therapist child-detail modal**
- [ ] **Step 7: Run frontend tests and build**

### Task 5: Reproducible demonstration data

**Files:**
- Create: `backend/app/demo_seed.py`
- Create: `backend/scripts/seed_demo_care_loop.py`
- Create: `backend/tests/test_demo_seed.py`
- Modify: `README.md`

**Interfaces:**
- Produces: `build_demo_documents(now) -> dict[str, list[dict]]`
- Produces command: `python scripts/seed_demo_care_loop.py`

- [ ] **Step 1: Write a failing pure-data test**

```python
def test_demo_seed_links_therapist_child_scores_consent_and_note():
    docs = build_demo_documents(datetime(2026, 8, 30, tzinfo=timezone.utc))
    assert docs["users"][0]["role"] == "user"
    assert docs["users"][1]["role"] == "therapist"
    assert docs["evaluations"] and docs["consent_records"] and docs["clinical_notes"]
```

- [ ] **Step 2: Confirm the module is missing**
- [ ] **Step 3: Implement deterministic documents with Tamil targets, score provenance and no raw audio**
- [ ] **Step 4: Implement an idempotent seed script using stable demo emails and upserts**
- [ ] **Step 5: Document safe development-only credentials and the seed command**
- [ ] **Step 6: Run targeted and full backend tests**

### Task 6: Visual concept, shell refresh and browser fidelity

**Files:**
- Create: `docs/design/asd-edge-st-care-workspace-concept.png`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/layout/DashboardLayout.jsx`
- Modify: `frontend/src/pages/UserDashboard.jsx`
- Modify: `frontend/src/pages/TherapistDashboard.jsx`
- Create: `docs/qa/asd-edge-st-rebuild-fidelity-ledger.md`

**Interfaces:**
- Consumes: the approved design spec and live role workflows
- Produces: a calm, role-aware desktop/mobile application shell matching the generated concept

- [ ] **Step 1: Generate a complete primary caregiver dashboard concept with a coordinated therapist-detail state**
- [ ] **Step 2: Inspect the concept with `view_image` and extract exact palette, spacing, type, icon and container tokens**
- [ ] **Step 3: Apply tokens to the shell and primary dashboards without breaking existing page contracts**
- [ ] **Step 4: Run unit tests, lint where supported, and production build**
- [ ] **Step 5: Start API/frontend; verify sign-in, consent update, child practice navigation, therapist child detail and note creation**
- [ ] **Step 6: Capture desktop at the concept native size and a mobile viewport; inspect latest screenshot and concept with `view_image` in one QA pass**
- [ ] **Step 7: Record at least five comparison points and fix every material mismatch**
- [ ] **Step 8: Re-run tests/build and remove temporary QA artifacts**

### Task 7: Final documentation and release verification

**Files:**
- Modify: `README.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `backend/.env.example`

**Interfaces:**
- Produces: local, Docker/cloud-demo and clinic-edge setup instructions

- [ ] **Step 1: Document architecture links, prerequisites, demo seed, roles, consent defaults and ML fallback behavior**
- [ ] **Step 2: Document the recommended clinic-edge topology, model warm-up and measured-latency checklist**
- [ ] **Step 3: Verify every command in the quick-start path or label environment-specific commands precisely**
- [ ] **Step 4: Run backend tests, frontend tests/build and relevant Playwright smoke tests from a clean process state**
- [ ] **Step 5: Inspect `git diff --check`, review the final diff for secrets/generated outputs, and report remaining intentional deviations**
