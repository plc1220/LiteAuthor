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
cd "${SCRIPT_DIR}"

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
fi

if ! .venv/bin/python - <<'PY' >/dev/null 2>&1
import liteauthor_agent
import mlx_lm
import mlx_vlm
PY
then
  echo "Installing backend dependencies, including in-process MLX support ..."
  .venv/bin/python -m pip install --upgrade pip
  .venv/bin/python -m pip install -r requirements.txt
fi

# Activate the venv
source .venv/bin/activate

# Run the backend server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8787
