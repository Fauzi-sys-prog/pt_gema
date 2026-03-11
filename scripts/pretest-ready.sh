#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[pretest] 1/5 Restart backend service"
docker compose restart backend >/dev/null

echo "[pretest] 2/5 Wait backend health"
for i in $(seq 1 30); do
  if curl -fsS "http://localhost:3000/health" >/dev/null 2>&1; then
    echo "[pretest] backend health OK"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "[ERR] backend health failed after retries" >&2
    exit 1
  fi
  sleep 1
done

echo "[pretest] 3/5 Regenerate smoke tokens safely"
SMOKE_TOKEN_MAX_RETRIES="${SMOKE_TOKEN_MAX_RETRIES:-6}" \
SMOKE_TOKEN_DELAY_SECONDS="${SMOKE_TOKEN_DELAY_SECONDS:-2}" \
SMOKE_TOKEN_RETRY_BASE_DELAY_SECONDS="${SMOKE_TOKEN_RETRY_BASE_DELAY_SECONDS:-2}" \
./scripts/regen-smoke-tokens.sh

echo "[pretest] 4/5 Run backend smoke suite with safe cooldown"
SMOKE_COOLDOWN_SECONDS="${SMOKE_COOLDOWN_SECONDS:-10}" ./scripts/run-smoke-all.sh

echo "[pretest] 5/5 Done"
echo "[pretest] System is ready for manual UI testing."
