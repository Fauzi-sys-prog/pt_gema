#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/smoke_prod.sh
# Optional env:
#   API_BASE_URL=http://localhost:3000
#   WEB_BASE_URL=http://localhost:5173
#   TIMEOUT_SECONDS=20

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
WEB_BASE_URL="${WEB_BASE_URL:-http://localhost:5173}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-20}"

check_url() {
  local url="$1"
  local expected="${2:-200}"
  local code
  code="$(curl -sS -m "$TIMEOUT_SECONDS" -o /dev/null -w "%{http_code}" "$url")"
  if [[ "$code" != "$expected" ]]; then
    echo "[smoke] FAIL $url expected=$expected got=$code"
    return 1
  fi
  echo "[smoke] OK   $url ($code)"
}

echo "[smoke] starting production smoke checks..."

check_url "${WEB_BASE_URL}/" "200"
check_url "${WEB_BASE_URL}/login" "200"
check_url "${API_BASE_URL}/health" "200"
check_url "${API_BASE_URL}/dashboard/summary" "401"
check_url "${API_BASE_URL}/projects" "401"
check_url "${API_BASE_URL}/quotations" "401"

echo "[smoke] all checks passed"
