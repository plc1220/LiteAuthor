# LiteAuthor

Monorepo layout:

| Folder | Role |
|--------|------|
| [`frontend/`](frontend/) | Vite + React UI |
| [`backend/`](backend/) | FastAPI document/wiki/timeline API and HTTP surface for the app |
| [`agent/`](agent/) | Installable Python package **`liteauthor_agent`**: context engine, LLM gateway, prompt templates, role `agents/`, and `orchestrator/` (used by backend for Zen + Agent jobs) |

## Prerequisites

- Node.js 20+
- Python 3.11+

## Python setup (venv first)

Always use a **virtual environment** so dependencies stay off your system Python.

### 1. Create and activate a venv

From the **repository root** (recommended location: `.venv` next to `frontend/` and `backend/`):

**venv + pip**

```bash
python3 -m venv .venv
source .venv/bin/activate          # Linux / macOS
# .venv\Scripts\activate            # Windows (cmd)
```

**uv** (if you use [uv](https://docs.astral.sh/uv/)):

```bash
uv venv .venv
source .venv/bin/activate          # Linux / macOS
```

Your shell prompt should show the venv name; every `pip` / `uv pip` / `python` below should run **only after** activation (unless you call the interpreter by path, e.g. `.venv/bin/python`).

### 2. Install packages (still with the venv active)

**pip**

```bash
pip install -U pip
pip install -e ./agent
pip install -r backend/requirements.txt
```

**uv pip** (same installs, faster resolver)

```bash
uv pip install -e ./agent
uv pip install -r backend/requirements.txt
```

This installs the **`liteauthor_agent`** package in editable mode plus FastAPI and the rest of the API stack. The backend requirements install the agent with MLX extras so the default model path runs in-process.

## Run (development)

**Terminal 1 — API**

```bash
bash backend/start.sh
```

The startup script uses `backend/.venv`, installs missing dependencies, and ensures the in-process MLX packages are present.

If you prefer to run the server directly after `backend/.venv` exists:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8787
```

From the repo root (same idea: only works if that interpreter exists):

```bash
npm run api
```

`npm run api` runs the same backend startup script.

**Terminal 2 — UI**

```bash
cd frontend
npm install
npm run dev
```

Or:

```bash
npm install --prefix frontend
npm run dev --prefix frontend
```

The UI proxies `/api` to `http://127.0.0.1:8787` (see [`frontend/vite.config.ts`](frontend/vite.config.ts)).

## Knowledge graph for LLM/codebase context

This repo is set up with [Graphify](https://graphify.net/) so coding assistants can start from a project-level knowledge graph before searching individual files.

Install the official CLI once:

```bash
uv tool install graphifyy
# or: pipx install graphifyy
```

Install the Graphify skill/slash command for Codex-compatible assistants:

```bash
graphify install --platform codex
```

`graphify install --platform codex` installs the `/graphify` skill command.

The current graph lives in [`graphify-out/`](graphify-out/):

| File | Purpose |
|------|---------|
| [`graphify-out/GRAPH_REPORT.md`](graphify-out/GRAPH_REPORT.md) | Human-readable architecture summary, god nodes, communities, and gaps |
| [`graphify-out/graph.json`](graphify-out/graph.json) | Queryable graph data for LLM workflows |
| [`graphify-out/graph.html`](graphify-out/graph.html) | Interactive browser visualization |

Codex guidance is in [`AGENTS.md`](AGENTS.md). Graphify is opt-in for this repo: use the `/graphify` command or explicitly ask for Graphify before reading graph outputs. To refresh the code graph after edits:

```bash
graphify update .
```

The repository ignores `graphify-out/cache/`, but the report, JSON, and HTML outputs are intended to be committed so every teammate and assistant gets the same map.

## Local model

By default, the **agent** stack (read by `liteauthor_agent.llm_gateway`) runs direct in-process MLX from the Python backend:

```bash
export LITEAUTHOR_LLM_PROVIDER=mlx
export MLX_MODEL=Jackrong/MLX-Qwopus3.5-9B-v3-4bit
export MLX_AUTOCOMPLETE_MODEL=prism-ml/Ternary-Bonsai-8B-mlx-2bit
export MLX_AUTOCOMPLETE_BACKEND=lm
```

If you install the agent package by hand, include the MLX extra:

```bash
pip install -e './agent[mlx]'
```

To use an OpenAI-compatible HTTP server instead:

```bash
export LITEAUTHOR_LLM_PROVIDER=openai
export OPENAI_BASE_URL=http://127.0.0.1:8080/v1
export OPENAI_MODEL=default
```

Optional: `LITEAUTHOR_MAX_CONTEXT_CHARS` (default `12000`) for scene packet size. See [`.env.example`](.env.example).

## Optional desktop shell (Tauri)

Not bundled in-repo. A future Tauri shell can wrap `frontend/dist` and ship alongside the same FastAPI + agent stack.

## Agent package layout

```
agent/liteauthor_agent/
  agents/              # Role-specific prompt fragments
  context_engine/      # Scene packet / retrieval assembly
  llm_gateway/         # In-process MLX and optional OpenAI-compatible HTTP client
  orchestrator/        # Multi-step jobs (e.g. sample continuity pipeline)
  prompt_templates/    # System / instruction strings
  routers/             # Reserved for a standalone agent ASGI service
  schemas/             # Shared dataclasses (e.g. SceneExcerpt)
  services/            # Small agent helpers
  storage/             # Reserved for future indexes / adapters
  utils/               # Paths, token heuristics
```
