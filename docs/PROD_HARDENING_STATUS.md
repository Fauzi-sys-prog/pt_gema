# Production Hardening Status

## Current Status

PTGema production is live and materially more secure than before. Public traffic is routed through `nginx` on `gemateknik.online` and `api.gemateknik.online`, while internal services are no longer exposed directly to the internet. Baseline server hardening, SSH protection, and automated database backups are now active.

## Completed

- `nginx` is the public entrypoint on ports `80` and `443`
- `frontend` is bound only to `127.0.0.1:5173`
- `backend` is bound only to `127.0.0.1:3000`
- `postgres` is local-only
- `ufw` is enabled
- firewall rules allow only `22`, `80`, and `443`
- `fail2ban` is installed and the `sshd` jail is active
- SSH access now supports key-based login
- `root` password login has been disabled
- daily PostgreSQL backups are active
- backup retention cleanup for `14` days is active
- a manual backup test completed successfully
- the public site and API remained healthy after hardening

## SSH Access

Use the server key from the local machine:

```bash
ssh -i ~/.ssh/ptgema_prod_ed25519 root@31.97.110.79
```

SSH policy is now effectively:

- `PermitRootLogin prohibit-password`
- `PasswordAuthentication no`
- `PubkeyAuthentication yes`

## Database Backup

Backup directory on the server:

```bash
/root/backups/ptgema-postgres
```

Installed cron jobs:

```cron
30 2 * * * cd /root/ptgema && COMPOSE_FILE=docker-compose.prod.yml OUT_DIR=/root/backups/ptgema-postgres ./scripts/backup_postgres.sh >> /var/log/ptgema-backup.log 2>&1
40 2 * * * cd /root/ptgema && OUT_DIR=/root/backups/ptgema-postgres RETENTION_DAYS=14 ./scripts/prune_backups.sh >> /var/log/ptgema-backup.log 2>&1
```

Manual restore flow:

```bash
cd /root/ptgema
COMPOSE_FILE=docker-compose.prod.yml ./scripts/restore_postgres.sh /root/backups/ptgema-postgres/<backup-file>.sql.gz
```

Manual download to the local laptop:

```bash
cd "/Users/macbook/Downloads/Ptgema-main 2"
./scripts/download_prod_backup.sh
```

To pull a specific file:

```bash
./scripts/download_prod_backup.sh gemadb_backup_<timestamp>.sql.gz
```

## Remaining Improvements

- push backups to object storage or a second server
- replace direct `root` operations with a dedicated admin user
- add monitoring and alerting
- run periodic restore drills, not only backup generation
- rotate production secrets on a planned schedule

## Summary

The production stack is now in a much better operational state: the app is live, service exposure is tighter, SSH access is safer, and the database has an automated backup path.
