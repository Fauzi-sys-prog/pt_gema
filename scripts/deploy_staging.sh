#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.staging.yml}"
ENV_FILE="${ENV_FILE:-backend/.env.staging}"
PROJECT_NAME="${PROJECT_NAME:-ptgema_staging}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[staging] missing env file: $ENV_FILE"
  exit 1
fi

compose() {
  APP_ENV_FILE="$ENV_FILE" docker compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

echo "[staging] 1/5 Start database"
compose up -d --build postgres

echo "[staging] 2/5 Run migrations"
compose run --rm migrate

echo "[staging] 3/5 Start backend and frontend"
compose up -d --build backend frontend

echo "[staging] 4/5 Show service status"
compose ps

echo "[staging] 5/5 Verify health"
curl -sS -f http://127.0.0.1:3300/health >/dev/null
curl -sS -f http://127.0.0.1:4173 >/dev/null
echo "[staging] health OK"
