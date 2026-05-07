#!/usr/bin/env bash
set -euo pipefail

# ── LiteAuthor Backend Startup Script ──────────────────────────────
# Usage:  ./start.sh
#
# Creates a .venv in backend/.venv, installs dependencies,
# and starts the FastAPI dev server.
#
# Requires: Python 3.11+

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${SCRIPT_DIR}"

agent_extra_for_provider() {
  case "${LITEAUTHOR_LLM_PROVIDER:-google_genai}" in
    mlx|MLX) echo mlx ;;
    *) echo gemini ;;
  esac
}

install_local_agent() {
  local extra
  extra="$(agent_extra_for_provider)"
  .venv/bin/python -m pip install -e "${ROOT_DIR}/agent[${extra}]"
}

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

find_python() {
  local candidate
  for candidate in python3.13 python3.12 python3.11 python3; do
    if command -v "${candidate}" >/dev/null 2>&1; then
      if "${candidate}" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)' >/dev/null 2>&1; then
        command -v "${candidate}"
        return 0
      fi
    fi
  done

  return 1
}

PYTHON_BIN="$(find_python || true)"
if [ -z "${PYTHON_BIN}" ]; then
  echo "Error: Python 3.11+ is required, but no compatible python executable was found." >&2
  echo "Install Python 3.11 or newer, then re-run ./start.sh." >&2
  exit 1
fi

# ── 1. Create .venv with Python 3.11+ ─────────────────────────────
if [ ! -d ".venv" ]; then
  echo "Creating .venv with $("${PYTHON_BIN}" --version) ..."
  "${PYTHON_BIN}" -m venv .venv
  .venv/bin/python -m pip install --upgrade pip
  .venv/bin/python -m pip install -r requirements.txt
  install_local_agent
fi

if ! .venv/bin/python - <<'PY' >/dev/null 2>&1
import os

import liteauthor_agent

provider = os.environ.get("LITEAUTHOR_LLM_PROVIDER", "google_genai").strip().lower()
if provider == "google_genai":
    import google.genai
elif provider == "mlx":
    import mlx_lm
    import mlx_vlm
PY
then
  echo "Installing backend dependencies for ${LITEAUTHOR_LLM_PROVIDER:-google_genai} ..."
  .venv/bin/python -m pip install --upgrade pip
  .venv/bin/python -m pip install -r requirements.txt
  install_local_agent
fi

# Activate the venv
source .venv/bin/activate

# Run the backend server and keep a local dev log for debugging.
LOG_FILE="${LITEAUTHOR_BACKEND_LOG_FILE:-../backend-dev.log}"
mkdir -p "$(dirname "${LOG_FILE}")"
echo "Writing backend log to ${LOG_FILE}"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8787 2>&1 | tee -a "${LOG_FILE}"
