# Submission Readiness Checklist

Last checked from the repository workspace on 2026-09-19.

## Current Verdict

The core product is technically strong, but the public submission is not fully ready until the production backend is verified end-to-end.

| Area | Current status | Evidence / next action |
|---|---|---|
| Public Vercel frontend | Verified working | `https://speakeasy-asd.vercel.app/` returned HTTP 200 on 2026-09-19. |
| Public Render API | Not verified working | The documented Render hostname still returns HTTP 404 for `/`, `/health/live`, and `/health/ready`. |
| Production E2E | Not proven | Blocked until the public backend health route responds. Run the speech-analysis workflow after Render is fixed. |
| License | Repo-side notice added | Root `LICENSE` is present as all-rights-reserved. Replace it only if the team chooses an open-source license. |
| Imported/reference projects | Present and documented | They are excluded from the final runtime scope in `REFERENCE_PROJECTS.md`; removal should be a dedicated cleanup decision. |
| Submission readiness | Not 100% yet | Main blocker is the unreachable public backend, followed by production E2E evidence. |

## P0 Blocker

### Public Backend Health

The configured Render hostname currently returns 404:

```text
https://speakeasy-asd-api.onrender.com/
https://speakeasy-asd-api.onrender.com/health/live
https://speakeasy-asd-api.onrender.com/health/ready
```

Expected:

```json
{"status":"ok","service":"speakeasy-api"}
```

or, for readiness:

```json
{"status":"ready","database":"ok"}
```

This likely requires Render dashboard access. Confirm that:

- The Render service exists and is named/hosted at `speakeasy-asd-api.onrender.com`.
- The service is linked to this repository and branch.
- The service uses `render.yaml` or the equivalent Docker settings.
- Required environment variables are set: `MONGODB_URL`, `CORS_ORIGINS`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and generated/secure `JWT_SECRET_KEY`.
- `TRUSTED_HOSTS` includes the actual Render hostname.
- MongoDB Atlas allows the Render service to connect.

## Production End-To-End Test

After the backend health route works, verify:

```text
Open live frontend
Login or demo-login
Open Tamil lesson
Record microphone attempt
Upload audio to production API
Receive speech-analysis score
Persist attempt
View progress/dashboard update
```

Record the result in the README only after it is actually verified.

## Repository Hygiene

- Reference/imported folders are documented in [REFERENCE_PROJECTS.md](REFERENCE_PROJECTS.md).
- `.gitmodules` is documented and optional for the browser/API runtime.
- Root `LICENSE` exists as all-rights-reserved so the repository has an explicit default ownership notice.
- If public reuse is intended, the project owners still need to choose and commit a standard open-source license.
- Root `SECURITY.md` documents private vulnerability reporting and secret-handling expectations.

## Final Submission Tasks

- [ ] Fix public backend health on Render.
- [ ] Run a production end-to-end speech-analysis workflow.
- [ ] Re-check demo video against the deployed version.
- [ ] Review open GitHub issues and close/label anything stale.
- [ ] Confirm repository name/description/topics match final branding.
- [ ] Decide whether to keep, move, or remove imported reference projects.
- [x] Add a root license/ownership notice.
- [ ] Replace the all-rights-reserved notice with an open-source license if public reuse is intended.
- [ ] Update README deployment/testing status with fresh verified dates.
