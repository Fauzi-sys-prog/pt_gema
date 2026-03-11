# FE -> BE -> DB Matrix

Last updated: 2026-03-07

Status legend:
- `OK`: FE page sudah konsumsi endpoint backend dan backend sudah punya tabel dedicated/utama.
- `PARTIAL`: jalan, tapi masih agregasi/alias/shared flow (belum modul CRUD terpisah penuh).
- `UI_ONLY`: halaman UI/guide, tidak butuh tabel dedicated.

| Module | FE Route | Page | Endpoint Backend | DB Table | Status | Notes |
|---|---|---|---|---|---|---|
| Guide Book | `/guide-book` | GuideHubPage | - | - | UI_ONLY | Konten panduan UI. |
| Dashboard | `/dashboard` | MainDashboard | `/dashboard/*` + agregasi `/data/*` | campuran `*Record`, `ProjectRecord`, `Quotation`, `DataCollection` | OK | Summary dari beberapa tabel. |
| Project | `/project` | ProjectManagementPage | `/projects`, `/quotations`, `/purchase-orders`, `/data/attendances`, `/data/employees`, `/data/stock-outs`, `/data/work-orders`, `/data/material-requests`, `/data/production-reports`, `/data/fleet-health` | `ProjectRecord`, `Quotation`, `PurchaseOrderRecord`, `AttendanceRecord`, `EmployeeRecord`, `StockOutRecord`, `WorkOrderRecord`, `MaterialRequestRecord`, `ProductionReportRecord`, `FleetHealthRecord` | OK | Relasi inti project aktif. |
| Production | `/produksi/dashboard` | ProductionDashboard | `/data/work-orders`, `/data/stock-items`, `/projects`, `/data/assets` | `WorkOrderRecord`, `StockItemRecord`, `ProjectRecord`, `AssetRecord` | OK | |
| Production | `/produksi/report` | ProductionReportPage | `/data/production-reports`, `/data/work-orders`, `/data/assets` | `ProductionReportRecord`, `WorkOrderRecord`, `AssetRecord` | OK | |
| Production | `/produksi/timeline` | ProductionTrackerPage | `/data/production-trackers`, `/data/assets` | `ProductionTrackerRecord`, `AssetRecord` | OK | |
| Production | `/produksi/qc` | QCInspectionPage | `/data/work-orders`, `/data/qc-inspections` | `WorkOrderRecord`, `QcInspectionRecord` | OK | |
| Supply Chain | `/purchasing/purchase-order` | PurchaseOrderPage | `/purchase-orders`, `/data/stock-items` | `PurchaseOrderRecord`, `StockItemRecord` | OK | |
| Supply Chain | `/purchasing/receiving` | ReceivingPage | `/purchase-orders`, `/projects`, `/receivings` | `PurchaseOrderRecord`, `ProjectRecord`, `ReceivingRecord` | OK | |
| Supply Chain | `/inventory/stock-in` | StockInPage | `/data/stock-ins`, `/data/stock-items` | `StockInRecord`, `StockItemRecord` | OK | |
| Supply Chain | `/inventory/stock-out` | StockOutPage | `/data/stock-outs`, `/data/stock-items`, `/data/stock-movements`, `/projects` | `StockOutRecord`, `StockItemRecord`, `StockMovementRecord`, `ProjectRecord` | OK | |
| Supply Chain | `/inventory/center` | InventoryCenter | `/data/stock-items`, `/data/stock-movements` | `StockItemRecord`, `StockMovementRecord` | OK | |
| Supply Chain | `/inventory/aging` | StockAgingPage | `/data/stock-items`, `/data/stock-movements` | `StockItemRecord`, `StockMovementRecord` | OK | FEFO logic di FE + data movement. |
| Commercial & Sales | `/sales/quotation` | QuotationPage | `/quotations`, `/quotations/sample` | `Quotation` | OK | |
| Commercial & Sales | `/sales/invoice` | InvoicePage | `/data/invoices` | `InvoiceRecord` | OK | |
| Commercial & Sales | `/sales/analytics` | SalesAnalyticsPage | `/data/invoices`, `/quotations` | `InvoiceRecord`, `Quotation` | PARTIAL | Analytics agregasi, bukan tabel analytics dedicated. |
| Finance & Ledger | `/finance/executive-dashboard` | ExecutiveDashboardPage | `/dashboard/*`, `/data/*` agregat | campuran tabel modul finance | PARTIAL | Agregasi dashboard lintas tabel. |
| Finance & Ledger | `/finance/approvals` | ApprovalCenterPage | approval endpoints + data resources | `Quotation`, `ProjectRecord`, `*Record` terkait approval | OK | |
| Finance & Ledger | `/finance/cashflow` | CashflowPage | endpoint finance/data | `InvoiceRecord`, `VendorInvoiceRecord`, `WorkingExpenseSheetRecord` (utama) | PARTIAL | Agregasi cashflow. |
| Finance & Ledger | `/finance/ledger` | GeneralLedgerPage | endpoint finance/data | `ArchiveRegistryRecord`, `AuditLogRecord`, finance records | PARTIAL | Ledger view agregasi. |
| Finance & Ledger | `/finance/ppn` | PPNPage | `/data/invoices`, `/data/vendor-invoices` | `InvoiceRecord`, `VendorInvoiceRecord` | OK | |
| Finance & Ledger | `/finance/accounts-payable` | AccountsPayablePage | vendor invoice/expense endpoints | `VendorInvoiceRecord`, `VendorExpenseRecord` | OK | |
| Finance & Ledger | `/finance/bank-reconciliation` | BankReconciliationPage | `/data/invoices`, `/data/vendor-invoices` (+ dedicated `/data/finance-bank-reconciliations`) | `InvoiceRecord`, `VendorInvoiceRecord`, `FinanceBankReconciliationRecord` | PARTIAL | Page masih agregasi invoice/vendor-invoice; tabel dedicated bank recon sudah tersedia. |
| Finance & Ledger | `/finance/petty-cash` | PettyCashPage | `/data/finance-petty-cash-transactions` | `FinancePettyCashTransactionRecord` | OK | Sudah dipindah dari `archive-registry` ke resource dedicated. |
| Finance & Ledger | `/finance/working-expense` | WorkingExpensePage | `/data/working-expense-sheets` | `WorkingExpenseSheetRecord` | OK | |
| Finance & Ledger | `/finance/vendor-payment` | VendorPaymentPage | vendor payment endpoints | `VendorInvoiceRecord`, `VendorExpenseRecord`, `FinancePoPaymentRecord` | OK | |
| Finance & Ledger | `/finance/accounts-receivable` | AccountsReceivablePage | customer invoice/payment endpoints | `CustomerInvoiceRecord`, `InvoiceRecord` | OK | |
| Finance & Ledger | `/finance/archive` | DigitalArchivePage | `/data/archive-registry` | `ArchiveRegistryRecord` | OK | |
| Correspondence | `/surat-menyurat/dashboard` | DashboardSurat | `/data/surat-masuk`, `/data/surat-keluar`, `/data/berita-acara`, `/surat-jalan` | `SuratMasukRecord`, `SuratKeluarRecord`, `BeritaAcaraRecord`, `SuratJalanRecord` | OK | Mixed endpoint style. |
| Correspondence | `/surat-menyurat/surat-masuk` | SuratMasukPage | `/data/surat-masuk` | `SuratMasukRecord` | OK | |
| Correspondence | `/surat-menyurat/surat-keluar` | SuratKeluarPage | `/data/surat-keluar` | `SuratKeluarRecord` | OK | |
| Correspondence | `/surat-menyurat/berita-acara` | BeritaAcaraPage | `/data/berita-acara`, `/surat-jalan` | `BeritaAcaraRecord`, `SuratJalanRecord` | OK | Mixed endpoint style. |
| Correspondence | `/surat-menyurat/surat-jalan` | SuratJalanPage | `/surat-jalan` | `SuratJalanRecord` | OK | |
| Correspondence | `/surat-menyurat/spk` | SuratPerintahKerjaPage | `/projects`, `/data/spk-records` | `ProjectRecord`, `SpkRecord` | OK | Relasi ke `WorkOrderRecord` opsional. |
| Logistics Control | `/logistics/hub` | LogisticsCommandCenter | `/data/surat-jalan`, `/projects`, `/data/assets`, `/data/audit-logs` | `SuratJalanRecord`, `ProjectRecord`, `AssetRecord`, `AuditLogRecord` | OK | |
| Logistics Control | `/logistics/delivery/:id` | DeliveryTrackingPage | `/data/surat-jalan`, `/data/proof-of-delivery` | `SuratJalanRecord`, `ProofOfDeliveryRecord` | OK | Konfirmasi delivery menyimpan POD record dedicated. |
| Assets | `/asset/equipment` | DaftarAsset | `/data/assets` | `AssetRecord` | OK | |
| Assets | `/asset/maintenance` | FleetMaintenancePage | `/data/assets`, `/data/maintenances` | `AssetRecord`, `MaintenanceRecord` | OK | |
| Assets | `/asset/rental-out` | RentalOutPage | `/data/assets` | `AssetRecord` | OK | |
| Assets | `/asset/internal-usage` | InternalUsagePage | `/data/assets`, `/data/employees`, `/projects` | `AssetRecord`, `EmployeeRecord`, `ProjectRecord` | OK | |
| Human Capital | `/hr/karyawan` | KaryawanPage | `/data/employees` | `EmployeeRecord` | OK | |
| Human Capital | `/hr/absensi` | AbsensiPage | `/data/attendances`, `/data/employees` | `AttendanceRecord`, `EmployeeRecord` | OK | |
| Human Capital | `/hr/field-record` | FieldProjectRecord | `/projects`, `/data/employees`, `/data/assets`, `/data/attendances`, `/data/kasbons`, `/data/material-requests`, `/data/fleet-health` | `ProjectRecord`, `EmployeeRecord`, `AssetRecord`, `AttendanceRecord`, `KasbonRecord`, `MaterialRequestRecord`, `FleetHealthRecord` | OK | |
| Human Capital | `/hr/attendance-recap` | AttendanceRecapPage | `/data/attendances`, `/data/employees` | `AttendanceRecord`, `EmployeeRecord` | OK | |
| Human Capital | `/hr/payroll` | PayrollPage | `/data/payrolls`, `/data/employees` | `PayrollRecord`, `EmployeeRecord` | OK | |
| Data Collection | `/data-collection` | DataCollection | `/data-collections` | `DataCollection` | OK | |
| Settings | `/settings/user-management` | UserManagementPage | `/users` | `User` | OK | |
| Settings | `/settings/audit-trail` | AuditTrailPage | `/data/audit-logs` | `AuditLogRecord` | OK | |
| Settings | `/settings/master` | AppSettingsPage | `/data/app-settings` | `AppSettingRecord` | OK | Baru ditambahkan. |

## Verification Snapshot (Live Backend)

- Date: 2026-03-07
- Container health: `backend`, `frontend`, `postgres`, `prisma-studio` running
- Smoke relation test: `PASS` (end-to-end create/read/update + FK validation)
  - Run: `docker compose exec backend node dist/smokeModuleRelations.js`
  - Result: all checks `PASS`, termasuk resource baru:
    - `/data/kasbons`
    - `/data/fleet-health`
    - `/data/proof-of-delivery`
    - `/data/spk-records`
    - `/data/finance-bank-reconciliations`
    - `/data/finance-petty-cash-transactions`
    - `/data/app-settings`
- Coverage endpoint (`/system/coverage`) after `seed:coverage-pack`: `100%` (`47/47` resources terisi).

## Notes teknis yang perlu dirapikan

1. Endpoint style masih campur antara `/<resource>` dan `/data/<resource>` untuk resource yang sama (contoh Surat Jalan). Disarankan distandardisasi.
2. Beberapa halaman analytics/dashboard adalah agregasi lintas tabel (ini normal), jadi tidak perlu tabel baru kecuali mau performa snapshot/materialized view.
3. Proof of Delivery sudah tersambung ke tabel dedicated; jika ingin, bisa dipisah jadi halaman monitoring POD terpisah untuk operasional.
4. Finance cleanup: route canonical AR adalah `/finance/accounts-receivable`.
5. Untuk validasi penuh "siap UAT", jalankan smoke juga setelah seed data realistis per modul (bukan hanya data minimal smoke).
