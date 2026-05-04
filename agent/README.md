# LiteAuthor agent (Python library)

Context assembly, prompt templates, LLM gateway, role helpers, and orchestration used by the FastAPI backend.

Install **inside an activated virtual environment** (see the repo root `README.md`). Include the MLX extra for the default in-process backend model path:

```bash
pip install -e './agent[mlx]'
```

Or with **uv**:

```bash
uv pip install -e './agent[mlx]'
```

For **Gemini + Gemma** (Google AI API key, split autocomplete vs chat models), install `pip install -e './agent[gemini]'` and set `LITEAUTHOR_LLM_PROVIDER=google_genai` (see root [`.env.example`](../.env.example)).

Environment variables are documented in the repo root [`.env.example`](../.env.example) (direct MLX by default, optional OpenAI-compatible server, Google GenAI, and `LITEAUTHOR_MAX_CONTEXT_CHARS`).
