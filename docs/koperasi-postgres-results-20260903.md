# Koperasi/payroll PostgreSQL integration — 2026-09-03

Result: 5 passed, 0 failed; Node test duration 1.37 seconds.

Executed actual compiled koperasiRouter over HTTP with JWT authentication and a synthetic OWNER. Real PostgreSQL 16 in a separate internal Docker network, no published ports, tmpfs database koperasi_test. Script checks NODE_ENV, hostname and current_database before creating fixtures. No production business records changed; no application deployment performed.

1. Concurrent requests for installment 1 and replay after settlement: all HTTP 200; exactly one paid installment and two cash rows (principal/admin).
2. Missing installment number: 400; out-of-sequence: 409; no loan/cash changes.
3. Injected cash INSERT failure: manual loan increment rolled back, no cash rows.
4. Concurrent posting of the same Approved payroll: 200/400; later replay 400. Exactly one loan installment, one advance reduction (200 to 150), two cash rows, one audit. Payroll Disbursed.
5. Injected audit INSERT failure late in posting: payroll remains Approved, advance remains 200, loan remains zero installments, no cash/audit rows.

BEFORE UPDATE loan trigger slept 150ms to increase transaction overlap. BEFORE INSERT triggers deliberately raised PostgreSQL exceptions for selected test cash/audit records. Error logs for those two cases are expected.

Limitations: no browser/UI testing; no approval/cash-balance race test in this suite; no cross-run same-period or manual-vs-payroll duplicate business-payment validation. Loan cash failure currently returns 404, and payroll replay/technical failure returns 400; tests establish rollback/no duplicate deduction, not ideal HTTP semantics. This does not establish safety of generic AppEntity writers outside these endpoints.

Script: backend/scripts/koperasi-postgres-integration.cjs. Run against isolated test DB only. Temporary DB container and internal network removed after execution; tmpfs dummy data is discarded.
