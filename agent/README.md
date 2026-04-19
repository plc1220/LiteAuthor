# LiteAuthor agent (Python library)

Context assembly, prompt templates, LLM gateway, role helpers, and orchestration used by the FastAPI backend.

Install **inside an activated virtual environment** (see the repo root `README.md` — create `.venv` first, then):

```bash
pip install -e ./agent
```

Or with **uv**:

```bash
uv pip install -e ./agent
```

Environment variables are documented in the repo root [`.env.example`](../.env.example) (OpenAI-compatible server and optional `LITEAUTHOR_MAX_CONTEXT_CHARS`).
