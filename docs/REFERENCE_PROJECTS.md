# Reference And Imported Project Scope

The final SpeakEasy ASD product is centered on:

- `frontend/` - React/Vite browser application
- `backend/` - FastAPI API, MongoDB persistence, and speech-analysis services
- `SpeakEasyAndroid/` - Kotlin Android client
- `docs/` - architecture, model reports, audits, and QA evidence
- `scripts/` - local setup, smoke, and capture helpers

Several other folders are present for historical reference, comparison, imported experiments, or submodule context. They are not required to run the primary browser application unless a maintainer explicitly says otherwise.

| Path | Current role | Runtime dependency for final web app? | Notes |
|---|---|---:|---|
| `Talky-full-app-main/` | Reference speech-practice implementation | No | Useful for historical feature comparison only. |
| `TalkingPet/` | Reference pet/companion prototype | No | Not part of current React/FastAPI runtime. |
| `aacesstalk-monorepo-main/` | Reference AAC/assistive-tech monorepo | No | Not required by current startup commands. |
| `cboard-master/` | Reference AAC board project | No | Large imported reference tree; check upstream license before reuse. |
| `LiveTalk-Unity/` | Git submodule reference for Unity talking-head work | No | Optional submodule; not required for browser or API startup. |
| `gandeeva/` | Git submodule/reference voice project | No | Optional submodule; not required for browser or API startup. |

## Submodules

The repository contains `.gitmodules` entries for `LiveTalk-Unity/` and `gandeeva/`. For the final browser product, a normal clone is sufficient:

```bash
git clone https://github.com/9059Rohith/ASD-NEW.git
```

Only initialize submodules if you specifically need to inspect those references:

```bash
git submodule update --init --recursive
```

## Submission Guidance

Before a final hackathon or portfolio submission, either:

1. Keep these folders and link this document from the README so reviewers understand scope, or
2. Move/remove unused references in a dedicated cleanup branch after confirming licensing and provenance.

Do not present reference/imported projects as original runtime code for SpeakEasy ASD.
