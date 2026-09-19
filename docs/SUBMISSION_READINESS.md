# Submission Readiness Checklist

Last checked from the repository workspace on 2026-09-19.

## Current Verdict

The core product is technically strong, but the public submission is not fully ready until the production backend is verified end-to-end.

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
- No root `LICENSE` file exists yet; add one only after the owners choose a license.
- Root `SECURITY.md` documents private vulnerability reporting and secret-handling expectations.

## Final Submission Tasks

- [ ] Fix public backend health on Render.
- [ ] Run a production end-to-end speech-analysis workflow.
- [ ] Re-check demo video against the deployed version.
- [ ] Review open GitHub issues and close/label anything stale.
- [ ] Confirm repository name/description/topics match final branding.
- [ ] Decide whether to keep, move, or remove imported reference projects.
- [ ] Add a license if public reuse is intended.
- [ ] Update README deployment/testing status with fresh verified dates.
