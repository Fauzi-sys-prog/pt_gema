#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/check_prod.sh
# Optional env:
#   COMPOSE_FILE=docker-compose.prod.yml
#   DOMAIN=gemateknik.online
#   WWW_DOMAIN=www.gemateknik.online
#   API_DOMAIN=api.gemateknik.online
#   RUN_SMOKE=true

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DOMAIN="${DOMAIN:-gemateknik.online}"
WWW_DOMAIN="${WWW_DOMAIN:-www.gemateknik.online}"
API_DOMAIN="${API_DOMAIN:-api.gemateknik.online}"
RUN_SMOKE="${RUN_SMOKE:-true}"

check_https() {
  local url="$1"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" "$url")"
  if [[ "$code" != "200" ]]; then
    echo "[check] FAIL $url expected=200 got=$code"
    return 1
  fi
  echo "[check] OK   $url ($code)"
}

echo "[check] verifying docker services..."
docker compose -f "$COMPOSE_FILE" ps

echo "[check] verifying public endpoints..."
check_https "https://${DOMAIN}"
check_https "https://${WWW_DOMAIN}"
check_https "https://${API_DOMAIN}/health"

echo "[check] checking certbot timer (if available)..."
if command -v systemctl >/dev/null 2>&1; then
  systemctl list-timers | grep -i certbot || echo "[check] WARN certbot timer not found"
else
  echo "[check] WARN systemctl not available in this environment"
fi

if [[ "$RUN_SMOKE" == "true" ]]; then
  echo "[check] running smoke suite..."
  ./scripts/smoke_prod.sh
fi

echo "[check] production checks passed"
