#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/upload_backup_r2.sh [/path/to/backup.sql.gz]
#
# Required env:
#   R2_ACCOUNT_ID
#   R2_BUCKET_NAME
#   R2_ACCESS_KEY_ID
#   R2_SECRET_ACCESS_KEY
#
# Optional env:
#   R2_REGION=auto
#   R2_PREFIX=postgres
#   OUT_DIR=./backups

R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}"
R2_BUCKET_NAME="${R2_BUCKET_NAME:-}"
R2_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:-}"
R2_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:-}"
R2_REGION="${R2_REGION:-auto}"
R2_PREFIX="${R2_PREFIX:-postgres}"
OUT_DIR="${OUT_DIR:-./backups}"

if [[ -z "$R2_ACCOUNT_ID" || -z "$R2_BUCKET_NAME" || -z "$R2_ACCESS_KEY_ID" || -z "$R2_SECRET_ACCESS_KEY" ]]; then
  echo "[r2] missing required R2 credentials"
  echo "[r2] required: R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY"
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "[r2] aws cli is not installed"
  echo "[r2] install it first, for example: apt-get install -y awscli"
  exit 1
fi

if [[ $# -ge 1 ]]; then
  BACKUP_FILE="$1"
else
  BACKUP_FILE="$(find "$OUT_DIR" -maxdepth 1 -type f -name 'gemadb_backup_*.sql.gz' | sort | tail -n 1)"
fi

if [[ -z "${BACKUP_FILE:-}" || ! -f "$BACKUP_FILE" ]]; then
  echo "[r2] backup file not found"
  exit 1
fi

ENDPOINT_URL="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
OBJECT_KEY="${R2_PREFIX%/}/$(basename "$BACKUP_FILE")"

echo "[r2] uploading ${BACKUP_FILE}"
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
AWS_DEFAULT_REGION="$R2_REGION" \
aws s3 cp "$BACKUP_FILE" "s3://${R2_BUCKET_NAME}/${OBJECT_KEY}" \
  --endpoint-url "$ENDPOINT_URL"

echo "[r2] upload complete: s3://${R2_BUCKET_NAME}/${OBJECT_KEY}"
