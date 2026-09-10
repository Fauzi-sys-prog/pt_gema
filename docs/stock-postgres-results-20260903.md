# Inventory PostgreSQL integration results — 2026-09-03

Result: **8 passed, 0 failed** (2.39 seconds).

Test script: `backend/scripts/stock-postgres-integration.cjs`.
Backend image tested: `pt_gema-backend`, manifest
`sha256:398901c11fdf5525af9d4f29346349c4fde582d9a654b84955bf8fcc08286189`.

## Isolation and method

- Dedicated PostgreSQL 16 Alpine container, database `stock_test`, tmpfs storage.
- Internal Docker network; no published ports or production network membership.
- Fresh schema from the backend image; synthetic fixtures only.
- Real compiled inventory router mounted in Express, real JWT authentication and Prisma queries.
- HTTP requests launched concurrently. A test-only PostgreSQL update trigger delays writes by 150ms to produce overlapping transactions. Prisma reported real serialization conflicts during stock-out, stock-in and manual-edit tests.
- A test-only audit insert trigger throws for fixture IDs beginning `rollback-`.
- Script refuses to run unless host is `test-db`, database is `stock_test`, and NODE_ENV is `test`; it also checks current_database().
- No production business data read, copied, or mutated. No production deployment needed for this test batch.

## Cases verified

1. Two simultaneous stock-outs, each consuming 7 from stock 10: one HTTP 201, one HTTP 400; final balance 3, one document and one movement.
2. Two simultaneous stock-ins (+5, +7) from stock 10: both HTTP 201; final balance 22; movement before/after balances form a continuous chain; GET returns database balance despite stale metadata.
3. Duplicate material lines (+2, +3) in one stock-in: final balance 15 from 10.
4. Two manual edits sharing an updatedAt version: one HTTP 200, one HTTP 409; one audit entry and balance matching the successful edit.
5. Manual edit using a version captured before a stock-in: HTTP 409; stock-in balance remains 14.
6. Audit INSERT failure during stock-in: HTTP 500; original balance retained; no stock-in document, item rows, or movement persisted.
7. Audit INSERT failure during manual stock edit: HTTP 500; original balance retained.
8. Audit INSERT failure during opname confirmation: HTTP 500; original balance retained, opname remains Draft, no adjustment movement persisted.

## Limits and next checks

This verifies these eight scenarios, not every inventory workflow or all-load safety. Browser/UI behavior was not tested. Remaining useful coverage: simultaneous opname confirmation, mixed stock-in/out, update/delete reversal, new-material creation conflicts, retry exhaustion, direct/generic write endpoints, and payment/payroll concurrency. Existing audit findings outside this batch remain open.
