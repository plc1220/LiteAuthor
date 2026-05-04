#!/usr/bin/env bash
set -euo pipefail

# LiteAuthor full-app launcher.
# Usage:
#   ./start.sh mlx
#   ./start.sh gemini
#   ./start-mlx.sh
#   ./start-gemini.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

MODE="${1:-}"
if [ -z "${MODE}" ]; then
  case "$(basename "$0")" in
    start-mlx.sh) MODE="mlx" ;;
    start-gemini.sh) MODE="gemini" ;;
    *) MODE="mlx" ;;
  esac
fi

case "${MODE}" in
  mlx)
    PROVIDER="mlx"
    AGENT_EXTRA="mlx"
    ;;
  gemini|google_genai|google-genai)
    PROVIDER="google_genai"
    AGENT_EXTRA="gemini"
    ;;
  *)
    echo "Usage: $0 [mlx|gemini]" >&2
    exit 2
    ;;
esac

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

load_env_file() {
  local env_file="$1"
  if [ -f "${env_file}" ]; then
    set -a
    # shellcheck disable=SC1090
    source "${env_file}"
    set +a
  fi
}

PYTHON_BIN="$(find_python || true)"
if [ -z "${PYTHON_BIN}" ]; then
  echo "Error: Python 3.11+ is required, but no compatible python executable was found." >&2
  exit 1
fi

load_env_file "${ROOT_DIR}/.env"
load_env_file "${ROOT_DIR}/backend/.env"

export LITEAUTHOR_LLM_PROVIDER="${PROVIDER}"

if [ "${PROVIDER}" = "mlx" ]; then
  export MLX_MODEL="${MLX_MODEL:-Jackrong/MLX-Qwopus3.5-9B-v3-4bit}"
  export MLX_AUTOCOMPLETE_MODEL="${MLX_AUTOCOMPLETE_MODEL:-prism-ml/Ternary-Bonsai-8B-mlx-2bit}"
  export MLX_AUTOCOMPLETE_BACKEND="${MLX_AUTOCOMPLETE_BACKEND:-lm}"
else
  export GEMINI_AUTOCOMPLETE_MODEL="${GEMINI_AUTOCOMPLETE_MODEL:-gemini-3.1-flash-lite-preview}"
  export GEMINI_CHAT_MODEL="${GEMINI_CHAT_MODEL:-gemma-4-26b-a4b-it}"
  if [ -z "${GEMINI_API_KEY:-}" ]; then
    echo "Warning: GEMINI_API_KEY is not set. Add it to .env, backend/.env, or your shell before using Gemini calls." >&2
  fi
fi

if [ ! -d "${ROOT_DIR}/backend/.venv" ]; then
  echo "Creating backend/.venv with $("${PYTHON_BIN}" --version) ..."
  "${PYTHON_BIN}" -m venv "${ROOT_DIR}/backend/.venv"
fi

BACKEND_PY="${ROOT_DIR}/backend/.venv/bin/python"
echo "Installing/checking backend dependencies for ${PROVIDER} ..."
"${BACKEND_PY}" -m pip install --upgrade pip
"${BACKEND_PY}" -m pip install -r "${ROOT_DIR}/backend/requirements.txt"
"${BACKEND_PY}" -m pip install -e "${ROOT_DIR}/agent[${AGENT_EXTRA}]"

if [ ! -d "${ROOT_DIR}/frontend/node_modules" ]; then
  echo "Installing frontend dependencies ..."
  if [ -f "${ROOT_DIR}/frontend/package-lock.json" ]; then
    npm ci --prefix "${ROOT_DIR}/frontend"
  else
    npm install --prefix "${ROOT_DIR}/frontend"
  fi
fi

LOG_FILE="${LITEAUTHOR_BACKEND_LOG_FILE:-${ROOT_DIR}/backend-dev.log}"
mkdir -p "$(dirname "${LOG_FILE}")"

cleanup() {
  local code=$?
  trap - EXIT INT TERM
  if [ -n "${BACKEND_PID:-}" ] && kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
  if [ -n "${FRONTEND_PID:-}" ] && kill -0 "${FRONTEND_PID}" >/dev/null 2>&1; then
    kill "${FRONTEND_PID}" >/dev/null 2>&1 || true
  fi
  wait >/dev/null 2>&1 || true
  exit "${code}"
}
trap cleanup EXIT INT TERM

echo "Starting LiteAuthor with provider: ${PROVIDER}"
echo "API: http://127.0.0.1:8787"
echo "UI:  http://127.0.0.1:3000"
echo "Backend log: ${LOG_FILE}"

(
  cd "${ROOT_DIR}/backend"
  exec "${BACKEND_PY}" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8787
) 2>&1 | tee -a "${LOG_FILE}" &
BACKEND_PID=$!

(
  cd "${ROOT_DIR}/frontend"
  exec npm run dev -- --host=0.0.0.0
) &
FRONTEND_PID=$!

while kill -0 "${BACKEND_PID}" >/dev/null 2>&1 && kill -0 "${FRONTEND_PID}" >/dev/null 2>&1; do
  sleep 1
done

if ! kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
  wait "${BACKEND_PID}"
else
  wait "${FRONTEND_PID}"
fi
