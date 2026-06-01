#!/usr/bin/env bash
# Start the EDQMS chatbot API and MkDocs dev server together.
# Usage: ANTHROPIC_API_KEY=sk-... bash start.sh
set -e
cd "$(dirname "$0")"

if [[ -z "$ANTHROPIC_API_KEY" ]]; then
  echo "Error: ANTHROPIC_API_KEY is not set." >&2
  exit 1
fi

cleanup() {
  [[ -n "$UVICORN_PID" ]] && kill "$UVICORN_PID" 2>/dev/null
}
trap cleanup EXIT

echo "Starting chat API on port 8001…"
uvicorn api.server:app --port 8001 &
UVICORN_PID=$!

echo "Starting MkDocs on port 8000…"
mkdocs serve
