import os

LLM_PROVIDER = os.environ.get("LITEAUTHOR_LLM_PROVIDER", "mlx").strip().lower()

OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "http://127.0.0.1:8080/v1")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "not-needed")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "default")
OPENAI_AUTOCOMPLETE_MODEL = os.environ.get("OPENAI_AUTOCOMPLETE_MODEL", OPENAI_MODEL)

MLX_MODEL = os.environ.get("MLX_MODEL", "Jackrong/MLX-Qwopus3.5-9B-v3-4bit")
MLX_AUTOCOMPLETE_MODEL = os.environ.get("MLX_AUTOCOMPLETE_MODEL", "prism-ml/Ternary-Bonsai-8B-mlx-2bit")
MLX_AUTOCOMPLETE_BACKEND = os.environ.get("MLX_AUTOCOMPLETE_BACKEND", "lm").strip().lower()

# google_genai provider (Gemini API key + split models; install agent[gemini])
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_AUTOCOMPLETE_MODEL = os.environ.get("GEMINI_AUTOCOMPLETE_MODEL", "gemini-3.1-flash-lite-preview").strip()
GEMINI_CHAT_MODEL = os.environ.get("GEMINI_CHAT_MODEL", "gemma-4-26b-a4b-it").strip()
GEMINI_CHAT_THINKING_LEVEL = os.environ.get("GEMINI_CHAT_THINKING_LEVEL", "").strip().upper()
GEMINI_REQUEST_TIMEOUT_MS = int(os.environ.get("GEMINI_REQUEST_TIMEOUT_MS", "45000"))
GEMINI_CHAT_ENABLE_GOOGLE_SEARCH = os.environ.get("GEMINI_CHAT_ENABLE_GOOGLE_SEARCH", "").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)
