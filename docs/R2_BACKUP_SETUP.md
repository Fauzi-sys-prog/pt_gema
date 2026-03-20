# R2 Backup Setup

This project already creates local PostgreSQL backups. This guide adds an optional second copy to Cloudflare R2 so backups are stored off-server.

## Files

- [scripts/backup_postgres.sh](/Users/macbook/Downloads/Ptgema-main%202/scripts/backup_postgres.sh)
- [scripts/upload_backup_r2.sh](/Users/macbook/Downloads/Ptgema-main%202/scripts/upload_backup_r2.sh)
- [scripts/prune_backups.sh](/Users/macbook/Downloads/Ptgema-main%202/scripts/prune_backups.sh)
- [deploy/backup/r2.env.example](/Users/macbook/Downloads/Ptgema-main%202/deploy/backup/r2.env.example)
- [deploy/cron/backup.cron.example](/Users/macbook/Downloads/Ptgema-main%202/deploy/cron/backup.cron.example)

## Required Cloudflare Values

- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Recommended bucket example:

- `ptgema-db-backups`

Default object prefix:

- `postgres`

## Server Setup

Install AWS CLI on the production server:

```bash
apt-get update
apt-get install -y awscli
```

Create an env file on the server, for example:

```bash
mkdir -p /root/ptgema/deploy/backup
cp /root/ptgema/deploy/backup/r2.env.example /root/ptgema/deploy/backup/r2.env
```

Then fill in the real R2 values.

## Manual Upload Flow

Create a local backup first:

```bash
cd /root/ptgema
COMPOSE_FILE=docker-compose.prod.yml OUT_DIR=/root/backups/ptgema-postgres ./scripts/backup_postgres.sh
```

Upload the latest backup to R2:

```bash
cd /root/ptgema
set -a
. /root/ptgema/deploy/backup/r2.env
set +a
OUT_DIR=/root/backups/ptgema-postgres ./scripts/upload_backup_r2.sh
```

## Cron Example

Keep the existing local backup and retention jobs. Add the upload job after the local backup:

```cron
30 2 * * * cd /root/ptgema && COMPOSE_FILE=docker-compose.prod.yml OUT_DIR=/root/backups/ptgema-postgres ./scripts/backup_postgres.sh >> /var/log/ptgema-backup.log 2>&1
35 2 * * * cd /root/ptgema && set -a && . /root/ptgema/deploy/backup/r2.env && set +a && OUT_DIR=/root/backups/ptgema-postgres ./scripts/upload_backup_r2.sh >> /var/log/ptgema-backup.log 2>&1
40 2 * * * cd /root/ptgema && OUT_DIR=/root/backups/ptgema-postgres RETENTION_DAYS=14 ./scripts/prune_backups.sh >> /var/log/ptgema-backup.log 2>&1
```

## Notes

- Local backup remains the first safety layer.
- R2 upload is a second copy, not a replacement for local backup.
- If R2 upload fails, the local `.sql.gz` backup still remains on the server.
- Test restore periodically, not just backup creation.

## Local Laptop Pull Option

If you want an extra manual copy without enabling R2 yet, you can pull the latest backup from the production server to the local machine:

```bash
cd "/Users/macbook/Downloads/Ptgema-main 2"
./scripts/download_prod_backup.sh
```

Reference:

- [scripts/download_prod_backup.sh](/Users/macbook/Downloads/Ptgema-main%202/scripts/download_prod_backup.sh)
