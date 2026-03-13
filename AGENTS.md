# AGENTS.md
# Guidance for agentic coding tools working in this repo.

## Scope and goals
- Primary app: FastAPI backend in `server.py` with a React + TypeScript + Vite frontend in `frontend/`.
- Media pipeline uses FFmpeg and local file storage under `games/`.
- Avoid committing secrets: `.env` stays local; use `.example.env` as reference.

## Repo layout (high level)
- `server.py`: FastAPI HTTP API + static file hosting for `frontend/dist/`.
- `app.py`: CLI entry for offline video processing tasks.
- `frontend/`: React + TypeScript UI, built with Vite.
- `games/`: runtime data directory (created at runtime).
- `resources/`: default assets (scoreboard, brand video, etc.).
- `fonts/`: font assets.

## Cursor / Copilot rules
- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` found.

## Build / lint / test commands
### Backend (Python)
- Run API server: `python server.py`
- CLI tooling (local processing): `python app.py <action> <game.yaml> <segment>`
- Dependencies (conda): `conda env create -f environment.yml && conda activate grainsoccer`
- Dependencies (venv): `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
- Linting: no Python linter configured.
- Tests: no Python test suite detected.
- Single test: not applicable (no test runner present).

### Frontend (React + TS)
- Install: `cd frontend && npm ci`
- Dev server: `cd frontend && npm run dev`
- Build: `cd frontend && npm run build`
- Preview build: `cd frontend && npm run preview`
- Lint: `cd frontend && npm run lint`
- Tests: no frontend test runner detected.
- Single test: not applicable (no test runner present).

### Docker
- Build: `docker compose build`
- Run: `docker compose up -d`

## Code style guidelines
### General
- Use UTF-8 for file IO when reading/writing text or YAML.
- Keep runtime data in `games/` and avoid hardcoding paths outside repo.
- Follow existing naming and structure; do not introduce new patterns without need.

### Python (backend)
- Imports are mostly grouped by standard library, third-party, then local modules.
- Environment loading is done early: `import dotenv; dotenv.load_dotenv()`.
- Use snake_case for functions/variables, PascalCase for classes, UPPER_SNAKE_CASE for constants.
- Type hints are used in some places (e.g., `list[str]`, `tuple[int, int]`).
- Prefer FastAPI idioms: `HTTPException` for API errors; `FileResponse`/`JSONResponse` for responses.
- Error handling often uses `try/except` with traceback logging and task status updates.
- Keep background task state in the global task objects and guard with `task_lock`.
- Use `os.path.join` and `os.path` helpers for filesystem paths.
- Keep IO and CPU-heavy work off the request thread when possible (see task pattern).

### Frontend (React + TypeScript)
- Indentation: 4 spaces; semicolons are used consistently.
- Use function components with hooks (`useState`, `useEffect`).
- Prefer `React.FC` for component typing in this codebase.
- Use `async/await` with `try/catch/finally` for API calls.
- Use centralized error formatting via `getErrorMessage` in `frontend/src/utils/index.ts`.
- Keep API calls inside `frontend/src/services/api.ts` and types in `frontend/src/types/index.ts`.
- Use CSS modules as plain `.css` files co-located with components.
- Routing uses React Router in `frontend/src/App.tsx`.
- API errors bubble through Axios interceptors; keep consistent behavior if extending.
- For strings and JSX attributes, follow existing single-quote style.

### Imports and module structure
- Import order (frontend): external libs, internal services/types/utils, local components, then CSS.
- Prefer named exports for components and API helpers; default export for `App`.
- Use `@/*` path alias if needed (configured in `frontend/tsconfig.json`).

### Types and data models
- Backend models are plain dicts or simple classes; avoid introducing heavy ORM patterns.
- Frontend uses explicit interfaces for API responses and view models.
- Keep API shape consistent with `server.py` endpoints and `frontend/src/types/index.ts`.

### Error handling and logging
- Backend: raise `HTTPException` with proper status codes and `detail` for API clients.
- Backend: print stack traces on failures during background tasks.
- Frontend: show user-facing errors with `Alert` component; do not swallow errors silently.
- Avoid logging sensitive data (API keys, file paths with secrets).

## Notes for agents
- Ensure `frontend/dist/` exists before expecting static UI from the backend.
- The `/api` route is served from FastAPI; the frontend proxies `/api` in dev.
- FFmpeg must be available on PATH for video operations.
- Do not commit `.env` or generated files under `games/`.
