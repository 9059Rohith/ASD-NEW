# Repository Scope

The application retains:

- `frontend/`: React/Vite browser application and tests.
- `backend/`: FastAPI API, MongoDB persistence, speech models and tests.
- `SpeakEasyAndroid/`: Kotlin Android client.
- `docs/`: architecture, model provenance, operating instructions and QA evidence.
- `scripts/`: setup, smoke checks and maintenance tools.
- `images_final_ui_demo/`: screenshots linked from the README.

The browser avatar coach uses the existing frontend renderer and image asset. No Unity package or submodule initialization is required.

Unused imported projects (`Talky-full-app-main`, `TalkingPet`, `aacesstalk-monorepo-main`, `cboard-master`) and optional reference submodules (`LiveTalk-Unity`, `gandeeva`) were removed in the repository cleanup. Background design scratch folders, development plans, and generated `frontend/dist` output were removed as well. Production assets under `frontend/public`, speech-model files, tests and attribution notices remain tracked.

Upstream references remain available separately:

- [LiveTalk Unity](https://github.com/arghyasur1991/LiveTalk-Unity)
- [Gandeeva Voice](https://github.com/9059Rohith/Gandeeva-voice)

A normal clone is sufficient. Install dependencies and build from source using the README instructions.
