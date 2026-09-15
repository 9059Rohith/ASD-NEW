# Tamil curriculum correction — 6 September 2026

Implementation follow-up: the Tamil curriculum decisions below remain current.
The later [final application report](FINAL_APPLICATION_REPORT.md) documents the
new [acoustic ஐ/ஔ classifier](DIPHTHONG_MODEL_REPORT.md), replacing the initial
generic IPA path for those two isolated vowels. Words and sentences retain IPA
comparison with its documented limitations.

The request was to make Tamil letters, vowels, words and sentences central to the
application. The earlier studio visually emphasized Roman A/E/I/O/U and offered
five measured pairs; that was not a complete presentation of Tamil vowels.

## Primary references and decisions

- [Tamil Virtual Academy, teacher-training grammar 1.2.1](https://www.tamilvu.org/courses/teacher_training/tt02/tt0201/tt0102012.htm)
  establishes the twelve independent vowels and the traditional classification:
  அ இ உ எ ஒ are குறில்; ஆ ஈ ஊ ஏ ஐ ஓ ஔ are நெடில். The page also discusses
  context-dependent shortening. Grammar's மாத்திரை is not treated as a fixed
  universal number of milliseconds by this application.
- [Unicode Tamil character list](https://www.unicode.org/charts/nameslist/n_0B80.html)
  supplies exact characters. ஔ is U+0B94; it must not be typed as the unrelated
  sequence ஒள. Tamil strings are saved as UTF-8, with Tamil font coverage.
- [Tamil Virtual Academy dictionary entry for ஈ](https://www.tamilvu.org/slet/pmdictionary/ldttamls.jsp?x=9621&y=9843)
  supports the beginner example “ஈ / fly”; the old English-only “Long II” gloss
  was not a word meaning.
- [Keane, Tamil, Journal of the International Phonetic Association (2004)](https://doi.org/10.1017/S0025100304001549)
  describes Tamil's consonant/vowel phonetics and variation. Added word and
  sentence targets use broad explicit IPA. They are not a claim of a single
  correct dialect or full phonetic assessment.

The words and short sentences below are original beginner examples, not copied
textbook passages. English meanings are separate from Tamil text. Roman forms
are secondary pronunciation aids, not English letter-name instructions.

## Curriculum and presentation

Tamil order is **அ ஆ இ ஈ உ ஊ எ ஏ ஐ ஒ ஓ ஔ**. The ten existing measured classes
remain அ/ஆ, இ/ஈ, உ/ஊ, எ/ஏ and ஒ/ஓ. ஐ and ஔ are visible and individually
practisable; they are not assigned invented short counterparts or sent to the
ten-class classifier. Tamil symbols now lead prompts, choices, results, vowel
pairs and progress maps. English aliases stay internal to existing models/APIs.

The new Learn Tamil hub separates உயிரெழுத்துகள், சொற்கள் and வாக்கியங்கள்.
The canonical catalog supplies all content to the frontend:

| Category | Items |
|---|---|
| Vowels | All twelve, with five குறில் and seven நெடில் labels |
| Words | அம்மா, அப்பா, மரம், பழம், ஆடு, இலை, உப்பு, எலி |
| Sentences | அம்மா, வா. · அப்பா, வா. · கவி, வா. · இது மரம். · இது பழம். · அப்பா, மரத்தைப் பார். |

Existing lesson IDs are preserved. Old example fields that were English glosses
masquerading as sentences now contain complete Tamil examples.

## What scoring does

The trained ten-class vowel model still measures identity and actual voiced
length independently of the prompt. Its existing held-out metrics are unchanged.
Words and sentences use the local ONNX acoustic phoneme recognizer. The later
[diphthong model update](DIPHTHONG_MODEL_REPORT.md) replaces the ஐ/ஔ IPA route
with a separately trained, target-independent acoustic classifier and shared
vowel quality gates. Its educational identity-match score and calibrated
confidence remain separate; it does not infer diphthong identity from duration.
Audio recognition happens before comparison with the catalog's expected phones.
The score is phoneme edit agreement. It is neither a Tamil ASR transcript nor
semantic sentence correctness. Recognition confidence stays separate from score.

New attempts are authenticated, owner-scoped and idempotent, with bounded audio
uploads and saved aggregate progress. Unclear/model-unavailable attempts receive
no fabricated score. Raw microphone audio is not retained. Privacy export and
processed account deletion include the new evidence collection.

Tamil reference playback prefers a shipped Tamil recording; any browser fallback
must use an actual Tamil voice. An English voice is never silently substituted.
Synthesized examples are labeled separately from human references and are not
used to claim human recognition accuracy.

## Validation limits

Catalog, Unicode, target-token coverage, API ownership/replay, microphone flows,
rendered Tamil text, persistence and responsive layouts are tested. Word/sentence
accuracy has not been established with a new independent human Tamil dataset.
The broad phoneme model does not assess every contextual allophone or nasal
length contrast. Existing vowel metrics cannot be transferred to sentences.

The live checks exposed a specific limitation: the general ONNX recognizer
decoded the synthesized அம்மா example as `a l l aː`, scoring 33.33 against அம்மா.
It also scored 33.33 against அப்பா (a tie), but 0 against எலி. The synthesized
இது மரம். example scored 12.5. These are integration observations, not measured
human recognition accuracy. Either synthesis or recognition can contribute to
these errors; no independent speaker evaluation establishes their cause. The
application displays actual detected sounds and does not force the expected
answer or inflate these scores.

## Listening examples

Fourteen word/sentence examples were generated locally with
[Meta's MMS-TTS-Tamil](https://huggingface.co/facebook/mms-tts-tam), revision
`e9cf59dae34f0f51e3b1842876a658e4516f9fe4`, under CC BY-NC 4.0. They are labeled
synthesized examples and supplied for noncommercial educational use.
The model vocabulary lacks standalone ஔ; substituting ஒள would change the
letters. Instead, both ஐ and ஔ use human segments from training speaker F943 in
the existing CC BY 4.0 Mendeley Tamil vowel data. The ஔ segment has low ONNX
confidence, recorded in the manifest, and is not an accuracy benchmark.

The generator strictly loads every model weight, records source text, sample
ranges, revision and checksums, and emits mono 16 kHz PCM WAVs. See
`frontend/public/assets/tamil-reference/ATTRIBUTION.md` and `manifest.json` for
full provenance. `backend/scripts/generate_tamil_references.py --verify-only`
validates all sixteen files without downloading or loading a model.

## Verification on 6 September 2026

- Backend: **210 tests passed**, including catalog, phoneme targets, upload
  validation, owner scope, replay/conflict, saved progress and privacy behavior.
- Frontend: **251 tests passed**, including all Tamil letters, voice selection,
  UUID fallback, same-request transport retry and honest result states.
- Browser regression: **71 distinct cases verified across the full run and
  targeted rechecks**. The full 70-case run passed 67 initially. Its three
  failures were corrected and individually passed: the route control audit now
  recognizes tested ARIA roving tabs and the appointment notes button has a
  larger hit area; the mobile Tamil homepage heading fits its viewport; and the
  Pippin assertion expects its new Tamil prompt. One additional processing-state
  regression passed. Existing games, ten seven-second evaluation recordings,
  progress export, route/auth flows and microphone cleanup are covered.
- Real local API/model/browser integration: **60 checks passed**. All 26 reference
  audio URLs load; actual MediaRecorder word/sentence recordings reach the ONNX
  evaluator, return measured results and persist in MongoDB. Replay saves once,
  cross-item replay conflicts, and changing a prompt leaves detected phones
  unchanged. Playback, track cleanup, privacy export, desktop/mobile overflow
  and JavaScript error checks pass. Input speech in these integration checks is
  synthesized Tamil routed through Chromium's microphone, not a human benchmark.
- Audio integrity: **16 WAV files validated**, no unavailable examples.
- Production build succeeds; **14 preview checks pass**, covering public assets,
  protected Tamil deep links and preserved login destination, attribution, the
  registered Tamil API, and database/vowel/speech readiness.
- Independent review checked token coverage and owner/replay/privacy behavior,
  then reviewed frontend authentication, recording cleanup and audio playback.
  Its processing-cancellation finding is fixed: after submission, the page does
  not offer to discard work that the server may already be saving. A dedicated
  browser regression verifies this behavior with a held server response.

Reproduce unit/backend checks from the corresponding directory:

```powershell
# backend
$env:USE_TF='0'
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
.runtime/Scripts/python.exe -m pytest -p pytest_asyncio.plugin -o addopts='' -q
.runtime/Scripts/python.exe scripts/generate_tamil_references.py --verify-only

# frontend
npx vitest run
npx playwright test --workers=1
npm run build
```

The live test script is `frontend/scripts/verify-tamil-live.mjs`; it uses API
8001 and web 5181 with a separate local QA database. Machine-local evidence is
in `.runlogs/tamil-live-verification.json` and the `tamil-*-final.log` files.

Representative screenshots are in `docs/qa/tamil-letters-desktop.png`,
`tamil-words-desktop.png`, `tamil-word-result.png`, `tamil-sentence-mobile.png`
and `tamil-vowel-mobile.png`.
They show actual rendered Tamil, including an honestly low model result.
