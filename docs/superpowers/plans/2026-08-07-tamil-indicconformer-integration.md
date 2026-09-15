# Tamil IndicConformer Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use the supplied Tamil IndicConformer checkpoint in both Training and Tamil Story evaluation while retaining existing acoustic checks and robust recognizer fallbacks.

**Architecture:** A focused, lazily loaded `IndicConformerService` owns NeMo restoration and transcription. Existing evaluators receive transcription dependencies and remain responsible for target matching, scoring, and feedback; unit tests inject fake transcribers so routine test runs never load the 499 MB checkpoint.

**Tech Stack:** Python 3.11, FastAPI, PyTorch, AI4Bharat NeMo, librosa, pytest

## Global Constraints

- Only the authored Tamil curriculum targets may be evaluated.
- The `.nemo` checkpoint, recordings, transcripts, and secrets must not be committed.
- API startup and both session types must remain usable when IndicConformer is unavailable.
- Model loading must be lazy, thread-safe, and occur at most once per process.
- IndicConformer provides transcription evidence, not a clinical or standalone pronunciation score.
- No Git commit, push, or PR is performed without separate explicit authorization.

## File Structure

- Create `backend/app/services/indicconformer.py`: checkpoint resolution, model lifecycle, audio preparation, and transcription.
- Create `backend/tests/test_indicconformer.py`: isolated service tests without loading the real model.
- Modify `backend/app/config.py`: three IndicConformer settings.
- Modify `backend/.env.example`: documented local configuration.
- Modify `.gitignore`: exclude `.nemo` model artifacts.
- Modify `backend/app/services/speech_evaluator.py`: prefer injected IndicConformer transcription for Training targets.
- Modify `backend/app/services/tamil_story_evaluator.py`: prefer IndicConformer and fall back to the existing Tamil Whisper adapter.
- Modify `backend/tests/test_speech_evaluator.py`: Training recognition/source/fallback tests.
- Modify `backend/tests/test_tamil_story_evaluator.py`: story recognizer precedence and fallback tests.
- Create `backend/scripts/smoke_indicconformer.py`: explicit real-checkpoint smoke test using a user-supplied WAV.

---

### Task 1: IndicConformer Runtime Adapter

**Files:**
- Create: `backend/app/services/indicconformer.py`
- Create: `backend/tests/test_indicconformer.py`
- Modify: `backend/app/config.py`
- Modify: `backend/.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `IndicConformerUnavailable(RuntimeError)`.
- Produces: `IndicConformerService(model_path: str | Path, enabled: bool = True, device: str = "auto", model_loader: Callable | None = None)`.
- Produces: `IndicConformerService.transcribe(audio_bytes: bytes) -> str`.
- Produces: singleton `indicconformer_service`.

- [ ] **Step 1: Write failing configuration and service tests**

Test that settings accept `INDICCONFORMER_ENABLED`, `INDICCONFORMER_MODEL_PATH`, and `INDICCONFORMER_DEVICE`; a fake loader is called once across two transcriptions; disabled/missing/corrupt models raise `IndicConformerUnavailable`; and temporary WAV files are removed after success and failure.

- [ ] **Step 2: Verify RED**

Run: `cd backend; python -m pytest tests/test_indicconformer.py -q`

Expected: collection failure because `app.services.indicconformer` does not exist.

- [ ] **Step 3: Implement the minimal adapter**

Resolve the configured path without importing NeMo at module import time. Inside the default loader, import `nemo.collections.asr`, restore `ASRModel.restore_from`, select CPU/CUDA, call `eval()`, and move the model to the selected device. Convert uploaded bytes with librosa to normalized 16 kHz mono PCM WAV in a named temporary file, call `model.transcribe([path])`, normalize NeMo's possible string/hypothesis/list return shapes, and delete the file in `finally`.

- [ ] **Step 4: Protect the model artifact**

Add `*.nemo` to `.gitignore` and document the three environment values in `backend/.env.example`.

- [ ] **Step 5: Verify GREEN**

Run: `cd backend; python -m pytest tests/test_indicconformer.py -q`

Expected: all adapter tests pass without importing or loading real NeMo.

### Task 2: Main Training Session Integration

**Files:**
- Modify: `backend/app/services/speech_evaluator.py`
- Modify: `backend/tests/test_speech_evaluator.py`

**Interfaces:**
- Consumes: `IndicConformerService.transcribe(audio_bytes: bytes) -> str`.
- Produces: `SpeechEvaluator(indic_transcriber: Callable[[bytes], str] | None = None)`.
- Produces response source `server_indicconformer` when its Tamil transcript validates the target.

- [ ] **Step 1: Write failing Training tests**

Inject a transcriber returning each authored Tamil spelling and assert that real non-silent audio validates the matching Training target with `validation_source == "server_indicconformer"`. Add tests proving mismatched/empty transcripts do not pass and `IndicConformerUnavailable` continues into the existing recognizer path.

- [ ] **Step 2: Verify RED**

Run: `cd backend; python -m pytest tests/test_speech_evaluator.py -q`

Expected: failures because `SpeechEvaluator` does not accept or call an IndicConformer transcriber.

- [ ] **Step 3: Implement minimal Training integration**

After signal/duration validation and the existing trusted browser fast path, call the injected/default IndicConformer transcriber. Reuse the evaluator's bounded target matching, set the transcript and source only on a valid result, and continue to the current Wav2Vec2 path when IndicConformer is unavailable or fails. Preserve MFCC, airflow, duration, GOP, feedback, and result schema.

- [ ] **Step 4: Verify GREEN and regressions**

Run: `cd backend; python -m pytest tests/test_speech_evaluator.py tests/test_advanced_speech.py -q`

Expected: all tests pass.

### Task 3: Tamil Story Integration with Whisper Fallback

**Files:**
- Modify: `backend/app/services/tamil_story_evaluator.py`
- Modify: `backend/tests/test_tamil_story_evaluator.py`
- Modify: `backend/tests/test_tamil_story_routes.py`

**Interfaces:**
- Consumes: `IndicConformerService.transcribe(audio_bytes: bytes) -> str`.
- Produces: `TamilStoryEvaluator(indic_transcriber: Callable | None = None, transcriber_factory: Callable | None = None, ...)`.
- Produces response method `indicconformer_tamil_asr` for IndicConformer and existing `tamil_asr` for Whisper fallback.

- [ ] **Step 1: Write failing story tests**

Assert that `amma`, `kavi_vaa`, and `kavi_bridge` prefer the injected IndicConformer transcriber, exact transcripts score 100, vowels never invoke ASR, and unavailable/empty IndicConformer output invokes the lazy Whisper fallback once. Assert both recognizers unavailable return the existing explicit capability response.

- [ ] **Step 2: Verify RED**

Run: `cd backend; python -m pytest tests/test_tamil_story_evaluator.py tests/test_tamil_story_routes.py -q`

Expected: failures because story evaluation currently has only one ASR adapter.

- [ ] **Step 3: Implement minimal story routing**

Keep acoustic vowel routing unchanged. For ASR targets, try IndicConformer first, normalize its output, and score it when non-empty. On unavailable/error/empty output, lazily initialize and use the existing Whisper transcriber. Return the recognizer-specific method and retain the current bounded feedback/capability schema.

- [ ] **Step 4: Verify GREEN**

Run: `cd backend; python -m pytest tests/test_tamil_story_evaluator.py tests/test_tamil_story_routes.py -q`

Expected: all story tests pass.

### Task 4: Real-Model Smoke Test and Full Verification

**Files:**
- Create: `backend/scripts/smoke_indicconformer.py`
- Modify: `README.md`

**Interfaces:**
- Consumes: configured `.nemo` checkpoint and a 16 kHz-compatible WAV path.
- Produces: exit code 0 plus a non-empty transcript, or exit code 1 with a concise capability error.

- [ ] **Step 1: Write a failing CLI contract test**

Add subprocess or callable-main tests proving missing audio, missing model, and successful injected transcription produce deterministic exit codes without loading NeMo.

- [ ] **Step 2: Verify RED**

Run: `cd backend; python -m pytest tests/test_indicconformer.py -q`

Expected: CLI tests fail because the smoke module does not exist.

- [ ] **Step 3: Implement the smoke command and documentation**

Accept `--audio`, optional `--model`, and `--device`; invoke `IndicConformerService`; print only capability status, elapsed time, and transcript. Add exact local setup and smoke-test commands to `README.md`, while stating that a real voice sample is required for recognition acceptance.

- [ ] **Step 4: Verify focused backend tests**

Run: `cd backend; python -m pytest tests/test_indicconformer.py tests/test_speech_evaluator.py tests/test_tamil_story_evaluator.py tests/test_tamil_story_routes.py -q`

Expected: all focused tests pass.

- [ ] **Step 5: Verify the complete project**

Run: `cd backend; python -m pytest -q`

Run: `cd frontend; npm test -- --run`

Run: `cd frontend; npm run build`

Expected: each command exits 0.

- [ ] **Step 6: Run real-checkpoint verification**

Run: `cd backend; python scripts/smoke_indicconformer.py --audio <real-tamil-wav> --model ..\indicconformer_stt_ta_hybrid_rnnt_large.nemo --device auto`

Expected: the checkpoint restores once and returns a non-empty Tamil transcript. If no WAV or compatible NeMo runtime exists, report that exact remaining acceptance-test blocker rather than claiming real inference works.

- [ ] **Step 7: Inspect final scope**

Run: `git status --short` and `git diff --check`.

Expected: only planned source/test/docs changes appear; the `.nemo` file is ignored; no whitespace errors appear.
