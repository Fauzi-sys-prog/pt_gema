#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/monitor_prod.sh
# Optional env:
#   COMPOSE_FILE=docker-compose.prod.yml
#   BACKEND_HEALTH_URL=http://127.0.0.1:3000/health
#   FRONTEND_HEALTH_URL=http://127.0.0.1:5173/
#   PUBLIC_WEB_URL=https://gemateknik.online
#   PUBLIC_API_HEALTH_URL=https://api.gemateknik.online/health
#   CERT_NAME=gemateknik.online
#   SSL_CERT_PATH=/etc/letsencrypt/live/gemateknik.online/fullchain.pem
#   DISK_WARN_PCT=85
#   SSL_WARN_DAYS=21
#   BACKUP_WARN_HOURS=36
#   BACKUP_DIR=/root/backups/ptgema-postgres
#   STATE_DIR=/var/lib/ptgema-monitor
#   ALERT_WEBHOOK_URL=https://example.com/webhook
#   ALERT_TELEGRAM_BOT_TOKEN=123:abc
#   ALERT_TELEGRAM_CHAT_ID=123456

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:3000/health}"
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-http://127.0.0.1:5173/}"
PUBLIC_WEB_URL="${PUBLIC_WEB_URL:-https://gemateknik.online}"
PUBLIC_API_HEALTH_URL="${PUBLIC_API_HEALTH_URL:-https://api.gemateknik.online/health}"
CERT_NAME="${CERT_NAME:-gemateknik.online}"
SSL_CERT_PATH="${SSL_CERT_PATH:-/etc/letsencrypt/live/${CERT_NAME}/fullchain.pem}"
DISK_WARN_PCT="${DISK_WARN_PCT:-85}"
SSL_WARN_DAYS="${SSL_WARN_DAYS:-21}"
BACKUP_WARN_HOURS="${BACKUP_WARN_HOURS:-36}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups/ptgema-postgres}"
STATE_DIR="${STATE_DIR:-/var/lib/ptgema-monitor}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
ALERT_TELEGRAM_BOT_TOKEN="${ALERT_TELEGRAM_BOT_TOKEN:-}"
ALERT_TELEGRAM_CHAT_ID="${ALERT_TELEGRAM_CHAT_ID:-}"

mkdir -p "$STATE_DIR"

STATE_FILE="${STATE_DIR}/last-state.txt"
STATUS_FILE="${STATE_DIR}/last-status.txt"

timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
issues=()
facts=()

append_issue() {
  issues+=("$1")
}

append_fact() {
  facts+=("$1")
}

check_http_200() {
  local label="$1"
  local url="$2"
  local code
  code="$(curl -k -sS -o /dev/null -w "%{http_code}" --max-time 15 "$url" || true)"
  append_fact "${label}_http=${code:-ERR}"
  if [[ "$code" != "200" ]]; then
    append_issue "${label}_http_${code:-ERR}"
  fi
}

check_compose_service() {
  local service="$1"
  local expect_health="$2"
  local container_id
  container_id="$(docker compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null | head -n1)"

  if [[ -z "$container_id" ]]; then
    append_issue "${service}_container_missing"
    return
  fi

  local inspect
  inspect="$(docker inspect -f '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.RestartCount}}' "$container_id" 2>/dev/null || true)"
  local state health restarts
  state="$(echo "$inspect" | cut -d'|' -f1)"
  health="$(echo "$inspect" | cut -d'|' -f2)"
  restarts="$(echo "$inspect" | cut -d'|' -f3)"

  append_fact "${service}_state=${state:-unknown}"
  append_fact "${service}_health=${health:-unknown}"
  append_fact "${service}_restarts=${restarts:-unknown}"

  if [[ "$state" != "running" ]]; then
    append_issue "${service}_state_${state:-unknown}"
    return
  fi

  if [[ "$expect_health" == "healthy" && "$health" != "healthy" ]]; then
    append_issue "${service}_health_${health:-unknown}"
  fi
}

check_disk_usage() {
  local usage
  usage="$(df --output=pcent / | tail -n1 | tr -dc '0-9')"
  append_fact "disk_root_pct=${usage:-unknown}"
  if [[ -n "$usage" && "$usage" -ge "$DISK_WARN_PCT" ]]; then
    append_issue "disk_root_${usage}pct"
  fi
}

check_ssl_expiry() {
  if [[ ! -f "$SSL_CERT_PATH" ]]; then
    append_issue "ssl_cert_missing"
    return
  fi

  local expiry_raw expiry_ts now_ts days_left
  expiry_raw="$(openssl x509 -enddate -noout -in "$SSL_CERT_PATH" | cut -d= -f2-)"
  expiry_ts="$(date -d "$expiry_raw" +%s 2>/dev/null || true)"
  now_ts="$(date +%s)"

  if [[ -z "$expiry_ts" ]]; then
    append_issue "ssl_expiry_parse_failed"
    return
  fi

  days_left="$(( (expiry_ts - now_ts) / 86400 ))"
  append_fact "ssl_days_left=${days_left}"

  if [[ "$days_left" -lt "$SSL_WARN_DAYS" ]]; then
    append_issue "ssl_days_left_${days_left}"
  fi
}

check_backup_freshness() {
  local latest_backup latest_ts now_ts age_hours
  latest_backup="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'gemadb_backup_*.sql.gz' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n1 | cut -d' ' -f2-)"

  if [[ -z "$latest_backup" ]]; then
    append_issue "backup_missing"
    return
  fi

  latest_ts="$(stat -c %Y "$latest_backup" 2>/dev/null || true)"
  now_ts="$(date +%s)"
  if [[ -z "$latest_ts" ]]; then
    append_issue "backup_stat_failed"
    return
  fi

  age_hours="$(( (now_ts - latest_ts) / 3600 ))"
  append_fact "backup_latest=$(basename "$latest_backup")"
  append_fact "backup_age_hours=${age_hours}"

  if [[ "$age_hours" -gt "$BACKUP_WARN_HOURS" ]]; then
    append_issue "backup_age_${age_hours}h"
  fi
}

send_alerts() {
  local severity="$1"
  local summary="$2"
  local details="$3"

  if command -v logger >/dev/null 2>&1; then
    logger -t ptgema-monitor "[${severity}] ${summary} :: ${details}"
  fi

  if [[ -n "$ALERT_WEBHOOK_URL" ]]; then
    curl -sS -X POST "$ALERT_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"severity\":\"${severity}\",\"summary\":\"${summary}\",\"details\":\"${details}\",\"host\":\"$(hostname)\",\"ts\":\"${timestamp}\"}" \
      >/dev/null || true
  fi

  if [[ -n "$ALERT_TELEGRAM_BOT_TOKEN" && -n "$ALERT_TELEGRAM_CHAT_ID" ]]; then
    curl -sS -X POST "https://api.telegram.org/bot${ALERT_TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${ALERT_TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=[${severity}] ${summary}
${details}
host=$(hostname)
ts=${timestamp}" \
      >/dev/null || true
  fi
}

check_compose_service "backend" "healthy"
check_compose_service "frontend" "running"
check_compose_service "postgres" "healthy"
check_http_200 "backend_health" "$BACKEND_HEALTH_URL"
check_http_200 "frontend_local" "$FRONTEND_HEALTH_URL"
check_http_200 "web_public" "$PUBLIC_WEB_URL"
check_http_200 "api_public" "$PUBLIC_API_HEALTH_URL"
check_disk_usage
check_ssl_expiry
check_backup_freshness

current_state="OK"
if [[ "${#issues[@]}" -gt 0 ]]; then
  current_state="ISSUES:${issues[*]}"
fi

last_state=""
if [[ -f "$STATE_FILE" ]]; then
  last_state="$(cat "$STATE_FILE" 2>/dev/null || true)"
fi

{
  echo "ts=${timestamp}"
  for fact in "${facts[@]}"; do
    echo "$fact"
  done
  if [[ "${#issues[@]}" -eq 0 ]]; then
    echo "status=OK"
  else
    echo "status=FAIL"
    for issue in "${issues[@]}"; do
      echo "issue=${issue}"
    done
  fi
} > "$STATUS_FILE"

printf '%s\n' "$current_state" > "$STATE_FILE"

if [[ "$current_state" != "$last_state" ]]; then
  if [[ -z "$last_state" && "${#issues[@]}" -eq 0 ]]; then
    :
  elif [[ -z "$last_state" && "${#issues[@]}" -gt 0 ]]; then
    send_alerts "ALERT" "PT GEMA production monitor detected issues" "$(tr '\n' '; ' < "$STATUS_FILE")"
  elif [[ "${#issues[@]}" -eq 0 ]]; then
    send_alerts "RECOVERY" "PT GEMA production monitor recovered" "$(tr '\n' '; ' < "$STATUS_FILE")"
  else
    send_alerts "ALERT" "PT GEMA production monitor detected issues" "$(tr '\n' '; ' < "$STATUS_FILE")"
  fi
fi

cat "$STATUS_FILE"

if [[ "${#issues[@]}" -gt 0 ]]; then
  exit 1
fi
