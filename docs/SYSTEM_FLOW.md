# GM Teknik ERP System Flow (V1)

Dokumen ini jadi patokan alur sistem supaya tim tidak bingung antara Quotation, Project, dan Approval.

## 1) Page Map (Terdaftar di App Router)

### Core
- `/dashboard`
- `/guide-book`
- `/data-collection`
- `/settings/user-management`
- `/settings/audit-trail`

### Project & Sales
- `/project`
- `/sales/quotation`
- `/sales/quotation-hub`
- `/sales/penawaran`
- `/sales/penawaran/:id`
- `/sales/rab`
- `/sales/invoice`
- `/sales/auto-invoice`
- `/sales/analytics`

### Purchasing
- `/purchasing/procurement-hub`
- `/purchasing/purchase-order`
- `/purchasing/receiving`
- `/purchasing/vendor-analysis`

### Production
- `/produksi/dashboard`
- `/produksi/report`
- `/produksi/timeline`
- `/produksi/bom-verification/:id`
- `/produksi/guide`
- `/produksi/qc`

### Inventory
- `/inventory/center`
- `/inventory/stock-card/:id`
- `/inventory/stock-journal`
- `/inventory/stock-in`
- `/inventory/stock-out`
- `/inventory/traceability`
- `/inventory/stock-report`
- `/inventory/aging`
- `/inventory/opname`

### Asset & Logistics
- `/asset/equipment`
- `/asset/rental-out`
- `/asset/internal-usage`
- `/asset/maintenance`
- `/logistics/hub`
- `/logistics/delivery/:id`

### HR
- `/hr/karyawan`
- `/hr/absensi`
- `/hr/field-record`
- `/hr/attendance-recap`
- `/hr/cuti`
- `/hr/payroll`

### Finance
- `/finance/executive-dashboard`
- `/finance/approvals` (Approval Hub)
- `/finance/cashflow-command`
- `/finance/cashflow`
- `/finance/piutang`
- `/finance/accounts-receivable`
- `/finance/accounts-payable`
- `/finance/project-analysis`
- `/finance/ledger`
- `/finance/ppn`
- `/finance/bank-reconciliation`
- `/finance/petty-cash`
- `/finance/working-expense`
- `/finance/vendor-payment`
- `/finance/payments`
- `/finance/invoicing`
- `/finance/archive`
- `/finance/year-end`

### Correspondence
- `/surat-menyurat/dashboard`
- `/surat-menyurat/surat-masuk`
- `/surat-menyurat/surat-keluar`
- `/surat-menyurat/berita-acara`
- `/surat-menyurat/surat-jalan`
- `/surat-menyurat/spk`

## 2) Alur Bisnis Utama (End-to-End)

1. Input data awal di `Data Collection`.
2. Sales buat penawaran di `Quotation` (`/sales/quotation`).
3. Approval quotation dilakukan oleh owner/otoritas.
4. Quotation approved menghasilkan/menjadi acuan `Project` (`/project`).
5. Eksekusi project berjalan dengan support:
- Production
- Purchasing
- Inventory
- Logistics
- Correspondence
6. Finansial berjalan paralel:
- Invoicing, AR/AP, Cashflow, Ledger, Tax
7. Tutup periode di `Year End`.

## 3) Approval System (Single Source of Truth)

Approval operasional dipusatkan di:
- `/finance/approvals` (Approval Hub PO/Quotation/Invoice/MR)

Aturan:
1. Semua aksi approve/reject utama masuk lewat Approval Hub atau endpoint approval resmi.
2. Halaman modul lain boleh tampilkan status approval, tapi tidak boleh melanggar state machine.
3. Tombol aksi yang tidak valid harus disabled, bukan menunggu error setelah klik.

## 4) State Rules Inti

### Quotation
1. `Draft -> Sent -> Approved/Rejected`
2. Quotation yang sudah dipakai project approved harus dianggap lock untuk perubahan kritikal.

### Project Approval
1. Prasyarat approve project: quotation terkait harus `Approved`.
2. Alur: `Pending -> Approved`
3. Revisi alur: `Approved -> Unlock -> Pending -> Relock -> Approved`
4. Jika `Rejected`, harus ada reason.

### PO / Invoice / Material Request
1. Status tidak boleh loncat tanpa approval yang sesuai role.
2. Semua perubahan approval harus tercatat di log/audit.

## 5) Jalur Operasional Harian (Simple)

1. Sales:
- Kerja utama: `/sales/quotation`, `/sales/invoice`, `/sales/analytics`
2. Owner/Manager:
- Kerja utama: `/finance/approvals`, `/project`, `/finance/executive-dashboard`
3. Purchasing/Warehouse:
- Kerja utama: `/purchasing/*`, `/inventory/*`
4. Finance:
- Kerja utama: `/finance/*`
5. Production:
- Kerja utama: `/produksi/*`
6. HR:
- Kerja utama: `/hr/*`

## 6) Prinsip UI Supaya Tidak Bingung

1. Selalu pisahkan label:
- `Quotation Status`
- `Project Approval Status`
- `Project Execution Status`
2. Jangan campur istilah status dalam satu badge.
3. Sediakan tombol cepat antar halaman terkait:
- Quotation -> Approval Hub -> Project

---
Dokumen ini baseline V1. Jika mau, next step adalah V2 berupa diagram swimlane per role + SLA approval per dokumen.
