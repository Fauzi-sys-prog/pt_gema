# Deploy Runbook (Docker Compose)

Tanggal acuan: 2026-03-04

## 1. Prasyarat
- Docker Desktop aktif.
- Port kosong: `3000`, `5173`, `5432`, `5555`.
- File env backend valid (`JWT_SECRET` minimal 32 karakter).

## 2. Start bersih (opsional)
```bash
docker compose down -v
docker compose up -d --build
docker compose ps
```

## 3. Seed akun dan data demo
```bash
docker compose exec backend npm run seed:accounts
docker compose exec backend npm run seed:data-collections
docker compose exec backend npm run seed:demo-flow
docker compose exec backend npm run seed:platform-data
```

## 4. Health check cepat
```bash
# backend
docker compose exec backend sh -lc "curl -s http://localhost:3000/health"

# login test
docker compose exec backend sh -lc "curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"aji\",\"password\":\"changeMeAji123\"}'"
```

## 5. Smoke security
```bash
docker compose exec backend npm run smoke:security-all
```

Expected:
- `All security smoke tests passed.`

## 6. Build verification
```bash
npm --prefix backend run build
npm --prefix frontend run build
```

## 7. Operasional harian
- Lihat status service:
```bash
docker compose ps
```
- Lihat log backend:
```bash
docker compose logs -f backend
```
- Restart backend:
```bash
docker compose restart backend
```

## 8. Troubleshooting cepat
- Error login 401:
  - cek seed akun sudah dijalankan.
  - cek password sesuai `.env.seed`.
- Prisma Studio tidak update schema:
```bash
docker compose exec backend npx prisma generate
docker compose exec backend npx prisma db push --accept-data-loss
docker compose restart prisma-studio
```
- Data tidak muncul di FE:
  - cek endpoint return 200 di network.
  - cek container `backend` dan `postgres` status `Up`.

## 9. Hardening minimum sebelum production
- Ganti `JWT_SECRET` dengan secret kuat (>=32 char, random).
- Restrict CORS origin ke domain resmi.
- Matikan Prisma Studio di production.
- Gunakan reverse proxy + HTTPS.
- Simpan backup DB terjadwal.

## 10. Backup DB sederhana
```bash
docker compose exec postgres sh -lc "pg_dump -U postgres gemadb > /tmp/gemadb.sql"
docker compose cp postgres:/tmp/gemadb.sql ./gemadb-backup.sql
```

## 11. Restore DB sederhana
```bash
docker compose cp ./gemadb-backup.sql postgres:/tmp/gemadb-backup.sql
docker compose exec postgres sh -lc "psql -U postgres -d gemadb < /tmp/gemadb-backup.sql"
```
