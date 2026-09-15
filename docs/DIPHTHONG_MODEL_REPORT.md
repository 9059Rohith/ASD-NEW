# Tamil diphthong detector: protocol and evidence

The auxiliary model recognizes seven vowel identities, A/E/I/O/U/AI/AU, from
recorded acoustics. It supplies dedicated ஐ/ஔ practice and prevents a confidently
recognized diphthong being forced into the existing five-identity paired model.
The paired classifier and its short/long weights are unchanged. The auxiliary
does not use the requested target, recording duration, transcript, or synthetic
training audio as an identity feature.

## Why the existing IPA route was insufficient

A fixed baseline audit used 20 held-out human clips per vowel, all twelve vowels.
The general IPA recognizer matched ஐ in 10/20 and ஔ in 5/20; among its 39 scored
diphthong clips, only 15 matched. Adding silence to make seven-second recordings
reduced diphthong scoring coverage from 39/40 to 15/40. The global recording RMS
gate was diluted by silence even though measured active duration did not change.
The paired engine preserved all 200 predictions under that same padding.

The baseline is retained separately in `.runlogs/twelve-vowel-audit.json` and
`.runlogs/twelve-vowel-audit.md`, with 144 cross-target evaluations. These are a
small correlated four-speaker sample, not a population accuracy claim.

## Data, split, and prior visibility

The source is [Tamil vowels-speech database, version 1](https://doi.org/10.17632/2dnxmvm22k.1),
Revathi Arunachalam, Vijayakrishnan VK, Nandhakumar N and Akilan A (2025), CC BY 4.0.
The verified original top-level archive files are used once; nested duplicate
publisher train/test files are excluded. The existing split is retained:
12 training speakers, 4 validation speakers, 4 test speakers, seed 260906.
The source Roman labels `i` and `av` are interpreted as AI and AU; this mapping
is inferred from the archive, not supplied as an expert Tamil-script label table.
No manual onset/offset or clinical pronunciation labels are available.

Initial signal gates accepted 6,133 diphthong repetitions in addition to the
existing 29,964 monophthongs. Extraction uses actual voiced energy/periodicity,
rejecting multiple segments, clipping, or unclear voicing. Counts and original
source hashes are retained in the evaluation inventory.

**Prior test visibility is disclosed:** the original IPA baseline and first
auxiliary experiment were examined on the historical test split. Subsequent
model decisions used validation only. The final test evaluation is a frozen
protocol follow-up, not an entirely pristine unseen benchmark. Repeated
validation also makes validation results optimistic; new independently recorded
speakers and microphones remain necessary.

## Predeclared candidates and deployment gate

All candidates use 400 Extra Trees, minimum leaf size 3, random seed 260906,
sigmoid calibration on validation speakers and a fixed confidence threshold 0.60.
No threshold is chosen from test results. The deployment gate requires validation
macro F1 at least 0.65, accuracy among accepted predictions at least 0.80, and
accepted-correct recall at least 0.40 separately for AI and AU.

| Candidate | Validation macro F1 | Accepted accuracy | AI accepted-correct recall | AU accepted-correct recall | Decision |
|---|---:|---:|---:|---:|---|
| 80 MFCC, AI/AU/OTHER | 64.20% | 89.26% | 46.02% | 18.96% | Rejected |
| 80 MFCC, balanced seven identities | 75.56% | 88.50% | 47.43% | 24.17% | Rejected |
| 80 MFCC + 20 temporal deltas, balanced seven identities | 80.37% | 89.80% | 79.17% | 41.67% | Passed validation |

The final candidate samples 30 repetitions per training/validation speaker and
original source category, seed 260906: 4,320 training and 1,440 validation clips.
It retains the complete test partition for follow-up. Sampling reduces repeated
tokens within the same recording; all speakers remain disjoint. The change adds
the difference between last-third and first-third mean MFCC coefficients 1–20
to the existing 80 statistics. This captures spectral change across the vowel,
without duration or absolute gain. Sampling and features changed together;
their individual causal contributions have not been separately established.

AU remains the weakest class and only narrowly exceeds the minimum accepted
recall gate. Passing this engineering gate is not a claim of universal reliable
pronunciation assessment. The full per-class confusion matrices, precision,
recall, F1, coverage, split, and protocol live in
`backend/models/diphthong-classifier/evaluation.json`.

The frozen historical test follow-up contains 7,316 quality-accepted segments:
6,078 monophthongs and 1,238 diphthongs. Seven-identity accuracy is **80.62%**,
macro F1 **80.90%**. The confidence-only gate retains **76.16%** (5,572 segments)
with **89.20%** accuracy among retained predictions. These are auxiliary identity
metrics, not twelve-class identity-plus-length or final runtime metrics.

| Test identity | Precision | Recall | F1 | Accepted-correct recall at 0.60 |
|---|---:|---:|---:|---:|
| AI | 97.96% | 88.31% | 92.89% | 79.47% |
| AU | 91.64% | 51.49% | 65.93% | 45.38% |

Of 639 AU segments, 329 are classified as AU; 159 become O and 150 become U.
This remains a substantial weakness. The classification report also retains
all monophthong confusions, rather than presenting only successful diphthongs.

## Runtime behavior and score meaning

Both vowel engines share the bounded WAV/codec decoder and voiced-feature
extractor. Silence, detected repetition, clipping, noisy voicing, excessive
training-derived spectral flatness, ambiguous classification, and missing
auxiliary models do not earn a diphthong score. The flatness ceiling is the
larger of the existing paired training ceiling and the 99.5th percentile of
accepted training diphthong flatness, 0.0167383; no validation or test clip sets it.

AI/AU practice returns a binary educational identity match (100 or 0), with
calibrated confidence and measured active duration reported separately. A match
score of 100 does not mean perfect pronunciation or confidence of 100%. A
confident monophthong is a mismatch; no target-conditioned identity is invented.
The auxiliary does not grade short/long length or the quality of a whole word.
For API compatibility, its `actual_phonemes` field contains the canonical IPA
label of the classified AI/AU identity. This is not a frame-level IPA transcript;
`detected_vowel`, `score_method`, and `validation_source` identify the new method.

In paired practice, confident AI/AU detections cause an unscored retry with the
heard Tamil vowel. Ordinary paired predictions keep their existing calibrated
identity and log-voiced-duration length heads. If the auxiliary is absent,
paired capability remains available; dedicated AI/AU practice explicitly reports
model unavailable. `/health/vowels` exposes nested diphthong readiness and an
`all_twelve_ready` flag, and startup warms both vowel models.

Words and sentences retain the general ONNX IPA recognizer. Its speech-presence
gate now uses detected active-frame RMS, while retaining whole-recording RMS
as diagnostics. This fixes silence dilution without claiming that context crop
differences cannot alter ONNX decoding. A broader word/sentence acoustic-quality
or clinical-validation claim is not made.

Short/long monophthong length still depends on actual voiced duration. The
system cannot establish that an intentionally prolonged short articulation is
phonologically long solely from that measurement; this limitation is unchanged
and must not be described as independently validated spectral length grading.

## Reproduction

From `backend/`, set `USE_TF=0`, `OPENBLAS_NUM_THREADS=2`, `OMP_NUM_THREADS=2`.
Run `scripts/diphthong_train.py` for initial source extraction, then
`scripts/diphthong_train_balanced.py --temporal` for the declared final candidate.
The intermediate balanced-only experiment is reproducible without `--temporal`.
These scripts use the backend `.runtime/Scripts/python.exe` environment.

Human reference fixtures, when exported by `scripts/diphthong_references.py`,
are selected correctly classified examples with source bounds and split
attribution. They are playback/regression fixtures, not accuracy estimates.
Feature caches and rejected candidate weights remain ignored local artifacts.

## Final runtime comparison and regressions

The final runtime was exercised on the **same 240 baseline human segments**,
with the same source sample bounds and a seven-second silence-padded copy of
every segment. Correct means the application's target identity/length match for
paired vowels, or identity match for diphthongs; the old IPA route used an exact
canonical-phone match. This compares application outcomes, not equivalent
fine-grained phonetic-assessment models.

| Target | Clips | Before: scored / correct | After: scored / correct |
|---|---:|---:|---:|
| a | 20 | 18 / 17 | 18 / 17 |
| aa | 20 | 17 / 17 | 17 / 17 |
| i | 20 | 15 / 14 | 15 / 14 |
| ii | 20 | 17 / 16 | 17 / 16 |
| u | 20 | 16 / 7 | 15 / 7 |
| uu | 20 | 13 / 11 | 13 / 11 |
| e | 20 | 15 / 14 | 15 / 14 |
| ee | 20 | 17 / 17 | 17 / 17 |
| ai | 20 | 20 / 10 | 17 / 17 |
| o | 20 | 12 / 10 | 12 / 10 |
| oo | 20 | 17 / 16 | 17 / 16 |
| au | 20 | 19 / 5 | 19 / 10 |

Diphthong scored coverage changes from **39/40 to 36/40 (90%)**; correctness
among scored clips changes from **15/39 (38.46%) to 27/36 (75%)**. AI is correct
on 17/20 total clips, with three abstentions. **AU is still correct on only
10/20 total clips (10/19 scored, 52.63%)**; nine confidently wrong outcomes
remain. The small-sample improvement must not be described as reliable universal
AU pronunciation grading.

Seven-second padding preserves predictions and measured active durations for
**240/240** final cases. Diphthong padded scoring coverage rises from 15/40 to
36/40, matching unpadded coverage. This directly removes the baseline silence
dilution problem for these diphthong inputs.

All **144 cross-target combinations** were rerun on the same twelve baseline
exemplars. All 24 source/engine comparisons preserve recognition across target
changes. The AI/AU examples formerly scored as paired E/O now trigger a
diphthong retry for **all 20 paired-target submissions**, with no paired score.

In the paired portion of this separate sample, accepted coverage changes from
157/200 to **156/200**, retaining all 139 previously correct accepted results
(89.10% accuracy among accepted). One U clip receives an extra diphthong retry;
the paired engine had already classified it incorrectly. This is still a false
diphthong rejection of a labeled monophthong, and is reported rather than hidden.

The **original independent 200-case regression** (seed 6092026) and its **120
corruption cases** were rerun separately. Every human row, corruption row, and
summary matches the saved baseline exactly: 161/200 accepted (80.5%), 135/161
correct (83.85%), all 200 padding predictions preserved with zero duration
difference, and all 120 corruptions unscored. The previous report file was
preserved; the rerun is `.runlogs/paired-runtime-after-diphthong.json`.

Additional all-twelve stress checks use one fixed human clip per test speaker
and category, separate from recognition metrics: **48/48 noisy (5 dB white
noise), 48/48 clipped, and 48/48 repeated** inputs abstain, as do all 12 silence,
12 pure-noise, and 12 very-short noise inputs. At −40 dB gain with float WAV,
41/48 clips are scorable and 33 are correct. These are specific engineering
stresses, not proof of robustness to every microphone or background sound.

The full backend pytest suite reports **275 passed**, including real AI/AU
fixtures, seven-second padding, −40 dB float capture, target independence, shared
quality rejection, Tamil routing, and both existing shipped human diphthong
playback files. Existing paired fixtures remain valid. The 15 warnings are
pre-existing deprecations. PowerShell's native-stderr wrapper can return a
nonzero shell status for those warnings; use `exit $LASTEXITCODE` after pytest
to preserve the test process's exit status in scripted runs.

Final runtime rows are in `backend/models/diphthong-classifier/runtime-evaluation.json`;
the archived before rows are in `baseline-runtime-evaluation.json`. Reproduce
the exact sample with `scripts/diphthong_evaluate_runtime.py`, which also records
the cross-target matrix. No additional test-driven parameter changes followed
the final model freeze.
