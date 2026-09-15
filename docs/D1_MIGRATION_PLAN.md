# Rencana Migrasi D1 — `double precision` → `numeric`

Status: **rencana** (belum dijalankan di produksi). Stage 0.5 sedang dikerjakan.

## Latar belakang
Semua nilai uang di schema disimpan sebagai `Float` (PostgreSQL `double precision`),
bukan `numeric`/`Decimal`. Ini menyebabkan rounding drift pada AR/AP/payroll/PPN.

Hasil recon:
- **142 field `Float`, 0 `Decimal`** di `schema.prisma` (~40 model).
- Finance ≈ 50 kolom money; sisanya non-finance (inventory/produksi/quotation).
- **154 titik `res.json(...)`**, **846 pemakaian `Number(`/`readNumber`/`toFiniteNumber`**.
- **0 pemakaian `Prisma.Decimal`** saat ini.

## Prinsip
1. Pisahkan **money** (`numeric(18,2)`) dari **rasio/qty** (`qty` → `numeric(18,4)`,
   `adminFeePercent` → `numeric(9,4)`).
2. Kontrak API tetap: JSON mengembalikan `number`, bukan string.
3. Bertahap per domain (finance dulu); setiap stage dapat diverifikasi & di-rollback.
4. Migrasi dijalankan pada maintenance window (ALTER TYPE mengunci tabel).

## Bahaya utama (hasil Stage 0)
1. **Helper menolak Decimal.** `toFiniteNumber`/`readNumber` hanya menerima
   `number`/`string`; `Prisma.Decimal` adalah objek → diam-diam jadi `0`/`null`.
   Tersebar (846 pemakaian). **Wajib diperbaiki sebelum migrasi kolom (Stage 0.5).**
2. **Aritmetika langsung pada hasil Prisma:**
   - `services/financePaymentService.ts:54,75,102,123`
   - `routes/koperasi.ts:85,264,366`
   - `routes/financeMisc.ts:240-246` (bank recon: aritmetika `balance` **dan**
     perbandingan ketat `row.balance !== runningBalance`)
   - `routes/operations.ts:2073` (non-finance)
3. Risiko kebocoran Decimal ke JSON **rendah** (tidak ada `res.json(prismaRow)`
   mentah di finance).

## Stage
### Stage 0 — Deteksi (selesai)
Daftar titik bahaya di atas.

### Stage 0.5 — Tooling hardening (tanpa ubah skema)
- `backend/src/utils/decimal.ts`: `isDecimalLike`, `coerceNumber`, `toNumber`.
- Tambah cabang Decimal pada helper: `toFiniteNumber` (dataPayloadUtils, financeOps,
  financeMisc, procurement, inventory) dan `readNumber` (dashboardRouteSupport,
  quotations, projects).
- Tanpa import baru di tiap file; hanya cabang duck-typing.
- Aman dideploy sendiri (perilaku lama tidak berubah untuk number/string).

### Stage 1 — Invoice (pilot)
Kolom: `FinanceCustomerInvoice` (subtotal, ppn, pph, totalAmount, paidAmount,
outstandingAmount), `FinanceCustomerInvoiceItem` (qty, unitPrice, amount),
`FinanceCustomerInvoicePayment.nominal`, `FinanceVendorInvoice` (4),
`FinanceVendorInvoicePayment.nominal`, `FinanceVendorExpense`
(nominal, ppn, totalNominal).
1. `schema.prisma`: `Float` → `Decimal @db.Decimal(18,2)` (qty `@db.Decimal(18,4)`).
2. `npx prisma migrate dev --create-only --name finance_invoice_decimal`;
   review SQL → pastikan `USING round(col::numeric,2)` (Prisma default
   `DECIMAL(65,30)` harus dirapikan).
3. Konversi di mapper + `financePaymentService.ts:54,75,102,123`.
4. Contract test (snapshot GET sebelum/sesudah) + smoke.

### Stage 2 — Bank reconciliation
`debit, credit, balance`; perbaiki aritmetika & perbandingan `balance` di
`financeMisc.ts:240-246`.

### Stage 3 — Petty cash / kasbon / working expense
`FinancePettyCashTransaction.amount`, `HrKasbon.amount`,
`FinanceWorkingExpenseSheet.totalKas`, `FinanceWorkingExpenseItem.nominal`.

### Stage 4 — Payroll
`PayrollRecord`: totalPayroll, baseSalary, totalOutput, incentiveTotal,
allowanceTotal, totalGaji.

### Stage 5 — Koperasi
`KoperasiPinjaman` (amount, adminFeePercent, adminFeeAmount, totalAmount,
installmentAmount), `KoperasiSimpanan.amount`, `KoperasiMember.simpanan*`,
`KoperasiCashTransaction.amount`; benahi `koperasi.ts:85,264,366`.

### Stage 6 — Non-finance
Inventory/produksi/quotation/qty (~95 field), termasuk `operations.ts:2073`.

## Verifikasi per stage
- `npm run build` (tsc) lolos; `prisma migrate status` bersih.
- Contract test: tipe JSON `number`, nilai identik sampai 2 desimal.
- Rekonsiliasi: `sum(paidAmount) == sum(payments.nominal)`.
- Constraint D2/D3 (unique nomor + check) tetap ada; `_prisma_migrations` tercatat.

## Rollback
- Snapshot tabel terkait (`pg_dump`) sebelum tiap stage.
- Revert kode + `ALTER COLUMN ... TYPE double precision USING col::double precision`,
  atau restore snapshot.

## Estimasi
- Stage 0.5: 0.5 hari. Stage 1: 1–2 hari. Stage 2–5: ±1 hari masing-masing.
- Stage 6: proyek terpisah.
