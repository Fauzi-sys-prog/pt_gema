# PTGema Go-Live Checklist

Checklist ini dibuat untuk menjawab satu pertanyaan praktis:

`Apakah PTGema sudah siap untuk dipakai internal, controlled rollout, atau full production go-live?`

Pakai dokumen ini sebagai gate terakhir sebelum menyatakan sistem aman dipakai di luar lingkungan dev.

## Current Technical Status

Item di bawah ini sudah terverifikasi dari kondisi repo dan stack saat ini:

- [x] Backend build passes (`npm run build` di `backend`)
- [x] Frontend build passes (`npm run build` di `frontend`)
- [x] `docker compose config` is valid
- [x] Main containers are healthy in the current stack (`backend`, `frontend`, `postgres`)
- [x] Core backend smoke test passes with the active seeded credentials (`47/47` checks)
- [x] Core auth works with active seeded credentials
- [x] Documentation for architecture, setup, release notes, and recruiter-facing project summary is available in the repo

Artinya, secara teknis aplikasi sudah layak untuk:

- internal demo
- recruiter or stakeholder review
- controlled internal usage
- staging-style validation

Namun ini belum otomatis berarti full production readiness.

## Release Decision Levels

### Level 1: Internal Demo Ready

Minimum condition:

- [x] App runs locally through Docker
- [x] Core APIs respond
- [x] Auth works with seeded users
- [x] Main modules can be demonstrated without obvious runtime failure

### Level 2: Internal Controlled Usage Ready

Required:

- [ ] Role-by-role UAT completed for OWNER, ADMIN, FINANCE, SALES, SUPPLY_CHAIN, PRODUKSI, and SPV
- [ ] Real business users validate key flows in their own module
- [ ] Production-like environment variables prepared and reviewed
- [ ] Seed or demo credentials removed from operational environment
- [ ] Browser-console check performed on critical pages
- [ ] No unexplained 4xx/5xx errors on core workflows during UAT

### Level 3: Full Production Ready

Required:

- [ ] All items in Level 2 completed
- [ ] HTTPS reverse proxy active on the real domain
- [ ] Production database backup and restore tested
- [ ] Monitoring and alerting in place
- [ ] Production-only secrets rotated and stored safely
- [ ] Production deployment runbook tested
- [ ] Rollback procedure tested
- [ ] Business owner signs off

## Critical Functional Flows To Validate

These are the flows that matter most before go-live.

### Auth and Access

- [ ] Login with each real role
- [ ] Logout flow
- [x] `/auth/me` returns expected user role and profile in smoke verification
- [ ] Role-based menu visibility matches allowed access
- [ ] Unauthorized actions are correctly rejected by backend

### Commercial Flow

- [ ] Data Collection can be created and retrieved
- [ ] Quotation can be created from business data
- [ ] Project can be created or promoted from quotation flow
- [ ] Approval and reject flows behave correctly for authorized roles only

### Procurement and Inventory

- [ ] Purchase order flow works end to end
- [ ] Receiving flow updates data correctly
- [ ] Stock in / stock out / movement pages stay consistent with backend data
- [ ] Warehouse ledger and traceability data render without mismatch
- [ ] Material request flow works with proper permissions

### Finance

- [ ] Customer invoice list and detail work
- [ ] Vendor invoice flow works
- [ ] Payment recording works
- [ ] Accounts receivable and payable pages show expected aggregates
- [x] Dashboard finance summaries return correct responses in smoke verification
- [ ] Approval center behaves correctly per role

### HR and Operations

- [x] Employee-related core endpoints respond in smoke verification
- [ ] Attendance and leave flows work
- [ ] Payroll-related pages open and save without breaking dependent data
- [ ] Field project record flow behaves correctly

### Logistics and Production

- [x] Surat jalan core endpoint responds in smoke verification
- [ ] Delivery tracking page data stays aligned with backend
- [ ] Production dashboard renders correctly
- [ ] QC inspection media or related flows work

### Media and Attachments

- [ ] Media upload routes behave correctly for allowed users in UI and API
- [ ] File references persist correctly
- [ ] Invalid uploads are rejected safely
- [ ] Uploaded file handling does not expose unsafe paths or open access unexpectedly

## Security Gate

Before production, confirm these explicitly:

- [ ] `JWT_SECRET` is real and strong in production env
- [ ] No default passwords remain active in production
- [ ] `CORS_ORIGIN` is locked to real domains
- [ ] Database is not publicly exposed
- [ ] `prisma-studio` is not exposed in production
- [x] Rate limiting middleware exists and should remain enabled
- [ ] Role-sensitive endpoints are tested against unauthorized access
- [x] Approval and finance actions are implemented as backend-controlled flows
- [ ] Approval and finance actions are retested in production-like environment, not trusted from client payloads

## Data Safety Gate

- [ ] Daily backup is automated
- [ ] Restore has been tested successfully at least once
- [x] Migration flow is documented and repeatable
- [ ] Existing production data has a rollback path
- [ ] Media storage retention and backup expectations are defined

## Infrastructure Gate

- [x] `docker-compose.prod.yml` exists for production deployment flow
- [ ] Reverse proxy and TLS termination are configured
- [ ] Environment values differ correctly between dev and production
- [ ] Logs can be accessed quickly during incident response
- [ ] Health endpoints are monitored

## Evidence To Collect

To avoid vague "should be okay" releases, collect proof:

- [ ] Screenshots or recordings of critical page walkthroughs
- [x] Smoke test outputs collected at least once during technical verification
- [ ] UAT sign-off sheet
- [ ] Backup and restore test evidence
- [ ] Production deploy notes

Related references already in the repo:

- [PRODUCTION_READY_CHECKLIST.md](/Users/macbook/Downloads/Ptgema-main%202/PRODUCTION_READY_CHECKLIST.md)
- [docs/UAT_FINAL_CHECKLIST.md](/Users/macbook/Downloads/Ptgema-main%202/docs/UAT_FINAL_CHECKLIST.md)
- [docs/UAT_EVIDENCE_SHEET.md](/Users/macbook/Downloads/Ptgema-main%202/docs/UAT_EVIDENCE_SHEET.md)
- [docs/DEPLOY_RUNBOOK.md](/Users/macbook/Downloads/Ptgema-main%202/docs/DEPLOY_RUNBOOK.md)
- [docs/PRODUCTION_DEPLOY.md](/Users/macbook/Downloads/Ptgema-main%202/docs/PRODUCTION_DEPLOY.md)
- [docs/release-notes.md](/Users/macbook/Downloads/Ptgema-main%202/docs/release-notes.md)
- [docs/personal-branding.md](/Users/macbook/Downloads/Ptgema-main%202/docs/personal-branding.md)

## Final Recommendation

Berdasarkan verifikasi yang sudah selesai:

- PTGema sudah ready untuk demo, review stakeholder, dan controlled internal usage.
- PTGema belum otomatis terbukti siap untuk unrestricted production use sampai UAT, backup/restore, security hardening, dan production runbook validation benar-benar selesai.

One-line status:

`Ready to use, but production go-live still needs final operational sign-off.`
