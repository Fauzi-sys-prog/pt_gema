#!/usr/bin/env bash
# Temporary remote-side deploy runner for the payload already placed in /tmp.
set -euo pipefail

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=/root/backups
SOURCE_ARCHIVE=/tmp/ptgema-source-20260820-0937.tar.gz
LOCAL_DUMP=/tmp/ptgema-local-20260820.dump
APP_DIR=/root/pt_gema

test -s "$SOURCE_ARCHIVE"
test -s "$LOCAL_DUMP"
mkdir -p "$BACKUP_DIR"

echo '[1/7] Backup source dan database production lama'
if [ -d "$APP_DIR" ]; then
  tar -C /root -czf "$BACKUP_DIR/ptgema-source-before-local-${STAMP}.tar.gz" pt_gema
fi
if docker ps -a --format '{{.Names}}' | grep -qx ptgema_postgres_prod; then
  docker exec ptgema_postgres_prod sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP_DIR/ptgema-db-before-local-${STAMP}.dump" || true
fi

echo '[2/7] Stop stack lama'
docker rm -f ptgema_frontend_prod ptgema_backend_prod ptgema_migrate_prod ptgema_postgres_prod 2>/dev/null || true

echo '[3/7] Hapus volume database lama'
for volume in ptgema_pgdata_prod ptgema-clean_pgdata_prod; do
  if docker volume inspect "$volume" >/dev/null 2>&1; then
    docker volume rm "$volume"
  fi
done

echo '[4/7] Ganti source aplikasi'
if [ -d "$APP_DIR" ]; then
  mv "$APP_DIR" "/root/pt_gema-replaced-${STAMP}"
fi
mkdir -p "$APP_DIR"
tar -xzf "$SOURCE_ARCHIVE" -C "$APP_DIR"
cp "$APP_DIR/backend/.env.production.example" "$APP_DIR/backend/.env.production"
SECRET="ptgema-prod-$(openssl rand -hex 32)"
sed -i "s/replace-this-with-a-long-random-production-secret/${SECRET}/" "$APP_DIR/backend/.env.production"
mkdir -p "$APP_DIR/backend/uploads"

echo '[5/7] Buat PostgreSQL baru'
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml up -d postgres
until docker exec ptgema_postgres_prod pg_isready -U ptgema -d ptgema_local >/dev/null 2>&1; do
  sleep 2
done

echo '[6/7] Restore database lokal'
docker cp "$LOCAL_DUMP" ptgema_postgres_prod:/tmp/local.dump
docker exec ptgema_postgres_prod sh -lc 'pg_restore -U ptgema -d ptgema_local --clean --if-exists /tmp/local.dump'

echo '[7/7] Build dan hidupkan frontend + backend terbaru'
docker compose -f docker-compose.prod.yml up -d --build
for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3000/health >/dev/null; then
    break
  fi
  sleep 3
done
curl -fsS http://127.0.0.1:3000/health
echo
docker compose -f docker-compose.prod.yml ps
printf 'FRONTEND API: '
docker exec ptgema_frontend_prod sh -lc 'grep -R -o -m1 "https://api.gemateknik.online" /usr/share/nginx/html/assets/*.js | head -1'
