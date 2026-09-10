# Payment PostgreSQL integration results — 2026-09-03

Result: **10 passed, 0 failed**, duration 3.05 seconds.

Script: `backend/scripts/payment-postgres-integration.cjs`.
Tested the existing compiled `financePaymentService` in image `pt_gema-backend`, previously deployed manifest `sha256:398901c11fdf5525af9d4f29346349c4fde582d9a654b84955bf8fcc08286189`.

## Method and isolation

Fresh PostgreSQL 16 Alpine container with tmpfs data, internal Docker network, no published ports, no production network membership or production data. Schema initialized from the backend image. Script checks hostname `test-db`, database `payment_test`, NODE_ENV `test`, and current_database(). Real Prisma service calls, not database mocks. Concurrent calls use Promise.all/Promise.allSettled; a test-only BEFORE UPDATE trigger delays invoice writes by 200ms. A separate test-only audit INSERT trigger raises an exception for fixture IDs prefixed `rollback-`.

## Verified for both customer and vendor invoices

1. Two concurrent payments sharing a proof, plus replay after settlement: one payment row, one audit row, paidAmount 100, outstandingAmount 0, status Paid.
2. Concurrent distinct payments of 30 and 40 against total 100: two payment and audit rows, paidAmount 70, outstandingAmount 30.
3. Concurrent payments of 60 and 60 against total 100: one succeeds and one rejects as overpayment; paidAmount 60, outstandingAmount 40, one payment and audit row.
4. Concurrent requests sharing a proof but with different amounts: one succeeds, one rejects the amount mismatch, only the winning amount is recorded.
5. Actual PostgreSQL audit INSERT failure after invoice update: service rejects; payment and audit rows absent; invoice paidAmount remains 0, outstandingAmount 100, status Unpaid.

## Limits

Service-level integration tests, not HTTP, browser, or permission tests. No real funds transferred and no production deployment in this batch. Does not verify callers supplying stable idempotency keys, unkeyed retries, arbitrary load/lock timeouts, other invoice mutation endpoints, payroll or koperasi. These remain separate work.
