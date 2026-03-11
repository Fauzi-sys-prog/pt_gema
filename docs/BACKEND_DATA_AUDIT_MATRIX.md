# Backend Data Audit Matrix

Audit ini menjawab 4 hal:

- apakah page sudah pakai backend
- apakah data sudah ada di database
- apakah masih berbentuk `payload JSON`
- seberapa matang level relasionalnya

## Legend

- `Backend`: page baca/tulis lewat API backend
- `DB`: data disimpan di database
- `JSON Payload`: model masih dominan simpan object dalam `payload JSON`
- `Relational Level`
  - `High`: route dedicated / relasi inti sudah jelas
  - `Medium`: sudah backend + DB, tapi masih hybrid JSON
  - `Low-Medium`: backend-backed, tapi model masih longgar dan lebih cocok dibersihkan lagi

## Matrix

| Menu / Modul | Backend | DB | JSON Payload | Relational Level | Catatan |
|---|---|---:|---:|---|---|
| Auth / Login | Ya | Ya | Tidak dominan | High | Core auth route dedicated |
| User Management | Ya | Ya | Tidak dominan | High | User model native |
| Data Collection | Ya | Ya | Payload ada, tapi route dedicated | High | Core object |
| Quotation | Ya | Ya | Payload ada, route dedicated | High | Core object |
| Project | Ya | Ya | Payload ada, route dedicated | High | Core object |
| Employees | Ya | Ya | Ya | Medium | Dedicated table + payload |
| Attendances | Ya | Ya | Ya | Medium | Dedicated table + payload |
| Purchase Orders | Ya | Ya | Ya | Medium | Sudah DB-backed, masih payload-heavy |
| Receivings | Ya | Ya | Ya | Medium | Sudah terhubung PO/project |
| Stock Items | Ya | Ya | Ya | Medium | Penting, tapi belum enterprise-normalized |
| Stock In | Ya | Ya | Ya | Medium | Masih payload JSON |
| Stock Out | Ya | Ya | Ya | Medium | Masih payload JSON |
| Stock Movements | Ya | Ya | Ya | Medium | Sangat penting untuk integritas stok |
| Stock Opname | Ya | Ya | Ya | Medium | Perlu diperdalam kalau mau audit-grade |
| Work Orders | Ya | Ya | Ya | Medium | Sudah nyambung ke project |
| Production Reports | Ya | Ya | Ya | Medium | Masih payload JSON |
| Production Trackers | Ya | Ya | Ya | Medium | Masih payload JSON |
| QC Inspections | Ya | Ya | Ya | Medium | Masih payload JSON |
| Material Requests | Ya | Ya | Ya | Medium | Sudah fungsional |
| Surat Jalan | Ya | Ya | Ya | Medium | Bagus, tapi masih hybrid |
| Proof of Delivery | Ya | Ya | Ya | Medium | Sudah ada relasi dasar |
| Berita Acara | Ya | Ya | Ya | Medium | Dokumen operasional masih hybrid |
| SPK Records | Ya | Ya | Ya | Medium | Masih payload JSON |
| Surat Masuk | Ya | Ya | Ya | Medium | Correspondence hybrid |
| Surat Keluar | Ya | Ya | Ya | Medium | Correspondence hybrid |
| Template Surat | Ya | Ya | Ya | Medium | Bukan masalah besar, tapi masih payload |
| Assets | Ya | Ya | Ya | Medium | Backend-backed |
| Maintenances | Ya | Ya | Ya | Medium | Hybrid |
| Payroll | Ya | Ya | Ya | Medium | Export sudah kuat, model masih hybrid |
| Vendor | Ya | Ya | Ya | Medium | Backend-backed |
| Vendor Expenses | Ya | Ya | Ya | Medium | Finance ops hybrid |
| Vendor Invoices | Ya | Ya | Ya | Medium | Finance ops hybrid |
| Customers | Ya | Ya | Ya | Medium | Backend-backed |
| Customer Invoices | Ya | Ya | Ya | Medium | Finance ops hybrid |
| Working Expense Sheets | Ya | Ya | Ya | Medium | Hybrid |
| Bank Reconciliation | Ya | Ya | Ya | Medium | Export kuat, model masih hybrid |
| Petty Cash | Ya | Ya | Ya | Medium | Hybrid |
| Kasbon | Ya | Ya | Ya | Medium | Hybrid |
| Archive Registry | Ya | Ya | Ya | Medium | Hybrid |
| Audit Logs | Ya | Ya | Ya | Medium | Hybrid, tapi cukup aman |
| Fleet Health | Ya | Ya | Ya | Medium | Hybrid |
| HR extra modules | Ya | Ya | Ya | Medium | Shift, leave, resign, review, dsb |

## Yang Sudah Paling Matang

1. `Auth / Users`
2. `Projects`
3. `Quotations`
4. `Data Collections`

Ini paling dekat ke model “core business objects”.

## Yang Sudah Aman Untuk Demo dan Operasional Dasar

Hampir semua page utama sudah aman karena:

- backend-backed
- database-backed
- tidak lagi bergantung ke localStorage untuk master data bisnis

Jadi secara presentasi dan penggunaan dasar, sistem ini sudah jauh lebih benar daripada app frontend-local.

## Yang Masih Hybrid dan Perlu Dinaikkan Kalau Mau Enterprise-Grade

### Prioritas 1: Inventory / Warehouse

- `stock-items`
- `stock-movements`
- `stock-ins`
- `stock-outs`
- `stock-opnames`

### Prioritas 2: Production

- `work-orders`
- `production-reports`
- `production-trackers`
- `qc-inspections`
- `material-requests`

### Prioritas 3: Logistics / Correspondence

- `surat-jalan`
- `proof-of-delivery`
- `berita-acara`
- `spk-records`

### Prioritas 4: Finance Operational

- `customer-invoices`
- `vendor-expenses`
- `vendor-invoices`
- `working-expense-sheets`
- `peety-cash`
- `finance-bank-reconciliations`
- `kasbon`
- `archiveregistry`
- `auditlog`
- `fleethealth`

## Jawaban Singkat Untuk Orang Lain

`Mayoritas page utama sudah memakai backend dan database. Namun untuk banyak modul operasional, model datanya masih hybrid karena masih menyimpan payload JSON di database. Jadi sistem ini sudah backend-backed, tetapi belum semuanya sepenuhnya normalized seperti ERP enterprise penuh.`
