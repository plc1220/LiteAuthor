import os

LLM_PROVIDER = os.environ.get("LITEAUTHOR_LLM_PROVIDER", "mlx").strip().lower()

OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "http://127.0.0.1:8080/v1")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "not-needed")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "default")
OPENAI_AUTOCOMPLETE_MODEL = os.environ.get("OPENAI_AUTOCOMPLETE_MODEL", OPENAI_MODEL)

MLX_MODEL = os.environ.get("MLX_MODEL", "Jackrong/MLX-Qwopus3.5-9B-v3-4bit")
MLX_AUTOCOMPLETE_MODEL = os.environ.get("MLX_AUTOCOMPLETE_MODEL", "prism-ml/Ternary-Bonsai-8B-mlx-2bit")
MLX_AUTOCOMPLETE_BACKEND = os.environ.get("MLX_AUTOCOMPLETE_BACKEND", "lm").strip().lower()
