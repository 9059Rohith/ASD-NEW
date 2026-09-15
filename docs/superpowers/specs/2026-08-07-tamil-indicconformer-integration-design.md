# Tamil IndicConformer Integration Design

**Date:** 2026-08-07
**Status:** Approved in conversation; awaiting written-spec review

## Goal

Use the supplied Tamil IndicConformer `.nemo` checkpoint for speech recognition in both the main Training session and the Tamil Story session while preserving the existing acoustic safeguards and a reliable fallback path.

## Scope

- Integrate `indicconformer_stt_ta_hybrid_rnnt_large.nemo` with the FastAPI backend.
- Use IndicConformer for the six bounded Training targets and the three ASR-backed Tamil Story targets.
- Retain the current acoustic vowel scoring for Tamil Story vowel targets.
- Retain Training voice-activity, duration, MFCC, airflow, and pronunciation feedback logic.
- Do not treat ASR output as a clinical diagnosis or as the sole pronunciation score.
- Do not commit the approximately 499 MB checkpoint to Git.

## Architecture

Create a focused `IndicConformerService` responsible for checkpoint discovery, lazy thread-safe model loading, audio conversion, transcription, and capability reporting. The service will restore the AI4Bharat NeMo ASR model from the configured local checkpoint and transcribe normalized 16 kHz mono audio. Model loading occurs once per backend process so interactive requests do not repeatedly pay startup cost.

`SpeechEvaluator` and `TamilStoryEvaluator` will consume the service through small injected transcription interfaces. This keeps their scoring responsibilities separate from model lifecycle management and permits deterministic tests without loading the 499 MB model.

## Configuration

The backend will expose these settings:

- `INDICCONFORMER_ENABLED`: defaults to `true` for local development.
- `INDICCONFORMER_MODEL_PATH`: defaults to the checkpoint at the repository root when present, with an explicit environment override for other installations.
- `INDICCONFORMER_DEVICE`: `auto`, `cpu`, or `cuda`; `auto` selects CUDA only when supported.

Startup will remain lightweight. A missing checkpoint or missing/incompatible NeMo runtime will not prevent the API from starting.

## Data Flow

### Main Training session

1. The existing endpoint validates authentication, upload size/type, lesson ID, and target.
2. Existing signal and duration checks reject silence or unusable recordings.
3. A trusted matching browser transcript may retain its current fast path.
4. Otherwise IndicConformer transcribes the recording.
5. The normalized Tamil transcript is compared against a fixed allow-list mapping for `a`, `aa`, `la`, `ta`, `amma`, and `appa`.
6. Existing MFCC, airflow, duration, and feedback logic combines with the transcription result.
7. If IndicConformer is unavailable, the current server recognizer/fallback behavior remains available and the response reports the actual validation source.

### Tamil Story session

1. The existing endpoint validates authentication, upload size/type, and fixed target ID.
2. `a` and `ii` continue using bounded acoustic vowel scoring.
3. `amma`, `kavi_vaa`, and `kavi_bridge` use IndicConformer first.
4. If IndicConformer is unavailable, the existing Tamil Whisper adapter is used.
5. Existing Tamil Unicode normalization and target similarity scoring produce the result.
6. The response method/source identifies which recognizer produced the transcript without exposing configuration details.

## Error Handling and Safety

- Model loading is lazy, thread-safe, and attempted once unless explicitly reset in tests.
- Missing model files, dependency errors, corrupt checkpoints, inference errors, and empty transcripts return a capability/fallback result instead of crashing the API.
- Uploaded child audio is processed in memory or temporary storage only as required by NeMo and is not persisted by this integration.
- Logs must not contain audio, child identifiers, full transcripts, secrets, or local configuration details.
- Arbitrary requested text remains rejected; only authored curriculum targets can be evaluated.

## Dependencies and Deployment

AI4Bharat NeMo compatibility will be isolated from the existing core dependency set as far as practical. The local laptop environment must install a NeMo version capable of restoring the supplied checkpoint. The production Render image will not be assumed capable until memory, image size, startup time, and inference latency are measured. Local CPU inference is supported but may not meet the desired interaction latency; CUDA is preferred when available.

## Testing

Automated tests will cover:

- Configuration and checkpoint resolution.
- Lazy, single-load behavior.
- Audio normalization and transcription delegation.
- Tamil target normalization and matching.
- Training-session IndicConformer success and fallback behavior.
- Tamil Story IndicConformer success and Whisper fallback behavior.
- Missing dependency, missing/corrupt model, inference failure, and empty transcript handling.
- Existing authentication, upload validation, rate limiting, and response contracts.

Verification will run the focused backend tests, the complete backend suite, frontend tests/build, and a real-checkpoint smoke test when the installed NeMo runtime can restore the supplied file. A live microphone acceptance test remains necessary to judge real child-speech accuracy and perceived latency; automated tests cannot establish 100% recognition accuracy.

## Success Criteria

- Both requested sessions prefer IndicConformer for supported Tamil ASR targets.
- The model loads no more than once per backend process.
- Both sessions remain usable when IndicConformer is unavailable.
- All existing and new automated tests pass.
- A supplied WAV smoke test returns a Tamil transcript with the real checkpoint, or the exact missing runtime/hardware blocker is reported.
- No checkpoint, recorded audio, transcript, or secret is added to Git.
