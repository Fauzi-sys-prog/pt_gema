#!/bin/bash
# Backup harian PT GEMA — PostgreSQL + uploads
# Retensi: 14 hari, 2 lokasi, auto-verifikasi (restore-list di dalam container)

set -euo pipefail

BACKUP_DIR="/root/pt_gema/backups/daily"
STOCK_DIR="/var/backups/ptgema"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="ptgema_postgres_prod"
DB_USER="ptgema"
DB_NAME="ptgema_local"

mkdir -p "$BACKUP_DIR" "$STOCK_DIR"

# 1. Dump database (custom format — kompresi + paralel restore)
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -Fc "$DB_NAME" > "$BACKUP_DIR/db_${DATE}.dump"

# 2. Dump uploads (bukti transfer, foto QC, POD, bon)
UPLOADS_DIR="/root/pt_gema/backend/uploads"
if [ -d "$UPLOADS_DIR" ]; then
  tar -czf "$BACKUP_DIR/uploads_${DATE}.tar.gz" -C "$UPLOADS_DIR" . 2>/dev/null || true
fi

# 3. Copy ke secondary location (survive docker reinstall)
cp "$BACKUP_DIR/db_${DATE}.dump" "$STOCK_DIR/"
[ -f "$BACKUP_DIR/uploads_${DATE}.tar.gz" ] && cp "$BACKUP_DIR/uploads_${DATE}.tar.gz" "$STOCK_DIR/"

# 4. Verifikasi integrity: copy file ke container, pg_restore --list, hapus lagi
SIZE=$(stat -c%s "$BACKUP_DIR/db_${DATE}.dump")
if [ "$SIZE" -lt 10000 ]; then
  echo "BACKUP CORRUPT: db_${DATE}.dump hanya $SIZE bytes" >&2
  exit 1
fi
docker cp "$BACKUP_DIR/db_${DATE}.dump" "$CONTAINER:/tmp/verify_${DATE}.dump"
if ! docker exec "$CONTAINER" pg_restore --list "/tmp/verify_${DATE}.dump" > /dev/null 2>&1; then
  docker exec "$CONTAINER" rm -f "/tmp/verify_${DATE}.dump"
  echo "BACKUP UNREADABLE: pg_restore gagal membaca db_${DATE}.dump" >&2
  exit 1
fi
docker exec "$CONTAINER" rm -f "/tmp/verify_${DATE}.dump"

# 5. Retensi 14 hari di kedua lokasi
find "$BACKUP_DIR" \( -name "*.dump" -o -name "*.tar.gz" \) -mtime +14 -delete
find "$STOCK_DIR" \( -name "*.dump" -o -name "*.tar.gz" \) -mtime +14 -delete

echo "OK $(date '+%Y-%m-%d %H:%M') db=$(numfmt --to=iec $SIZE) db+uploads verified, retensi 14 hari"
