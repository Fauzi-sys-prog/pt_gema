# Production Deploy Guide

## 1) Prepare Environment
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill production values:
- `backend/.env`: strong DB password, strong `JWT_SECRET`, real `CORS_ORIGIN`, `NODE_ENV=production`
- `frontend/.env`: `VITE_API_BASE_URL` to production API domain (example: `https://api.yourcompany.com`)

## 2) Run Production Stack
```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

Notes:
- `migrate` service runs `prisma migrate deploy` once before backend starts.
- `prisma-studio` is intentionally excluded from production stack.

## 3) Backup & Restore

Backup:
```bash
./scripts/backup_postgres.sh
```

Restore:
```bash
./scripts/restore_postgres.sh ./backups/gemadb_backup_YYYYMMDD_HHMMSS.sql.gz
```

Automated deploy (backup + build + smoke check):
```bash
./scripts/deploy_prod.sh
```

Rollback:
```bash
./scripts/rollback_prod.sh ./backups/gemadb_backup_YYYYMMDD_HHMMSS.sql.gz
```

Retention cleanup:
```bash
./scripts/prune_backups.sh
```

Set automated backup (cron):
```bash
crontab -e
```

Use template from:
- `deploy/cron/backup.cron.example`

## 4) Reverse Proxy HTTPS

Use:
- `deploy/nginx/gemateknik.online.conf`

Adjust:
- domain names
- certificate file paths
- firewall rules

## 5) Post-Deploy Verification
```bash
curl -sS http://localhost:3000/health
docker compose -f docker-compose.prod.yml logs backend --tail=100
docker compose -f docker-compose.prod.yml logs frontend --tail=100
./scripts/smoke_prod.sh
```
