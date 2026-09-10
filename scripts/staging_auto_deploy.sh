#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
ENV_FILE="${ENV_FILE:-$REPO_DIR/backend/.env.staging}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_DIR/docker-compose.staging.yml}"
PROJECT_NAME="${PROJECT_NAME:-ptgema_staging}"
STATE_FILE="${STATE_FILE:-$REPO_DIR/.staging-deployed-rev}"
LOCK_FILE="${LOCK_FILE:-/tmp/ptgema-staging-autodeploy.lock}"

if [[ "$ENV_FILE" != /* ]]; then
  ENV_FILE="$REPO_DIR/$ENV_FILE"
fi

if [[ "$COMPOSE_FILE" != /* ]]; then
  COMPOSE_FILE="$REPO_DIR/$COMPOSE_FILE"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[staging-auto] missing env file: $ENV_FILE"
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "[staging-auto] missing compose file: $COMPOSE_FILE"
  exit 1
fi

cd "$REPO_DIR"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[staging-auto] another run is already in progress"
  exit 0
fi

echo "[staging-auto] fetching $REMOTE/$BRANCH"
git fetch "$REMOTE" "$BRANCH" --depth=1

target_rev="$(git rev-parse "$REMOTE/$BRANCH")"
current_rev="$(git rev-parse HEAD)"
last_deployed=""

if [[ -f "$STATE_FILE" ]]; then
  last_deployed="$(tr -d '[:space:]' <"$STATE_FILE")"
fi

if [[ "$target_rev" == "$current_rev" && "$target_rev" == "$last_deployed" ]]; then
  echo "[staging-auto] already on $target_rev"
  exit 0
fi

echo "[staging-auto] updating worktree to $target_rev"
git reset --hard "$target_rev"
git clean -fd

echo "[staging-auto] deploying staging stack"
export COMPOSE_FILE ENV_FILE PROJECT_NAME
"$REPO_DIR/scripts/deploy_staging.sh"

printf '%s\n' "$target_rev" >"$STATE_FILE"
echo "[staging-auto] deployed $target_rev"
