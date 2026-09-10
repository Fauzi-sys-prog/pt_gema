#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/rollback_prod.sh /path/to/backup.sql.gz
# Optional env:
#   COMPOSE_FILE=docker-compose.prod.yml

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/backup.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

echo "[rollback] 1/4 stop app services (keep postgres running)"
docker compose -f "$COMPOSE_FILE" stop frontend backend migrate || true

echo "[rollback] 2/4 restore database from backup"
./scripts/restore_postgres.sh "$BACKUP_FILE"

echo "[rollback] 3/4 restart stack"
docker compose -f "$COMPOSE_FILE" up -d --build

echo "[rollback] 4/4 verify health"
curl -sS -f http://localhost:3000/health >/dev/null
echo "[rollback] done"
