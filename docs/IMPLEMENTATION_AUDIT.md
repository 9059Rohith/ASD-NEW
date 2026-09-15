# Completion audit — 6 September 2026

The working tree already contained extensive uncommitted product work. Preserve it.
The primary application is the repository root, not one of the reference folders.

## Existing architecture and defects

React/Vite uses cookie-authenticated FastAPI endpoints and MongoDB. Kotlin/Compose
shares the API. Training uses MediaRecorder, browser-side WAV conversion, evaluation,
then a separate progress save. Caregiver/therapist dashboards, notes, consent,
appointments, games, reports and role routing already exist.

The evaluator accepted only 6 targets against a 16-lesson curriculum. Its English
letter recognizer was described as phoneme recognition. Hand-authored MFCC vectors,
score floors and error fallback values produced unsupported pronunciation numbers.
The standalone multilingual listener already identifies an appropriate acoustic IPA
model, but was not connected to the web application. Its local model cache lacks
weights. The global Python installation has a NumPy/Numba incompatibility. Baseline
frontend: 209 tests pass and production build passes; backend: 15 failures.

Recorder defects: fixed WebM MIME, no unmount cleanup, no duration bound, concurrent
permission requests, stale stop events, and optional speech recognition exceptions
can incorrectly fail an otherwise active recording. Progress trusts client scores,
drops phoneme evidence, counts attempts only when improved, and hardcodes 6 lessons.

## Reference comparison

| Local reference | Examined implementation | Decision |
|---|---|---|
| Talky | Flask main, phonemization, stream decode, alignment tests, lesson assessment | Adopt separation of acoustic phones from textual transcription; implement original alignment code |
| Cboard | SpeechProvider TTS/voice selection and browser handling | Keep browser voice support and explicit availability handling; no copied assets/code |
| AACessTalk | FastAPI structure, speech recognizer abstraction, contextual communication | Preserve existing caregiver/child interaction and scoped persistence |
| TalkingPet | Existing standalone browser voice experience | Keep it separate; main app already contains Pippin |
| LiveTalk-Unity | Package architecture and runtime scripts | Optional Unity integration, not a dependency for browser phoneme detection |
| gandeeva | Windows voice assistant architecture and runtime files | Keep separate; assignment-only license precludes wholesale reuse |

Other references named in the brief (BabAR, ASDSpeech, OpenAAC, Otsimo, sherpa,
whisper.cpp and Speech Therapy for Kids) are not present as local repositories.
No reference repository is being substituted for the application.

## Implementation sequence

1. Add tested audio validation, real CTC IPA inference, explicit Tamil target
   sequences and deterministic insertion/deletion/substitution alignment.
2. Integrate every curriculum target with the existing browser evaluation UI.
3. Fix recorder lifecycle and stop/retry/error handling.
4. Preserve server-issued analysis through idempotent progress persistence.
5. Run backend, frontend, browser and Android checks; fix observed failures.
6. Document exact runtime setup, evidence and remaining platform/model limits.

Scoring is phoneme edit accuracy, not a diagnosis or calibrated probability of
correct pronunciation. Acoustic token posterior confidence is reported separately.
No missing-model fallback may invent a score or accept client transcript as proof.
