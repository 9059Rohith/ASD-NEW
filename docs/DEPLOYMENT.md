# Production deployment

The repository is deployable as two services sharing one API:

- Render runs `backend/` from `render.yaml`.
- Vercel runs `frontend/` and rewrites `/api/*` to the Render API.
- Android release builds use the Render HTTPS URL from `BuildConfig.BASE_URL`.

The default speech engine is now local ONNX acoustic phoneme recognition with IPA edit alignment. The Docker build downloads the pinned model; no IndicConformer or GOP runtime is required for pronunciation scoring. See [the implementation and verification report](COMPLETION_REPORT.md) for exact setup, test results and unverified deployment limits. Speech recordings remain transient; signed phoneme evidence and scores are saved to MongoDB. Configure and measure resource capacity on the deployment target before publishing.

The Docker image also copies the vowel and diphthong classifier artifacts from `backend/models`. Include both `classifier.joblib` files and the vowel reference clips in the source delivered to the build; a local build cannot make them appear in a remote Git checkout. A short-vowel browser regression test uses a recorded short `e` once during a seven-second capture: it must fail a long `ee` target and succeed on a short `e` target. This is a regression check, not a claim of perfect recognition accuracy.

## Render

1. Create a MongoDB Atlas database and allow the Render outbound network access.
2. Create a Cloudinary account for durable audio/avatar uploads.
3. In Render, create a Blueprint from this repository. The Blueprint creates
   `speakeasy-asd-api` and its `/health/live` health check.
4. Set `CORS_ORIGINS` to the exact Vercel production origin, for example
   `https://speakeasy-asd.vercel.app` (comma-separate additional preview origins
   only when needed).
5. Fill the synced MongoDB, admin, and Cloudinary secrets. Do not commit them.
6. Confirm `https://speakeasy-asd-api.onrender.com/health/ready` returns
   `{"status":"ready","database":"ok"}`.

Production startup now fails fast if the database is local, the admin address is
the example value, CORS is wildcard/non-HTTPS, trusted hosts are wildcard/local,
development codes are exposed, MongoDB certificate validation is disabled, or
only part of the Cloudinary credential set is supplied. The Blueprint disables
the optional IndicConformer experiment because that checkpoint/runtime is not
part of the production image; the bundled ONNX phoneme engine and vowel models
remain enabled. A `404` from the documented Render hostname means the Blueprint
has not been provisioned yet, not that the API health route is ready.

## Vercel

1. Import the repository and set the project root to `frontend`.
2. Framework preset: Vite; build command `npm run build`; output directory `dist`.
3. Set `VITE_API_BASE_URL=/api` for Production, Preview, and Development.
4. Deploy. `frontend/vercel.json` supplies the SPA fallback, API rewrite, and
   browser security headers.

The checked-in rewrite targets the Blueprint service name
`speakeasy-asd-api.onrender.com`. If Render assigns a different hostname, update
both `frontend/vercel.json` and the Android release `backendUrl`, then redeploy.
A `404` from the documented Vercel hostname means that the Vercel project has
not been imported or assigned that domain yet.

## Android release

```powershell
cd SpeakEasyAndroid
.\gradlew.bat testDebugUnitTest assembleRelease
```

Release builds reject non-HTTPS backend URLs. Use
`-PbackendUrl=https://speakeasy-asd-api.onrender.com/` when testing a different
Render service. Sign the resulting release APK/AAB in the distribution system;
signing keys are intentionally not stored in this repository.

## Smoke test

```powershell
./scripts/smoke-test.ps1 -WebUrl https://speakeasy-asd.vercel.app -ApiUrl https://speakeasy-asd-api.onrender.com
```

## Tamil learning and caregiver reports

The Tamil catalog, lessons, five games, progress, dashboard insights, report preview, and PDF generation run through the same API and MongoDB database. The catalog currently contains 265 entries: 12 vowels, 18 consonants, one aytham, 216 consonant-vowel combinations, 10 words, and eight sentences. Game answers are graded on the server with idempotent request IDs. Lesson and game histories are stored separately and combined in the learning summary. A missing Tamil word/sentence transcript produces an **unscored** practice attempt, never a positive pronunciation score.

For a local Windows run, start MongoDB first, run `./scripts/setup-local.ps1` once, then run `./scripts/start-local.ps1` from the repository root. Open `http://127.0.0.1:5173` and check `http://127.0.0.1:8000/health/ready`. The launcher uses the local MongoDB address unless `MONGODB_URL` is explicitly set. The existing `.env` may reference Atlas; a remote database must be reachable before the API is ready.

The doctor report screen is available to a signed-in caregiver under Reports. Preview and PDF download work without a messaging provider. To enable daily delivery, set one provider and save an intended doctor recipient, IANA timezone, and explicit caregiver consent in the report screen:

| Channel | Server configuration | Additional setup |
| --- | --- | --- |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM` | Use a secure SMTP account permitted to send child information to the nominated doctor. |
| WhatsApp | `WHATSAPP_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE` | Register a WhatsApp Business sender and obtain approval for a document-header template with the configured name/language. |

The API checks enabled consent and provider configuration before sending. A background task evaluates configured children hourly and creates at most one report claim per child, recipient, channel, and local day; failed or uncertain provider attempts require review before a manual retry. An `accepted` delivery state means the provider accepted the request, not that the doctor opened or received it. The delivery history and report PDF can be reviewed in the app. Daily reports contain practice and game counts, supported measured scores, review suggestions, and an educational-use disclaimer. The PDF is embedded with a Tamil-capable font. External calendar synchronization is not configured; the application calendar remains local.

Teacher audio in lessons and Listen & Choose uses available human recordings. The bundled human clips cover vowels; consonants, words, and sentences need recordings from a Tamil-speaking teacher before audio-led practice can be offered for those items. Do not substitute synthetic voice and label it as a human teacher. Pronunciation scoring for words and sentences also requires a validated Tamil transcription service; until available, the app offers recognition and writing practice and records speech attempts as unscored. Test the short/long vowel timing rule with representative child speech on the target microphone before clinical use.

## Edge release checklist

1. Set `APP_ENV=production`, a unique `JWT_SECRET_KEY`, secure cookies, exact CORS origins, and explicit trusted hosts.
2. Mount the model checkpoint read-only and confirm `/health/ready` only reports ready after MongoDB is reachable; expose model warm-up separately in operations telemetry.
3. Measure 1–3 second Tamil utterances on the actual clinic hardware. Release target: warm p95 scoring below 1.5 seconds locally and below 3 seconds through the configured server fallback.
4. Verify silence, clipped speech, recognizer unavailable, offline queue, retry, and explicit-exit behavior. None may create a positive score or persist a partial attempt.
5. Confirm recording retention, clinician sharing, and de-identified research all default off for a new caregiver and remain independently changeable.
6. Inspect application, proxy, model, and database logs for child names, transcripts, audio paths, tokens, or request bodies; none should be present.
7. Exercise caregiver export/deletion across users, evaluations, progress, consent records, clinical notes, sessions, and any consented media object.
8. Complete keyboard, screen-reader, 200% zoom, 320 CSS-pixel reflow, reduced-motion, sound-off, and Tamil-font checks on the caregiver, child-practice, and therapist paths.
9. Run `python -m pytest`, `npm test`, `npm run build`, and the Android build before promotion. The deterministic demo seed is development-only and must never run against production.
