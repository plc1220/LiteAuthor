#!/usr/bin/env bash
set -euo pipefail

# ── LiteAuthor Backend Startup Script ──────────────────────────────
# Usage:  ./start-backend.sh
#
# Creates a .venv in backend/.venv, installs dependencies,
# and starts the FastAPI dev server.
#
# Requires: Python 3.11+ (found at ~/.local/bin/python3.11)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"

# ── 1. Create .venv with Python 3.11 ──────────────────────────────
if [ ! -d ".venv" ]; then
  echo "Creating .venv with Python 3.11 ..."
  python3.11 -m venv .venv
  .venv/bin/python -m pip install --upgrade pip
  .venv/bin/python -m pip install -r requirements.txt
fi

# Activate the venv
source .venv/bin/activate

# Run the backend server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8787
