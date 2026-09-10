#!/usr/bin/env bash
set -euo pipefail

# Run from the project root on the Mac.  It replaces the old Ubuntu stack only
# after making timestamped source and database backups on the server.
SERVER="root@31.97.110.79"
SSH_KEY="${HOME}/.ssh/ptgema_prod_ed25519"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="/private/tmp/ptgema-local-${STAMP}.dump"
ARCHIVE_FILE="/private/tmp/ptgema-source-${STAMP}.tar.gz"

cd "$ROOT_DIR"

echo "[1/6] Export database lokal PostgreSQL..."
docker exec ptgema_postgres_local sh -lc 'pg_dump -U ptgema -d ptgema_local -Fc' > "$DUMP_FILE"
test -s "$DUMP_FILE"

echo "[2/6] Pack source terbaru..."
tar --exclude='node_modules' --exclude='dist' --exclude='.git' --exclude='.DS_Store' \
  -czf "$ARCHIVE_FILE" .

echo "[3/6] Upload source dan database ke Ubuntu..."
scp -i "$SSH_KEY" "$ARCHIVE_FILE" "$DUMP_FILE" "$SERVER:/tmp/"

echo "[4/6] Backup aplikasi dan database lama di Ubuntu..."
ssh -i "$SSH_KEY" "$SERVER" "set -e
  mkdir -p /root/backups
  if [ -d /root/pt_gema ]; then tar -C /root -czf /root/backups/ptgema-source-before-local-${STAMP}.tar.gz pt_gema; fi
  if docker ps -a --format '{{.Names}}' | grep -qx ptgema_postgres_prod; then
    docker exec ptgema_postgres_prod sh -lc 'pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Fc' > /root/backups/ptgema-db-before-local-${STAMP}.dump || true
  fi"

echo "[5/6] Replace source, old backend, and old database..."
ssh -i "$SSH_KEY" "$SERVER" "set -e
  docker rm -f ptgema_frontend_prod ptgema_backend_prod ptgema_postgres_prod 2>/dev/null || true
  OLD_VOLUME=\$(docker volume ls -q | grep -E '^ptgema.*postgres.*data$' | head -1 || true)
  if [ -n \"\$OLD_VOLUME\" ]; then docker volume rm \"\$OLD_VOLUME\"; fi
  rm -rf /root/pt_gema
  mkdir -p /root/pt_gema
  tar -xzf /tmp/$(basename "$ARCHIVE_FILE") -C /root/pt_gema
  cp /root/pt_gema/backend/.env.production.example /root/pt_gema/backend/.env.production
  sed -i 's/replace-this-with-a-long-random-production-secret/ptgema-prod-$(openssl rand -hex 32)/' /root/pt_gema/backend/.env.production
  mkdir -p /root/pt_gema/backend/uploads
  cd /root/pt_gema
  docker compose -f docker-compose.prod.yml up -d --build postgres
  until docker exec ptgema_postgres_prod pg_isready -U ptgema -d ptgema_local; do sleep 2; done
  docker cp /tmp/$(basename "$DUMP_FILE") ptgema_postgres_prod:/tmp/local.dump
  docker exec ptgema_postgres_prod sh -lc 'pg_restore -U ptgema -d ptgema_local --clean --if-exists /tmp/local.dump'
  docker compose -f docker-compose.prod.yml up -d --build"

echo "[6/6] Verify production..."
ssh -i "$SSH_KEY" "$SERVER" "set -e
  curl -fsS http://127.0.0.1:3000/health
  curl -fsSI http://127.0.0.1:8080 | head -1
  docker compose -f /root/pt_gema/docker-compose.prod.yml ps"

echo "Done. Open https://gemateknik.online"
