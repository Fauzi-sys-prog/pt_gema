# Production Env Values

Use this as the minimum env checklist before go-live.

## Backend

Recommended source file:

- [backend/.env.production.example](/Users/macbook/Downloads/Ptgema-main%202/backend/.env.production.example)

Values that must be replaced before production:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `JWT_SECRET`

Values that must match your real deployment:

- `CORS_ORIGIN=https://gemateknik.online`
- `FILE_PUBLIC_BASE_URL=https://api.gemateknik.online`
- `ALLOW_LOCALHOST_CORS_IN_PROD=false`

Do not use these local-only values in production:

- `localhost` inside `DATABASE_URL`
- `http://localhost:5173` for `CORS_ORIGIN`
- `ALLOW_LOCALHOST_CORS_IN_PROD=true`
- any value from `backend/.env.seed`

## Frontend

Recommended source file:

- [frontend/.env.production.example](/Users/macbook/Downloads/Ptgema-main%202/frontend/.env.production.example)

Required value:

- `VITE_API_BASE_URL=https://api.gemateknik.online`

## Quick Copy Flow

```bash
cp backend/.env.production.example backend/.env
cp frontend/.env.production.example frontend/.env
```

Then replace:

- database password
- JWT secret
- domain values if your production domain changes

## Final Safety Reminder

These values must never be reused from dev or seed setup:

- local database passwords
- seed user passwords
- local JWT secrets
- localhost CORS values

## Optional Off-Server Backup Values

If you enable Cloudflare R2 backup uploads, prepare these values in a separate server-only env file:

- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_REGION=auto`
- `R2_PREFIX=postgres`

Reference files:

- [deploy/backup/r2.env.example](/Users/macbook/Downloads/Ptgema-main%202/deploy/backup/r2.env.example)
- [docs/R2_BACKUP_SETUP.md](/Users/macbook/Downloads/Ptgema-main%202/docs/R2_BACKUP_SETUP.md)
