# ASD-Edge-ST / SpeakEasy ASD

A local-first Tamil speech-practice and care-coordination platform for autistic children, caregivers, and speech therapists. ASD-Edge-ST is an assistive practice and review tool; it is not a diagnostic device or a replacement for a clinician.

The application includes caregiver and therapist workspaces, consent and clinician notes. Browser practice uses local acoustic vowel classifiers and phoneme comparisons with persisted progress. The shared API also retains the signed phoneme-scoring path used by the Android client. See [the implementation and verification report](docs/COMPLETION_REPORT.md).

The current audit, test evidence, and remaining release work are documented
in the [September 2026 application audit](docs/APPLICATION_AUDIT_2026-09-14.md). The
[earlier application report](docs/FINAL_APPLICATION_REPORT.md) records the prior implementation pass. The
[current architecture](docs/CURRENT_ARCHITECTURE.md) describes the implemented
pipeline; older design proposals are retained separately.

## Tamil letters, words and sentences

Recording now runs automatically for **seven seconds**, then evaluates the sound;
there is no Stop or Pause control during capture. The timed vowel exercise uses
the detected voiced duration: **over 1.00 second is long; 1.00 second or less is
short**. Silence in the seven-second recording does not count. Some older
reference clips demonstrate vowel quality but are shorter than this exercise's
new long-vowel cutoff; hold your own long vowel beyond one second. Leaving the
practice page releases the mic.

Quiet microphone samples are preserved in float WAV through an AudioWorklet when
supported, with the native recorder as fallback. The evaluator can recover some
otherwise undetected quiet recordings with bounded gain; pitch and duration are
never stretched or changed to manufacture a match. Results remain measured and
may request another attempt. See the [recording update and validation](docs/VOWEL_STUDIO_COMPLETION_REPORT.md).

The homepage now has three Tamil learning slides, eight-second transitions,
keyboard and pause controls, gentle reveal animations and reduced-motion support.
Locally served Tamil fonts, decorative pointer/scroll parallax and a saved Reduce
motion control complete the presentation. Choose **Try the full demo** on the
homepage to enter learning directly. Pippin's animated SVG reacts to recording,
evaluation and results, with natural blinks and motion that pauses when hidden.

Open **http://127.0.0.1:5173/tamil** after `scripts/start-local.ps1` for
Tamil-first learning: 12 உயிரெழுத்துக்கள், 18 மெய்யெழுத்துக்கள், one ஆய்தம் (ஃ), all 216
உயிர்மெய்யெழுத்துக்கள், nine words, and eight short sentences. Aytham has a
recognition and writing lesson; no unsupported isolated pronunciation score is
shown for it. Combined letters
are grouped by consonant. Separate recognition challenges check the selected
character or text on the server and save the result. Vowels, words, and
sentences with verified audio also offer a listen-and-choose challenge. குறில் / நெடில் labels
follow Tamil Virtual Academy; ஐ and ஔ have their own vowel practice.

Word, sentence and diphthong practice records the real browser microphone for
seven seconds and saves your attempts. Words and sentences use Tamil text
recognition when the local model is available, with acoustic phoneme comparison
as a fallback. Optional browser Tamil speech-to-text shows its actual transcript
and a separate text comparison; it is not an acoustic pronunciation score.
Consonant and uyirmei lessons provide study, listening when a Tamil voice is
available, and recognition challenges; they do not claim a validated isolated
letter pronunciation score. ஐ / ஔ use a separately trained seven-identity classifier
with temporal sound features, confidence-based retries and explicit identity
match points. Its validation and limitations are in the
[diphthong model report](docs/DIPHTHONG_MODEL_REPORT.md).
Listening examples include 12 provenance-checked human vowel recordings and 17 locally generated word and sentence recordings. Their licenses and provenance appear on `/credits` and in the audio manifest.

See [Tamil research, implementation and verification](docs/TAMIL_LANGUAGE_RESEARCH.md).
Word/sentence scores are experimental phoneme comparisons; their accuracy has
not been established on an independent human Tamil dataset.

## Completed Vowel Studio

The redesigned web app adds seven-second microphone practice, independent Tamil
A/E/I/O/U identity and short/long detection, six games, ten-class evaluations,
and saved progress, XP, streaks and Pippin rewards. It uses the included trained
`backend/models/vowel-classifier/classifier.joblib`; inference stays on your API
server. The original ONNX phoneme and Android routes remain available.

See the [Vowel Studio completion and test report](docs/VOWEL_STUDIO_COMPLETION_REPORT.md),
[model evaluation and limitations](docs/VOWEL_MODEL_REPORT.md), and
[API contract](docs/VOWEL_API_CONTRACT.md). Recognition is measured, not guaranteed:
test identity accuracy is 81.90%, length accuracy 94.87%, and combined accuracy 77.48%.

On this machine, the verified production preview is **http://127.0.0.1:5174**
with API **http://127.0.0.1:8000**. To start again, ensure MongoDB is running and run
`powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1` from this folder;
that development launcher opens the web server at **http://127.0.0.1:5173**.
For a fresh environment, run `scripts/setup-local.ps1` first. The trained vowel
artifacts in both `backend/models/vowel-classifier/` and
`backend/models/diphthong-classifier/`, with their reference WAVs and attribution,
must be included when copying the project. `/health/vowels` reports
`all_twelve_ready` when both classifiers are available.

For a built preview, run `npm run build` then
`npm run preview -- --host 127.0.0.1 --port 5174 --strictPort` inside `frontend/`
while the API is running. Check `/health/ready`, `/health/vowels`, and
`/health/speech` on port 8000. Browser microphone access requires localhost or HTTPS.

## Applications

| Component | Directory | Technology | Purpose |
|---|---|---|---|
| Web | `frontend/` | React 18, Vite, Tailwind CSS | Browser application |
| API | `backend/` | FastAPI, MongoDB | Shared backend for web and Android |
| Android | `SpeakEasyAndroid/` | Kotlin, Jetpack Compose | Native Android application |

```text
frontend/          ── HTTP/WebSocket ──> backend/
SpeakEasyAndroid/  ── HTTP ────────────> backend/
```

## Prerequisites

- Python 3.11+
- MongoDB 6+ or MongoDB Atlas
- Node.js 20+
- Java 17 and Android SDK 34 for Android development

## Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements-core.txt
python scripts/download_phoneme_model.py
Copy-Item .env.example .env  # only when .env does not already exist
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Set real MongoDB, JWT, admin, CORS, and Cloudinary values in `backend/.env`.
The API is available at `http://localhost:8000`; Swagger UI is at
`http://localhost:8000/docs`.

### Seed the end-to-end demo care loop

With development MongoDB running, seed a linked caregiver, therapist, scored attempts, consent history, and a caregiver-visible clinical note:

```powershell
cd backend
$env:DEMO_CARE_LOOP_PASSWORD = "choose-a-development-password"
python scripts/seed_demo_care_loop.py
```

The script is deterministic and idempotent, refuses to run in production, and does not create raw audio. It prints the two demo emails after completion. If the environment variable is omitted outside production, the development-only password is `DemoCare@123`.

### Local acoustic phoneme model

The default speech and story routes use the pinned, quantized ONNX export of
`facebook/wav2vec2-lv-60-espeak-cv-ft`. The download script installs and verifies
318 MB of weights in `backend/models/phoneme-onnx`. No WSL, GPU, NeMo, browser
speech-recognition service, or external inference API is required.

Check `http://localhost:8000/health/speech` for `status: ready`. Uploads are
converted to mono 16 kHz, checked for usable signal, and decoded to IPA. The
interface shows expected and detected phones, insertions, deletions and
substitutions. The displayed percentage is phoneme edit accuracy, not GOP,
clinical confidence, or a diagnosis. Unsupported recordings receive an explicit
unscorable response. Browser microphone access requires localhost or HTTPS.

The legacy IndicConformer service remains optional for separate transcription
experiments; it is not the active pronunciation scoring engine.

### Production API (Render)

`render.yaml` provisions the Docker service, HTTPS health probe, secure cookie
defaults, and secret placeholders. Set the Atlas URI, Cloudinary credentials,
admin credentials, and the exact Vercel origin in Render before the first deploy.
Render's filesystem is temporary; production uploads are sent to Cloudinary.

## Web frontend

Start the backend first, then:

```powershell
cd frontend
npm install
npm run dev
```

The web application runs at `http://localhost:5173`. Vite proxies `/api` and
`/ws` requests to the backend on port 8000.

### Production web (Vercel)

Import the repository with `frontend` as the project root, use `npm run build`
and `dist`, and set `VITE_API_BASE_URL=/api`. `frontend/vercel.json` provides
the SPA fallback, Render API rewrite, and security headers.

## Android

The Android emulator uses `http://10.0.2.2:8000/` to reach the backend running
on the host computer.

```powershell
cd SpeakEasyAndroid
.\gradlew.bat assembleDebug
```

For a physical device, expose the backend with `--host 0.0.0.0` and provide the
computer's LAN address:

```powershell
.\gradlew.bat assembleDebug -PbackendUrl=http://192.168.1.5:8000/
```

## Verification

```powershell
# Backend
cd backend
python -m pytest

# Frontend
cd ..\frontend
npm test
npm run build

# Android
cd ..\SpeakEasyAndroid
.\gradlew.bat assembleDebug
```

GitHub Actions runs the same backend, frontend, and Android checks on pushes and
pull requests.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the exact Render, Vercel,
Atlas, Cloudinary, Android release, and smoke-test steps.

## Product and engineering references

- [Product design](docs/PRODUCT_DESIGN.md) — roles, flows, ASD-specific interaction rules, and clinical boundaries.
- [Technical architecture](docs/ARCHITECTURE.md) — scoring flow, persistence, privacy, and edge deployment.
- [Market research](docs/research/market-research.md) — competitor synthesis and product gap.
- [Research source report](docs/research/report-source.md) and [claim ledger](docs/research/claim-source-ledger.md) — authoritative evidence and traceability.
- [Visual design system](docs/design/asd-edge-st-rebuild-design-system.md) — accepted caregiver/therapist concepts and implementation tokens.

## Repository structure

```text
.
|-- backend/             FastAPI source and tests
|-- frontend/            React/Vite source and public assets
|-- SpeakEasyAndroid/    Kotlin/Compose application
|-- .github/workflows/   Continuous integration
|-- .gitignore
`-- README.md
```

Generated dependencies, virtual environments, build outputs, logs, local
configuration, and runtime uploads are intentionally excluded from Git.
