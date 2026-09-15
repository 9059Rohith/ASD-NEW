# Tamil Curriculum and Voice Design

## Goal

Make every therapy lesson available for the 12 Tamil vowels and four requested words, remove Pippin from therapy training, and use a consistent Indian Tamil voice for Tamil playback.

## Curriculum

The canonical ordered curriculum contains 16 items: `அ ஆ இ ஈ உ ஊ எ ஏ ஐ ஒ ஓ ஔ`, followed by `அம்மா`, `அப்பா`, `மரம்`, and `பழம்`. The backend lesson API is authoritative. Each item has a stable numeric ID, Tamil symbol, romanized label, evaluation target, teaching tip, and `ta-IN` speech text. The Training roadmap renders the API curriculum instead of maintaining a conflicting hard-coded subset. Every lesson is directly accessible; existing progress may decorate a lesson but must not lock curriculum content.

## Tamil voice

Tamil playback uses a central voice contract. The primary provider is Azure Speech with locale `ta-IN` and voice `ta-IN-PallaviNeural`, selected because it is a dedicated Indian Tamil neural voice. The backend exposes only allow-listed curriculum and authored session prompts, caches returned MP3 bytes, rate-limits requests, and keeps credentials server-side. When Azure is not configured or temporarily unavailable, the frontend falls back to Web Speech with language `ta-IN` and selects an exact Tamil-India installed voice before any other Tamil voice. It must never deliberately select an English/American voice for Tamil text.

The application can guarantee the requested locale and provider selection, but audible output still depends on valid Azure credentials/network or an installed Tamil browser voice.

## Training UI

The therapy slide layout contains only the lesson content. `PippinTrainingCoach` is no longer imported or rendered in `SlideManager`; unrelated Pippin story/play routes remain unchanged. Removing the second column restores the session content to the full available width.

## Data flow and failure behavior

The Training page loads `/api/therapy/lessons`, displays the 16 ordered items, and navigates each item to `/therapy/:id`. Listen/repeat actions request the allow-listed Tamil audio by lesson voice key. Successful responses play an MP3; 404 means an invalid key and 503 triggers the `ta-IN` browser fallback. Playback controls expose unavailable state when neither path exists.

## Testing

Backend tests verify all 16 lesson records, exact Tamil strings and IDs, Azure request locale/voice/SSML contract, allow-list rejection, caching, and provider failure. Frontend tests verify exact `ta-IN` voice preference, the 16-item roadmap behavior, Tamil playback fallback, and absence of Pippin from therapy sessions. Existing backend and frontend suites, production build, and a Playwright-rendered desktop/mobile training flow provide regression coverage.
