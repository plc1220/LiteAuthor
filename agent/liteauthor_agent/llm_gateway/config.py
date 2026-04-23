import os

OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "http://127.0.0.1:8080/v1")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "not-needed")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "default")
OPENAI_AUTOCOMPLETE_MODEL = os.environ.get("OPENAI_AUTOCOMPLETE_MODEL", OPENAI_MODEL)
