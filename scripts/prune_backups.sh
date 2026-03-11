#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/prune_backups.sh
# Optional env:
#   OUT_DIR=./backups
#   RETENTION_DAYS=14

OUT_DIR="${OUT_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$OUT_DIR"

echo "[prune] removing backups older than ${RETENTION_DAYS} days in ${OUT_DIR}"
find "$OUT_DIR" -type f -name "gemadb_backup_*.sql.gz" -mtime "+${RETENTION_DAYS}" -print -delete
echo "[prune] done"
