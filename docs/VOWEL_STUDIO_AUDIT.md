# Vowel Studio audit and execution record

Plan: docs/superpowers/plans/2026-09-06-vowel-studio.md

## Findings before changes
- Existing browser recorder captures real audio and releases tracks, but its 18-second timeout and boolean state do not satisfy the requested seven-second flow.
- The installed quantized Wav2Vec2 ONNX model produces acoustic phonemes. CTC token peaks do not mark sustained vowel boundaries; IPA length labels alone cannot establish measured duration.
- Existing input gate measures energy only. It needs a voiced vowel region and confidence/ambiguity handling.
- Signed evaluation receipts and idempotent MongoDB progress already exist. New rewards must remain server-owned and evidence-backed.
- Training module percentages include hardcoded progress. Replace them with persisted attempts and mastery.
- No labeled Tamil vowel training corpus existed in the application. The public Tamil vowels-speech database, DOI 10.17632/2dnxmvm22k.1, provides CC BY 4.0 recordings from 20 speakers. Its files and labels require validation before model training.
- Existing account, clinician, administrator, reporting, games and Android functions must retain their interfaces.
- The design reference is used only for circular composition, expressive type and atmospheric pacing. No reference branding, copy or assets are copied.

## Execution decisions
- Continue in the user's working application and preserve existing modifications; moving to a separate checkout would omit the working state the user asked to improve.
- Use a dedicated learning API and UI while retaining legacy phoneme endpoints. The new length classifier supplements, rather than falsely relabels, the existing model.
- Completion evidence will distinguish automated browser input, real recorded speech and physical microphone access from population-level recognition validation.

## Final execution evidence — 6 September 2026

- Trained and shipped the attributed v1.1 acoustic artifact with disjoint speaker
  splits, actual metrics and confusion matrices. Identity and length predictions
  remain independent of the requested target; seven-second padding does not
  alter the voiced duration.
- Replaced fabricated training/demo metrics with actual session evidence. Added
  authenticated ordered/idempotent sessions, six modes, ten-class evaluation,
  summary recommendations, mastery, streaks, XP and privacy lifecycle support.
- Completed original responsive learning UI, Pippin assets/states, microphone
  waveform and auto-stop, results, credit links and preserved care/legacy routes.
- Final review corrected the perfect-reward mismatch with integer educational
  points while preserving calibrated confidence. A real-artifact regression
  demonstrated the failure before the fix.
- Backend 190 tests passed; frontend 234 tests passed; real API integration 140
  checks passed; final real browser integration 108 checks passed. All 64 browser
  regression cases were verified (59 full-run passes plus three corrected layout
  cases passing the targeted recheck, plus two new direct-login/public-credit
  regressions). All fifteen affected auth/public cases and nine built-preview
  checks passed. Production build passed.
- Physical microphone captured actual 48 kHz WebM/Opus audio and released the
  device. Recognition metrics and physical-device validation are reported as
  separate evidence, not a 100% accuracy claim.
- Main preview is at http://127.0.0.1:5174; API and both local acoustic models are
  ready on port 8000. Full delivery details are in
  [VOWEL_STUDIO_COMPLETION_REPORT.md](VOWEL_STUDIO_COMPLETION_REPORT.md).
