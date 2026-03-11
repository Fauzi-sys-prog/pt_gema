#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_FILE="${SMOKE_TOKEN_ENV_FILE:-$ROOT_DIR/.smoke.tokens.env}"
BASE_URL="${SMOKE_BASE_URL:-http://localhost:3000}"
MAX_RETRIES="${SMOKE_TOKEN_MAX_RETRIES:-5}"
LOGIN_DELAY_SECONDS="${SMOKE_TOKEN_DELAY_SECONDS:-1}"
RETRY_BASE_DELAY_SECONDS="${SMOKE_TOKEN_RETRY_BASE_DELAY_SECONDS:-2}"

cd "$ROOT_DIR"

get_token() {
  local username="$1"
  local password="$2"
  local attempt=1
  local resp=""
  local body=""
  local code=""

  while [ "$attempt" -le "$MAX_RETRIES" ]; do
    resp="$(curl -sS -X POST "$BASE_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"username\":\"$username\",\"password\":\"$password\"}" \
      -w $'\n%{http_code}')"
    body="$(echo "$resp" | sed '$d')"
    code="$(echo "$resp" | tail -n1)"

    if [ "$code" = "200" ]; then
      echo "$body" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'
      return 0
    fi

    if [ "$code" = "429" ] || [ "$code" = "000" ]; then
      local delay=$((RETRY_BASE_DELAY_SECONDS * attempt))
      echo "[WARN] login $username hit HTTP $code (attempt $attempt/$MAX_RETRIES), retry in ${delay}s..." >&2
      sleep "$delay"
      attempt=$((attempt + 1))
      continue
    fi

    echo "[ERR] login $username failed with HTTP $code" >&2
    return 1
  done

  echo "[ERR] login $username exhausted retries ($MAX_RETRIES)" >&2
  return 1
}

OWNER_USERNAME="${SMOKE_OWNER_USERNAME:-owner}"
OWNER_PASSWORD="${SMOKE_OWNER_PASSWORD:-owner}"
ADMIN_USERNAME="${SMOKE_ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${SMOKE_ADMIN_PASSWORD:-changeMeAdmin123}"
FINANCE_USERNAME="${SMOKE_FINANCE_USERNAME:-ening}"
FINANCE_PASSWORD="${SMOKE_FINANCE_PASSWORD:-changeMeEning123}"
SALES_USERNAME="${SMOKE_SALES_USERNAME:-angesti}"
SALES_PASSWORD="${SMOKE_SALES_PASSWORD:-changeMeAngesti123}"
SUPPLY_USERNAME="${SMOKE_SUPPLY_USERNAME:-dewi}"
SUPPLY_PASSWORD="${SMOKE_SUPPLY_PASSWORD:-changeMeDewi123}"
PRODUKSI_USERNAME="${SMOKE_PRODUKSI_USERNAME:-produksi}"
PRODUKSI_PASSWORD="${SMOKE_PRODUKSI_PASSWORD:-changeMeProduksi123}"

OWNER_TOKEN="$(get_token "$OWNER_USERNAME" "$OWNER_PASSWORD" || true)"
sleep "$LOGIN_DELAY_SECONDS"
ADMIN_TOKEN="$(get_token "$ADMIN_USERNAME" "$ADMIN_PASSWORD" || true)"
sleep "$LOGIN_DELAY_SECONDS"
FINANCE_TOKEN="$(get_token "$FINANCE_USERNAME" "$FINANCE_PASSWORD" || true)"
sleep "$LOGIN_DELAY_SECONDS"
SALES_TOKEN="$(get_token "$SALES_USERNAME" "$SALES_PASSWORD" || true)"
sleep "$LOGIN_DELAY_SECONDS"
SUPPLY_TOKEN="$(get_token "$SUPPLY_USERNAME" "$SUPPLY_PASSWORD" || true)"
sleep "$LOGIN_DELAY_SECONDS"
PRODUKSI_TOKEN="$(get_token "$PRODUKSI_USERNAME" "$PRODUKSI_PASSWORD" || true)"

if [ -z "$OWNER_TOKEN" ] || [ -z "$ADMIN_TOKEN" ] || [ -z "$FINANCE_TOKEN" ] || [ -z "$SALES_TOKEN" ] || [ -z "$SUPPLY_TOKEN" ] || [ -z "$PRODUKSI_TOKEN" ]; then
  rm -f "$OUT_FILE"
  echo "[ERR] Failed to generate one or more smoke tokens from $BASE_URL/auth/login." >&2
  echo "[ERR] Removed stale token file: $OUT_FILE" >&2
  echo "[ERR] Check backend status, login rate-limit, and SMOKE_*_USERNAME/SMOKE_*_PASSWORD values." >&2
  exit 1
fi

cat > "$OUT_FILE" <<EOF
# Auto-generated token file for smoke tests (via live /auth/login)
export SMOKE_OWNER_TOKEN='${OWNER_TOKEN}'
export SMOKE_ADMIN_TOKEN='${ADMIN_TOKEN}'
export SMOKE_FINANCE_TOKEN='${FINANCE_TOKEN}'
export SMOKE_SALES_TOKEN='${SALES_TOKEN}'
export SMOKE_SUPPLY_TOKEN='${SUPPLY_TOKEN}'
export SMOKE_PRODUKSI_TOKEN='${PRODUKSI_TOKEN}'
EOF

echo "[OK] Token file updated: $OUT_FILE"
echo "[INFO] Token vars:"
if command -v rg >/dev/null 2>&1; then
  rg -n "SMOKE_.*TOKEN" "$OUT_FILE" || true
else
  grep -nE "SMOKE_.*TOKEN" "$OUT_FILE" || true
fi
