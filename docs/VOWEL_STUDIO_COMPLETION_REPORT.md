# Vowel Studio — implementation and verification

Updated 6 September 2026. Working application: **http://127.0.0.1:5174**;
API: **http://127.0.0.1:8000**. Restart instructions are in [README](../README.md).

The later [final application pass](FINAL_APPLICATION_REPORT.md) adds local fonts,
parallax, live SVG Pippin and a separately validated ஐ/ஔ classifier. Its current
verification and the [diphthong report](DIPHTHONG_MODEL_REPORT.md) supersede older
descriptions of the diphthong IPA route below; the paired-model baseline remains.

## Latest recording and quiet-input correction

The user reported undetected audio and asked for automatic seven-second capture,
better quiet-input handling, correct short/long detection, and an animated home.

- Both Vowel Studio and Tamil word/sentence practice now display a recording
  status instead of a Stop/Discard control. Vowel Pause is available between
  attempts. Seven seconds triggers evaluation automatically; navigation still
  releases the microphone and discards an unfinished recording.
- A bounded AudioWorklet preserves real mono float samples before lossy encoding.
  The timer starts after the first render input is ready. IEEE float WAV uploads
  retain small values that PCM16 would round away. Native MediaRecorder runs as
  a compatibility fallback. Worklets, message ports, buffers, streams and timers
  are cleaned up on completion, navigation, setup failure and cancellation.
  [MDN's AudioWorklet reference](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
  explains the audio rendering context; this app sends silent worklet output to
  the speaker graph, so the microphone does not play back through speakers.
- Backend quiet recovery applies at most 100x amplitude gain only when the
  established detector finds no voiced run. It preserves the existing trained
  segmentation for ordinary inputs. Raw quality levels remain separate from
  processing gain. Extremely quantized PCM16, silence, noise and ambiguous
  recordings can still request retry. No pitch shift, time stretching, sample
  repetition, target-conditioned recognition or inflated confidence is used.
- Instructions distinguish one brief குறில் from one held நெடில், followed by
  quiet. Multiple-segment feedback gives the segment count and longest duration.
  The live input meter uses a logarithmic display scale so quiet input is visible;
  this display scaling does not modify recorded samples.
- Uploads use `.wav` filenames for WAV content. One transient transport retry
  reuses the same bytes/request ID; cancellation and validation errors do not
  retry. The progress-summary crash for virtual demo accounts is fixed, and
  totals are derived from the requested learner's saved evaluations.
- Three homepage slides introduce Tamil vowels, words and sentences. The
  eight-second slideshow pauses for user controls, hover, focus, hidden tabs and
  reduced motion. Keyboard navigation, Tamil typography, gentle reveal effects
  and mobile layouts are covered by tests.

Final validation for this update:

- **262 backend tests pass; 270 frontend tests pass.**
- **75/75 browser regression cases pass in one complete run**, covering the
  homepage slideshow, Tamil practice, recording/permission/navigation cleanup,
  the ten-recording evaluation, games, saved progress and existing routes.
- **15 real browser/model cases pass across the built-preview run and targeted
  recheck (136 distinct checks).** All ten supplied held-out vowel clips matched
  their actual identity and short/long class; two additional −40 dB clips did
  too. The wrong prompt scored zero, and silence/repetition were unscorable.
  Every case uploaded actual float WAV, released its microphone and used the
  automatic seven-second capture. The targeted recheck corrected a test-harness
  assertion to read match flags from the API's returned `vowel_analysis` object.
  Evidence: `.runlogs/quiet-live-verified.json` and the source run logs.
- **Production build and 14 production-preview checks pass.** The worklet ships
  as a separate compiled asset; authentication, deep links, audio assets and
  database/vowel/speech readiness checks succeed. Main app/API remain on 5174/8000.
- The complete **200 human-sample / 120 corruption-case runtime report matches
  the previous baseline exactly**. Accepted coverage remains 161/200 and joint
  identity/length accuracy among accepted samples is 83.85%. This does not mean
  all users or all input conditions are recognized perfectly.
- Selected-clip quiet checks use twenty existing human clips, not a new
  population benchmark. Float audio acceptance is 19/20 at −20 dB and 20/20 at
  −40 dB, with no accepted identity/length changes. PCM16 acceptance improves
  from 8 to 18 at −20 dB and from 0 to 9 at −40 dB. Lost source quantization
  cannot be reconstructed. Partially detected quiet audio can still shorten a
  duration estimate or hide repetitions; gain invariance is not claimed.
- A **physical microphone** captured seven seconds of 48 kHz float WAV and
  released its track. Only capture duration/level metadata was retained; this
  hardware check is not a spoken-vowel recognition benchmark.

Reproduce with `npx vitest run` and `npx playwright test --workers=1` in `frontend`,
and the pytest command described below in `backend`. The real browser/model test
is `frontend/scripts/verify-quiet-vowels.mjs`. Its `QUIET_BROWSER_URL` can point at
a built preview backed by an isolated local QA database. It supplies known human
clips through Chromium's microphone, then uses the real recorder, API, model and
database. Machine-local evidence is saved in `.runlogs/quiet-*`.

The sections below retain the earlier implementation's architecture and baseline
verification evidence. The recording behavior above supersedes its manual-stop
workflow.

## What was analyzed and changed

The [initial audit](VOWEL_STUDIO_AUDIT.md) identified three important gaps:
the old recording timeout was not seven seconds, CTC phoneme peaks did not
measure sustained vowel length, and some learning/demo progress was fabricated.
The new studio addresses these with a dedicated recorder, trained acoustic
identity/length model, and server-owned evidence. Existing phoneme lessons,
caregiver/therapist/admin features and Android API contracts remain available.

New routes cover `/practice`, `/training`, `/games`, `/evaluate`, `/progress`
and `/credits`. Original alphabet games, letter quizzes and curriculum progress
remain at `/games/alphabet`, `/assessment/letters` and `/progress/lessons`.
Login returns to the requested learning route, including its selected vowel.

## Speech pipeline and short/long strategy

1. A user gesture requests the actual browser microphone. The seven-second
   timer starts after permission and audio initialization, not before it.
2. MediaRecorder and the float AudioWorklet capture audio while Web Audio drives
   the waveform and level. Capture finishes automatically; navigation, errors
   and completion release tracks and audio nodes.
3. The API decodes WAV/WebM/Opus/AAC, downmixes and resamples to mono 16 kHz.
   Uploads are bounded to 5 MB and twelve decoded seconds.
4. Thirty-millisecond frames at ten-millisecond hops use energy and periodicity
   to find the voiced vowel's onset and offset. Surrounding silence does not
   count toward its duration. Noise, multiple vowels, clipping and ambiguity
   cause an explicit retry with no score.
5. A calibrated ExtraTrees model predicts A/E/I/O/U from 80 MFCC statistics.
   Duration and the requested target are excluded from identity prediction.
6. A separate logistic model predicts short/long from actual log voiced duration,
   conditioned on the *predicted* identity. Boundaries are learned from training
   speakers, not hardcoded from the recording window or target prompt.
7. Confidence and temporal consistency gates decide whether to score. The result
   contains the detected vowel, length, measured duration, confidence and points.
8. Authenticated sessions save whitelisted evidence and update progress. Raw user
   audio and diagnostic features are not stored in vowel sessions.

The existing broad phoneme route still uses the quantized ONNX export of
`facebook/wav2vec2-lv-60-espeak-cv-ft`. The new isolated-vowel model is
`tamil-mendeley-v1.1-2026-09-06`; it is a separate model, not a transcript heuristic.

## Actual model evaluation

Source: the licensed [Tamil vowels-speech database](https://data.mendeley.com/datasets/2dnxmvm22k/1),
DOI 10.17632/2dnxmvm22k.1, CC BY 4.0. The verified archive supplies recordings
from twenty speakers. The pipeline accepted 29,964 segments and excluded 904
quality failures. Nested duplicate publisher splits and diphthongs were excluded.
Speaker groups are disjoint: twelve train, four validation, four test.

| Test population: 6,078 segments | Accuracy | Macro precision | Macro recall | Macro F1 |
|---|---:|---:|---:|---:|
| Identity | 81.90% | 83.01% | 82.16% | 82.27% |
| Short/long | 94.87% | 94.87% | 94.87% | 94.87% |
| Combined ten-class | 77.48% | 78.62% | 77.73% | 77.78% |

A separate 200-segment held-out runtime sample accepted 161 (80.5% coverage),
with 83.85% combined accuracy among accepted samples. Seven-second silence
padding preserved predictions for all 200, with 0.000 s maximum duration change.
The final gate abstained on all forty repeated-vowel, forty heavily clipped and
forty 5 dB white-noise corruption fixtures. The earlier failed noise audit is
retained; the revised gate uses training samples only.

See the [full model report](VOWEL_MODEL_REPORT.md),
[confusion matrices](../backend/models/vowel-classifier/confusion-matrices.png),
[evaluation JSON](../backend/models/vowel-classifier/evaluation.json) and
[runtime rows](../backend/models/vowel-classifier/runtime-evaluation.json).
Representative example clips are smoke-test fixtures, not an accuracy estimate.

## Interface, Pippin and games

The redesigned learning experience uses warm ivory, forest green, lime and coral,
expressive serif type, circular microphone composition, original garden artwork,
and consistent Pippin illustrations. Pippin is an orange kitten with blue eyes
and a blue bandana. Listening, thinking, encouragement, success and celebration
states follow actual recording and score state. Sound can be disabled; animation
respects reduced motion. Focus indicators, named controls, status announcements,
mobile navigation and responsive layouts are included.

| Game | Working interaction |
|---|---|
| Vowel Catch | Say the prompted vowel and collect matching results. |
| Short or Long | Practise the prompted identity and measured length. |
| Match the Sound | Play a human example and choose identity plus length. |
| Pippin Challenge | Follow ten spoken challenges with Pippin feedback. |
| Speed Round | Complete ten challenges with one scored answer per sound. |
| Vowel Tower | Matching identity and length add a tower level. |

All modes use server-generated challenges. Speaking games use the same real
microphone/model pipeline. Listening answers are saved separately and do not
inflate acoustic accuracy, pronunciation mastery or speaking rewards. Evaluation
shuffles all ten classes, allows unclear-audio retries, completes a saved summary
and supports comparison with previous completed evaluations.

## Scoring, rewards and persistence

Weights are identity 40, matching length 30, acoustic identity confidence 20,
and temporal consistency 10. Final educational points are the nearest integer
of the component sum, with half points upward. Confidence remains separate.
A real shipped reference scores 99.79 before rounding, earns 100 points, and
retains 0.9896 identity confidence: 100 points does not assert perfect certainty.

Scores at or below 50 receive supportive feedback; above 50 counts as success.
At least 90 earns an excellent celebration, and 100 grants the special Perfect
sound badge and 50 XP. Consecutive successful *scored* attempts create streaks.
Unscorable audio earns no score, stars or XP. A class is mastered after at least
three attempts with a last-three average of at least 80. Levels and badges derive
from saved evidence. Empty states show no invented averages or session counts.

Session ownership, challenge order, bounded attempts and atomic revision checks
prevent forged scores and duplicate saves. Retried requests are idempotent;
legacy aggregates are repaired after interrupted writes. Export and processed
account deletion include vowel sessions. Development diagnostics require an
explicit debug request and an admin role in development/test.
See [API contract](VOWEL_API_CONTRACT.md).

## Verification evidence

| Check | Result |
|---|---|
| Full backend pytest suite | **190 passed** |
| Frontend Vitest suite | **234 passed, 50 files** |
| Production Vite build | **Passed** |
| Real HTTP/API/model/MongoDB integration | **140 passed, 0 failed** |
| Browser regression | **64 cases verified:** 59 full-run passes, three corrected layout cases passed, two additional login/credits regressions passed; all 15 affected auth/public cases rechecked successfully |
| Real browser/model/MongoDB integration | **108 passed:** eleven recordings, ten listening answers, no JavaScript page errors |
| Physical microphone | **Passed:** real 48 kHz WebM/Opus capture, 32,174 bytes, device released |
| Visual inspection | Seven desktop and five mobile views; no horizontal overflow or JavaScript page errors |
| Main service health | Database, vowel model and ONNX phoneme engine ready; web preview HTTP 200 |
| Built production preview | **9 passed:** assets, layout, protected-route login, public credits and all service health checks; no JavaScript errors |

The real browser integration uses Chromium's audio-input flag to feed a held-out
**human** vowel into real getUserMedia, MediaRecorder and Web Audio. It does not
mock the API, inference or database. It checks eleven seven-second recordings,
all ten evaluation turns, ten human-reference listening answers, cleanup and
persistence. Reusing A for all evaluation targets intentionally tests mismatches;
that exercise's score is not population recognition accuracy.

The physical microphone check separately confirms hardware access and audio
capture. It does not establish accuracy on a person speaking all ten vowels.
Playwright fixture tests separately exercise permission denial, silence/retry,
pause/stop, game behavior, public/care routes, exports and accessible controls.

The final review found and fixed unreachable perfect rewards; the added real
artifact regression failed before the rounding fix and passed afterward.
Regression checks also led to fixes for evaluation overflow, a small public link
target, and a notification toggle target. Demo-login expectations now correctly
use zero fabricated sessions/stars. Python deprecation and legacy large-bundle
warnings remain non-failing maintenance items.

The final built-preview check also caught a public-credit redirect and loss of
the selected vowel after a direct signed-out practice visit. Initial cookie
checks now defer navigation to the application route guard, and credits are
explicitly public. Both regressions, related authentication flows and the rebuilt
preview passed. Temporary QA servers were stopped after verification; the main
API and production preview remain running.

### Reproduce

- Backend: from `backend/`, set `USE_TF=0` and
  `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1`, then run
  `.runtime/Scripts/python.exe -m pytest -p pytest_asyncio.plugin -o addopts='' -q`.
- Frontend: from `frontend/`, run `npx vitest run`,
  `npx playwright test --workers=1`, and `npm run build`.
- Real HTTP: start an isolated API on port 8001 with
  `MONGODB_URL=mongodb://127.0.0.1:27017`,
  `DB_NAME=speakeasy_vowel_qa_20260906`, `APP_ENV=test`, `USE_TF=0`;
  run `backend/scripts/verify_vowel_api.py` with the backend venv.
- Real browser: start Vite on 5181 with `API_PROXY_TARGET=http://127.0.0.1:8001`;
  from `frontend/`, run `node scripts/verify-vowel-browser.mjs`.
  This creates isolated QA accounts and prepares a padded human-audio fixture.
- Physical mic: `node scripts/verify-physical-microphone.mjs` with API 8000 running.
- Training and runtime evaluation: commands and provenance are in the model report.

Detailed local QA logs and generated test credentials are kept in the ignored
`.runlogs/` folder. Shareable visual evidence and the design comparison are in
[the fidelity ledger](qa/vowel-studio-fidelity-ledger.md).

## Remaining limitations

This is not a claim of 100% recognition, clinical validation, or general speech
recognition. O/U confusion remains material: held-out U recall is 58.53% and O
recall is 77.65%. Source label mapping is inferred and documented; independent
expert labels, manual boundaries and new speakers/microphones would strengthen
validation. The small repeated-vowel corpus does not establish performance for
speech impairments, all ages or accents. Quality gates cannot reject every
possible noise source. User audio is not silently reused for training.

The six modes are intentionally supportive; Speed Round retains seven-second
capture and allows breaks rather than forcing a faster utterance. Existing care
pages retain their specialized workflows within the refreshed shared shell.
This delivery is verified locally; no public deployment or new Android build is
claimed by this web redesign report.
