#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/download_prod_backup.sh
#   ./scripts/download_prod_backup.sh gemadb_backup_20260320_184507.sql.gz
#
# Optional env:
#   SSH_HOST=31.97.110.79
#   SSH_USER=root
#   SSH_KEY_PATH=$HOME/.ssh/ptgema_prod_ed25519
#   REMOTE_BACKUP_DIR=/root/backups/ptgema-postgres
#   LOCAL_OUT_DIR=./downloads/backups

SSH_HOST="${SSH_HOST:-31.97.110.79}"
SSH_USER="${SSH_USER:-root}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/ptgema_prod_ed25519}"
REMOTE_BACKUP_DIR="${REMOTE_BACKUP_DIR:-/root/backups/ptgema-postgres}"
LOCAL_OUT_DIR="${LOCAL_OUT_DIR:-./downloads/backups}"

if [[ ! -f "$SSH_KEY_PATH" ]]; then
  echo "[download] ssh key not found: $SSH_KEY_PATH"
  exit 1
fi

mkdir -p "$LOCAL_OUT_DIR"

SSH_OPTS=(
  -i "$SSH_KEY_PATH"
  -o StrictHostKeyChecking=no
)

if [[ $# -ge 1 ]]; then
  REMOTE_FILE_NAME="$1"
else
  REMOTE_FILE_NAME="$(
    ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" \
      "find '${REMOTE_BACKUP_DIR}' -maxdepth 1 -type f -name 'gemadb_backup_*.sql.gz' | sort | tail -n 1 | xargs -n 1 basename"
  )"
fi

if [[ -z "${REMOTE_FILE_NAME:-}" ]]; then
  echo "[download] no backup file found in ${REMOTE_BACKUP_DIR}"
  exit 1
fi

REMOTE_FILE_PATH="${REMOTE_BACKUP_DIR}/${REMOTE_FILE_NAME}"
LOCAL_FILE_PATH="${LOCAL_OUT_DIR}/${REMOTE_FILE_NAME}"

echo "[download] pulling ${REMOTE_FILE_PATH}"
scp "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}:${REMOTE_FILE_PATH}" "${LOCAL_FILE_PATH}"
echo "[download] saved to ${LOCAL_FILE_PATH}"
