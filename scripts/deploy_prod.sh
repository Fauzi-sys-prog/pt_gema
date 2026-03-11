#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/deploy_prod.sh
# Optional env:
#   COMPOSE_FILE=docker-compose.prod.yml
#   RUN_SMOKE=1

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
RUN_SMOKE="${RUN_SMOKE:-1}"

echo "[deploy] 1/6 Backup database before deploy"
./scripts/backup_postgres.sh

echo "[deploy] 2/6 Build images and start database"
docker compose -f "$COMPOSE_FILE" up -d --build postgres

echo "[deploy] 3/6 Run database schema sync (force each deploy)"
docker compose -f "$COMPOSE_FILE" run --rm migrate

echo "[deploy] 4/6 Start application services"
docker compose -f "$COMPOSE_FILE" up -d --build backend frontend

echo "[deploy] 5/6 Wait for services"
docker compose -f "$COMPOSE_FILE" ps

echo "[deploy] 6/6 Check backend health"
curl -sS -f http://localhost:3000/health >/dev/null
echo "[deploy] backend health OK"

if [[ "$RUN_SMOKE" == "1" ]]; then
  echo "[deploy] post-check Run smoke checks"
  ./scripts/smoke_prod.sh
fi

echo "[deploy] done"
