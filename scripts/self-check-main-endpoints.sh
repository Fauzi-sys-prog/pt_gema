#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
USERNAME="${SMOKE_OWNER_USERNAME:-owner}"
PASSWORD="${SMOKE_OWNER_PASSWORD:-owner}"

echo "Main Endpoint Self-Check"
echo "Base URL: $BASE_URL"

LOGIN_RESP="$(curl -sS -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")"

TOKEN="$(printf '%s' "$LOGIN_RESP" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"

if [[ -z "$TOKEN" ]]; then
  echo "[FAIL] Login failed. Response:"
  echo "$LOGIN_RESP"
  exit 1
fi

echo "[PASS] Login"

ENDPOINTS=(
  "/projects"
  "/quotations"
  "/data-collections"
  "/purchase-orders"
  "/receivings"
  "/work-orders"
  "/users"
  "/data/stock-items"
  "/data/stock-ins"
  "/data/stock-outs"
  "/data/stock-movements"
  "/data/stock-opnames"
  "/data/surat-jalan"
  "/data/material-requests"
  "/data/production-reports"
  "/data/production-trackers"
  "/data/qc-inspections"
  "/data/employees"
  "/data/attendances"
  "/data/payrolls"
  "/data/assets"
  "/data/maintenances"
  "/data/vendors"
  "/data/vendor-expenses"
  "/data/vendor-invoices"
  "/data/customers"
  "/data/customer-invoices"
  "/data/surat-masuk"
  "/data/surat-keluar"
  "/data/template-surat"
  "/data/berita-acara"
  "/data/archive-registry"
  "/data/audit-logs"
  "/data/kasbons"
  "/data/fleet-health"
  "/data/proof-of-delivery"
  "/data/spk-records"
  "/data/app-settings"
  "/dashboard/finance-general-ledger-summary"
)

PASS_COUNT=0
FAIL_COUNT=0

for PATHNAME in "${ENDPOINTS[@]}"; do
  CODE="$(curl -sS -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL$PATHNAME")"

  if [[ "$CODE" == "200" ]]; then
    echo "[PASS] GET $PATHNAME -> $CODE"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "[FAIL] GET $PATHNAME -> $CODE (expected 200)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

echo ""
echo "Summary: PASS=$PASS_COUNT FAIL=$FAIL_COUNT TOTAL=${#ENDPOINTS[@]}"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi

echo "[PASS] All main endpoints are healthy."
