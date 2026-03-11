# Production Ready Checklist

## 1) Secrets & Environment
- [ ] Copy `backend/.env.example` to `backend/.env` and fill real values.
- [ ] Set strong `JWT_SECRET` (>= 32 chars, random).
- [ ] Set `NODE_ENV=production`.
- [ ] Set `CORS_ORIGIN` to real domain(s), not localhost.
- [ ] Set `DATABASE_URL` with non-default DB password.
- [ ] Copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_BASE_URL` to production API URL.

## 2) Infrastructure
- [ ] Run app behind HTTPS reverse proxy (Nginx/Traefik/Cloud LB).
- [ ] Restrict database port access (no public internet access).
- [ ] Disable/remove `prisma-studio` from production deployment.
- [ ] Deploy using `docker-compose.prod.yml` (not dev compose).

## 3) Data Safety
- [ ] Enable automated DB backup (daily) + retention policy.
- [ ] Test DB restore at least once.
- [ ] Migration strategy active (`prisma migrate deploy`) for release flow.
- [ ] Baseline migration committed: `backend/prisma/migrations/20260305000000_init`.
- [ ] If DB existing (already berisi tabel), mark baseline as applied once:
  - `docker compose exec backend sh -lc "cd /app && npx prisma migrate resolve --applied 20260305000000_init"`

## 4) Security Controls
- [ ] Keep rate limits enabled.
- [ ] Ensure owner-only endpoints tested (approve/reject/project critical actions).
- [ ] Rotate all default seed passwords.

## 5) Validation & Monitoring
- [ ] Run frontend build: `npm --prefix frontend run build`
- [ ] Run backend build: `npm --prefix backend run build`
- [ ] Smoke test critical flows:
  - [ ] Login/logout
  - [ ] Data Collection -> Quotation -> Project
  - [ ] Approve/Reject project (OWNER only)
  - [ ] Invoice + payment flow
  - [ ] HR + Payroll + Finance pages
- [ ] Add monitoring (app logs + health endpoint + alerting).

## 6) Go-Live Gate
- [ ] No runtime error in browser console on critical pages.
- [ ] No 5xx error on core APIs.
- [ ] UAT sign-off from business owner.

## 7) Production Deploy Commands
```bash
# 1) Prepare env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2) Fill backend/.env and frontend/.env with real production values.

# 3) Build + run production stack
docker compose -f docker-compose.prod.yml up -d --build

# 4) Apply migrations safely
docker compose -f docker-compose.prod.yml run --rm migrate

# 5) Check service status
docker compose -f docker-compose.prod.yml ps
```

## 8) Useful Ops Commands
```bash
# DB backup
./scripts/backup_postgres.sh

# Backup retention cleanup (default keep 14 days)
./scripts/prune_backups.sh

# DB restore
./scripts/restore_postgres.sh ./backups/<file>.sql.gz

# Deploy production (backup + build + smoke)
./scripts/deploy_prod.sh

# Rollback production
./scripts/rollback_prod.sh ./backups/<file>.sql.gz
```

Cron template:
- `deploy/cron/backup.cron.example`
