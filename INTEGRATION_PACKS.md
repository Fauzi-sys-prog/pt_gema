# Paket Penyambungan FE ↔ BE PT Gema

Dokumen ini adalah urutan aman untuk menyambungkan halaman yang masih memakai cache/state lokal ke PostgreSQL. Jangan mengganti UI/sidebar yang sudah ada.

## Cara pakai

1. Kerjakan satu paket sampai build FE dan BE lulus.
2. Setiap mutasi data harus memakai `api.ts`, lalu refresh state di `AppContext.tsx`.
3. Halaman laporan hanya membaca endpoint ringkasan; tidak membuat tabel/entry manual sendiri.
4. Jalankan verifikasi setelah tiap paket:

```bash
cd frontend && npm run build
cd ../backend && npx tsc --noEmit
```

## Paket 1 — Dashboard dan ringkasan data

**Frontend**

- `frontend/src/app/pages/dashboard/MainDashboard.tsx`
- `frontend/src/app/pages/finance/ExecutiveDashboardPage.tsx`
- `frontend/src/app/pages/finance/CashFlowCommandCenter.tsx`
- `frontend/src/app/pages/finance/ProjectProfitLossPage.tsx`
- `frontend/src/app/services/dashboardService.ts` (baru)

**Backend**

- `backend/src/routes/dashboard.ts`
- `backend/src/routes/dashboardFinanceSummarySupport.ts`

Endpoint target:

- `GET /dashboard/summary`
- `GET /dashboard/finance-summary`
- `GET /dashboard/project-profit-loss`
- `GET /dashboard/cash-flow`

Sumber angka: quotation approved, project, invoice/AR, pembayaran AR, AP, pembayaran vendor, payroll, THL, stock-out, tambahan biaya proyek.

## Paket 2 — Inventory reporting

**Frontend**

- `frontend/src/app/pages/inventory/StockOpnamePage.tsx`
- `frontend/src/app/pages/inventory/TraceabilityPage.tsx`
- `frontend/src/app/pages/inventory/StockAgingPage.tsx`
- `frontend/src/app/pages/inventory/WarehouseLedgerPage.tsx`
- `frontend/src/app/pages/inventory/StockReportPage.tsx`
- `frontend/src/app/pages/inventory/StockCardDetailPage.tsx`
- `frontend/src/app/pages/inventory/StockJournalPage.tsx`

**Backend**

- `backend/src/routes/inventory.ts`
- `backend/prisma/schema.prisma` (hanya jika field opname belum cukup)

Endpoint target:

- `GET /inventory/reports/stock`
- `GET /inventory/reports/ledger`
- `GET /inventory/reports/aging`
- `GET /inventory/reports/traceability`
- `GET /inventory/opnames`
- `POST /inventory/opnames`

Tidak ada input manual di halaman report; semua dari Stock In, Stock Out, QC, dan Stock Opname.

## Paket 3 — Asset dan maintenance

**Frontend**

- `frontend/src/app/pages/asset/DaftarAsset.tsx`
- `frontend/src/app/pages/asset/FleetMaintenancePage.tsx`
- `frontend/src/app/pages/asset/InternalUsagePage.tsx`
- `frontend/src/app/pages/asset/RentalOutPage.tsx`

**Backend**

- `backend/src/routes/assets.ts` (baru)
- `backend/src/app.ts` (daftarkan router)
- `backend/prisma/schema.prisma` (`AssetRecord`, `MaintenanceRecord` sudah tersedia)

Endpoint target:

- `GET|POST|PATCH|DELETE /assets`
- `GET|POST|PATCH /assets/:assetId/maintenance`
- `GET|POST|PATCH /assets/usages`
- `GET|POST|PATCH /assets/rentals`

## Paket 4 — Produksi dan QC dashboard

**Frontend**

- `frontend/src/app/pages/production/Tracker.tsx`
- `frontend/src/app/pages/production/ProductionTimelinePage.tsx`
- `frontend/src/app/pages/production/DailyReport.tsx`
- `frontend/src/app/pages/production/ProductionDashboard.tsx`
- `frontend/src/app/pages/production/ProductionGuidePage.tsx`

**Backend**

- `backend/src/routes/operations.ts`
- `backend/src/routes/dashboardOperationalSupport.ts`

Endpoint target:

- `GET /operations/production-tracker`
- `GET /operations/production-timeline`
- `GET /operations/daily-reports`
- `GET /operations/production-summary`

QC wajib membaca kategori master dari gudang; hasil QC accepted dapat menjadi stock-in barang jadi.

## Paket 5 — Finance laporan turunan

**Frontend**

- `frontend/src/app/pages/finance/AgingARPage.tsx`
- `frontend/src/app/pages/finance/PPNPage.tsx`
- `frontend/src/app/pages/finance/CashflowPage.tsx`
- `frontend/src/app/pages/finance/GeneralLedgerPage.tsx`
- `frontend/src/app/pages/finance/BankReconciliationPage.tsx`

**Backend**

- `backend/src/routes/financeOps.ts`
- `backend/src/routes/financeMisc.ts`
- `backend/src/routes/dashboardFinanceAnalytics.ts`

Endpoint target:

- `GET /finance/reports/aging-ar`
- `GET /finance/reports/ppn`
- `GET /finance/reports/cashflow`
- `GET /finance/reports/general-ledger`
- `GET /finance/bank-reconciliations`

General ledger tidak boleh punya form input manual. Semua jurnal berasal dari transaksi AR/AP/payroll/THL/petty cash/tambahan biaya dan bank sumber.

## Paket 6 — Notifikasi dan audit

**Frontend**

- `frontend/src/app/services/notificationService.ts`
- komponen bell/notifikasi di layout utama
- `frontend/src/app/pages/settings/AuditTrailPage.tsx`

**Backend**

- `backend/src/routes/notifications.ts`
- `backend/src/routes/dataAuditMappers.ts`

Event minimal: quotation approval, PO approval/revisi, stock rendah, QC reject, invoice jatuh tempo, pembayaran AR/AP, payroll approve/disburse, surat jalan/BAP selesai.

## Paket 7 — Bersih-bersih final

- Hapus sisa `MaterialRequest` dari `AppContext.tsx`, schema, route, dan komponen yang sudah tidak aktif.
- Hilangkan fallback localStorage untuk modul yang endpoint-nya sudah final.
- Setelah login, jalankan refresh API agar state lama tidak tampil.
- Uji seluruh alur dari quotation sampai project, invoice, pembayaran, dan laporan.

