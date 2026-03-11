#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
TOKEN_ENV_FILE_DEFAULT="$ROOT_DIR/.smoke.tokens.env"

if [[ ! -f "$BACKEND_DIR/package.json" ]]; then
  echo "[ERR] backend/package.json not found"
  exit 1
fi

if [[ -f "${SMOKE_TOKEN_ENV_FILE:-$TOKEN_ENV_FILE_DEFAULT}" ]]; then
  # shellcheck disable=SC1090
  source "${SMOKE_TOKEN_ENV_FILE:-$TOKEN_ENV_FILE_DEFAULT}"
  echo "[INFO] Loaded token env from ${SMOKE_TOKEN_ENV_FILE:-$TOKEN_ENV_FILE_DEFAULT}"
else
  echo "[INFO] Token env file not found. Running with login flow."
fi

export SMOKE_COOLDOWN_SECONDS="${SMOKE_COOLDOWN_SECONDS:-5}"
# Auto mint disabled by default because local env secret can differ from running backend container.
export SMOKE_MINT_TOKENS="${SMOKE_MINT_TOKENS:-false}"

cd "$BACKEND_DIR"
npm run smoke:security-all
