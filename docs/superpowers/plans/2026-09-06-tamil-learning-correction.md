# Tamil learning correction

User request: research Tamil letters, vowels, words and sentences; modify the
working application without questions. Continue in the existing workspace.

Research basis: Tamil Virtual Academy teacher-training section 1.2.1 lists twelve
vowels in Tamil order, five kuril and seven nedil (including ai and au). Unicode
Tamil chart confirms the exact characters, especially ஔ rather than ஒள.

1. Root: research/correct Tamil-first presentation throughout the learning shell,
   vowel practice/results/games/progress; distinguish five measured pairs from the
   full twelve-vowel alphabet. Keep stable internal target IDs and trained model.
2. Backend implementation: add authenticated Tamil catalog, acoustic word/sentence
   evaluation and evidence-backed history/progress, using the existing local ONNX
   phoneme engine. Eight words, six simple sentences; all twelve letters in catalog.
   Five vowel pairs continue through the trained vowel studio; ஐ/ஔ use phoneme
   comparison without a fabricated short/long measurement. Bound, validate and
   deduplicate uploads; integrate privacy export/deletion.
3. Frontend implementation: Tamil practice hub with three categories and reusable
   seven-second word/sentence/diphthong practice; actual audio, explicit result
   states, Tamil example voice only when available, saved progress and cleanup.
4. Root: integrate routes/navigation, research notes, backend/frontend/browser
   checks, actual live mic/model upload checks and production rebuild/restart.
5. Independent final review, correct any important findings and document evidence.

Ruling: Tamil script is primary, Roman transliteration is a small optional aid,
not an English alphabet prompt. Grammar labels do not become universal millisecond
thresholds. Existing trained model remains limited to its ten classes; no claim
that its metrics validate words, sentences or diphthongs. The broader ONNX score
is phoneme edit accuracy, not semantic sentence recognition or clinical diagnosis.

Implemented all five workstreams. The canonical 26-item catalog, authenticated
evaluation/progress endpoints, privacy integration, Tamil hub/practice, paired
vowel presentation and navigation are wired. Sixteen attributed listening WAVs
ship with the app. Final review's processing-cancellation issue is corrected and
covered by a browser regression. Rebuilt the frontend and restarted local API
8000; production preview remains on 5174. Research and verification evidence is
recorded in `docs/TAMIL_LANGUAGE_RESEARCH.md`.
