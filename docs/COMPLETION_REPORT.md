# Implementation and verification report

## Delivered speech path

Browser microphone → MediaRecorder → WAV → authenticated FastAPI endpoint →
bounded mono 16 kHz decoding → signal-quality gate → local acoustic CTC phoneme
recognition → IPA edit alignment → signed evaluation receipt → MongoDB history,
caregiver progress, analysis and reports. Android AAC recordings use the same
decoder and evaluator.

The default recognizer is the quantized ONNX export of
[Facebook's acoustic phoneme model](https://huggingface.co/facebook/wav2vec2-lv-60-espeak-cv-ft).
The [ONNX checkpoint](https://huggingface.co/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX/blob/main/onnx/model_quantized.onnx)
is pinned and SHA-256 checked by `backend/scripts/download_phoneme_model.py`.
Inference is local CPU execution. Model downloads require internet during setup.

All 16 curriculum targets have explicit broad IPA sequences. The UI displays
expected and detected phones, substitutions, insertions, deletions, confidence
and signal warnings. Score = `100 × max(0, 1 − edit_distance / target_phone_count)`.
No browser transcript, word-ASR result, heuristic MFCC template, or score floor
supplies pronunciation evidence. Silence, malformed/oversized/overlong audio,
missing weights and inference failures cannot earn a fabricated pronunciation score.

Microphone capture rejects overlapping sessions, releases tracks and audio
contexts, handles late permission grants and unmounts, and stops after 18 seconds.
Backend recordings are limited to 20 seconds. Camera use is optional.

## Persistence and application changes

- The server signs each scorable attempt; progress saves verify the owner and
  signature, ignore client-edited scores, preserve IPA evidence and use an
  idempotent receipt identifier. Retries do not increment attempts or rewards twice.
- Evaluation automatically saves successful acoustic analyses, including mismatches.
  Rewards retries use the same receipt and refresh authoritative totals.
- Changing lessons clears prior session results. Caregiver labels use the actual
  16-item curriculum. Summary lesson counts no longer stop at six.
- Speech analysis shows actual recent phone alignments. Reports derive their
  tables and charts from up to 100 latest saved attempts in the selected period.
  Empty accounts display empty states. Fabricated invoices, report histories and
  unavailable video entries were removed; the real local pronunciation video remains.
- Android accepts scorable results and signed receipts and displays expected and
  detected IPA. Recorder initialization failures release resources.
- The Docker build installs the CPU requirements and verified model. Windows
  setup/start scripts are supplied. Existing user work and reference repositories
  were preserved; see `IMPLEMENTATION_AUDIT.md` for the reference audit.

## Running locally

MongoDB must be running and `backend/.env` must contain the local configuration.
From the repository root:

```powershell
.\scripts\setup-local.ps1
.\scripts\start-local.ps1
```

Open `http://127.0.0.1:5173`. API docs are at `http://127.0.0.1:8000/docs`.
For this handover, the compiled production preview is running separately at
`http://127.0.0.1:5174`, with the API on port 8000. This keeps it independent of
Playwright's temporary development server on port 5173.
The model is ready when `/health/speech` returns `status: ready`.
The startup script prints process IDs and writes logs under `.runlogs`.
Do not start a second copy on occupied ports. For remote browsers use HTTPS.

The existing installed runtime is `backend/.runtime`; the model directory is
`backend/models/phoneme-onnx`. These generated artifacts are intentionally ignored
by Git. The checked-out runtime reuses system Python packages; the setup script
creates a standalone virtual environment on a new installation.

## Verification commands

```powershell
cd backend
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD = '1'
.\.runtime\Scripts\python.exe -m pytest -p pytest_asyncio.plugin -o addopts='' -q
cd ..\frontend
npm test -- --run
npm run build
npx playwright install chromium
npx playwright test --workers=1
# With the real API, MongoDB and installed model running:
npx playwright test --config playwright.live.config.js
cd ..\SpeakEasyAndroid
.\gradlew.bat assembleDebug testDebugUnitTest
```

Backend tests require pytest and pytest-asyncio in the test environment. The live
browser test uses an isolated newly registered account and creates real records;
use a separate `DB_NAME` for QA. It feeds a public human speech WAV through
Chromium's microphone device and does not mock MediaRecorder, the API, model or DB.

## Practical limits

This is an automatic practice aid, not a validated clinical assessment. Tamil
child-speech accuracy has not been established against a clinician-annotated
corpus. Broad target mappings and model token boundaries require that validation;
for example, the checkpoint vocabulary does not separately assess the doubled
nasal in “amma.” Approximate CTC timestamps are relative to trimmed audio, and
token confidence is not a calibrated clinical probability. The signal gate uses
energy, not a neural speech/noise classifier.

Browser automation with a human audio fixture proves the capture and processing
path. A separate check opened this machine's physical microphone and captured
two seconds of audio in Chromium without fake-device flags; it then discarded
the recording. These checks do not establish accent, child-speech or every
browser/device accuracy. A physical Android device and production hosting have
not been exercised. Native Tamil narration depends on an installed Tamil voice,
or configured Azure narration; missing narration does not block acoustic scoring.
Optional camera tracking requires its browser MediaPipe assets. Server camera
analysis reports no detection when its optional dependencies are absent.

No “100% tested” or universal recognition-accuracy claim is warranted by these
checks. Docker Desktop's Linux engine was unavailable, so the container build
was not executed; local installation and compilation were exercised instead.

## Observed results (6 September 2026)

- Backend: 158 tests passed in the final complete suite; two additional actual
  AAC/WebM codec tests passed separately (160 total).
- Acoustic checkpoint: SHA-256 verification passed, warmup reached `ready`, and
  real human audio produced IPA tokens and the expected nonmatching verdict.
- Live Chromium: registration, real microphone-device capture and MediaRecorder,
  acoustic inference, persistence, duplicate-save protection, forged-score
  rejection, analysis and mobile reports passed in one 58.4-second journey.
- Physical microphone: Chromium reported a live 48 kHz audio track and recorded
  32,174 bytes of WebM/Opus in memory. No raw recording was saved. Reproduce with
  `node frontend/scripts/verify-physical-microphone.mjs` while the API runs.
- Frontend: all 212 unit tests passed across 46 test files; production build passed.
- Browser regression: 49 journeys passed in the complete run. The combined
  37-route smoke journey hit its original overall timeout; it passed in full
  Chromium on rerun (2.2 minutes), with a six-minute overall budget and unchanged
  per-page assertions. All 50 regression journeys therefore have passing results.
  Logs: `.runlogs/browser-final.log` and `.runlogs/browser-routes-final.log`.
- Android: `assembleDebug testDebugUnitTest` completed successfully; two JVM
  tests passed with zero failures/errors. APK:
  `SpeakEasyAndroid/app/build/outputs/apk/debug/app-debug.apk`.
- Windows setup/start scripts passed PowerShell syntax parsing.
- Browser screenshots: `.runlogs/browser-phoneme-result.png` and
  `.runlogs/browser-reports-mobile.png`.

Unit-test recognizer doubles validate error handling and alignment logic only.
They are separate from the live test, which used the installed real model.
