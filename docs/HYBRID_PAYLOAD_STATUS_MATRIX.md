# Hybrid / Payload Status Matrix

Tanggal cek: 2026-03-11

## Kesimpulan Singkat
- Data bisnis utama sudah jalan di backend/database, bukan localStorage frontend.
- Tetapi sistem **belum full database-first tanpa hybrid**.
- Hybrid masih ada di 3 layer:
  1. **DB layer**: masih ada banyak tabel lama `*Record` dengan `payload Json`.
  2. **Backend API layer**: beberapa resource yang sudah relational tetap dibungkus ke shape legacy `entityId + payload`.
  3. **Frontend contract layer**: banyak page masih pakai generic `/data/:resource` dan body `{ entityId, payload }`.

## Legend
- `DB Source`
  - `Dedicated Relational`: route/domain + model inti khusus
  - `Relational Live`: sudah baca/tulis ke tabel relational baru
  - `Payload Record`: masih bertumpu pada tabel `*Record.payload Json`
- `API Contract`
  - `Dedicated`: FE/BE pakai route/domain khusus, bukan payload generic
  - `Legacy Payload Compat`: DB sudah relational, tapi response/request masih shape payload lama
  - `Payload Native`: FE/BE masih native payload generic
- `FK`
  - `Strong`: FK inti sudah nyata di schema
  - `Partial`: core FK ada, tapi masih ada compat/JSON sisa
  - `Weak`: relasi masih longgar atau implicit via payload

## A. Paling Matang

| Modul / Menu | FE Endpoint | BE Route | DB Source | API Contract | FK | Status |
|---|---|---|---|---|---|---|
| Auth / Users | `/auth/*`, `/users` | `auth.ts`, `users.ts` | Dedicated Relational | Dedicated | Strong | Full backend |
| Projects | `/projects` | `projects.ts` | Dedicated Relational | Dedicated | Strong | Full backend |
| Quotations | `/quotations` | `quotations.ts` | Dedicated Relational | Dedicated | Strong | Full backend |
| Data Collections | `/data-collections` | `dataCollections.ts` | Dedicated Relational | Dedicated | Strong | Full backend |
| Inventory | `/inventory/items`, `/inventory/stock-ins`, `/inventory/stock-outs`, `/inventory/movements`, `/inventory/stock-opnames` | `inventory.ts` | Dedicated Relational | Dedicated | Partial | Backend-first |
| Procurement | `/purchase-orders`, `/receivings` | `procurement.ts` | Dedicated Relational | Dedicated | Strong | Full backend |
| Finance Ops | `/finance/customer-invoices`, `/finance/vendor-expenses`, `/finance/vendor-invoices` | `financeOps.ts` | Dedicated Relational | Dedicated | Strong | Full backend |
| Finance Misc | `/finance/working-expense-sheets`, `/finance/petty-cash-transactions`, `/finance/bank-reconciliations` | `financeMisc.ts` | Dedicated Relational | Dedicated | Partial | Backend-first |
| HR Finance | `/hr/kasbons` | `financeMisc.ts` | Dedicated Relational | Dedicated | Partial | Backend-first |
| Fleet | `/fleet-health` | `data.ts` | Dedicated Relational | Dedicated | Strong | Backend-first |
| Admin | `/audit-logs` | `data.ts` | Dedicated Relational | Dedicated | Partial | Backend-first |
| Admin | `/archive-registry` | `data.ts` | Dedicated Relational | Dedicated | Weak | Backend-first |
| Master | `/vendors` | `data.ts` | Dedicated Relational | Dedicated | Strong | Backend-first |
| Master | `/customers` | `data.ts` | Dedicated Relational | Dedicated | Strong | Backend-first |

## B. Sudah Relational Live, Tapi Masih Hybrid di Contract

| Modul / Menu | Resource | FE | BE | DB Source | API Contract | FK | Status |
|---|---|---|---|---|---|---|---|
| Production | `work-orders` | `/data/work-orders` | `data.ts` | Relational Live (`ProductionWorkOrder`) | Legacy Payload Compat | Partial | Hybrid compat |
| Production | `material-requests` | `/data/material-requests` | `data.ts` | Relational Live (`ProductionMaterialRequest`) | Legacy Payload Compat | Partial | Hybrid compat |
| Production | `production-reports` | `/data/production-reports` | `data.ts` | Relational Live (`ProductionExecutionReport`) | Legacy Payload Compat | Partial | Hybrid compat |
| Production | `production-trackers` | `/data/production-trackers` | `data.ts` | Relational Live (`ProductionTrackerEntry`) | Legacy Payload Compat | Partial | Hybrid compat |
| Production | `qc-inspections` | `/data/qc-inspections` | `data.ts` | Relational Live (`ProductionQcInspection`) | Legacy Payload Compat | Partial | Hybrid compat |
| Logistics | `surat-jalan` | `/data/surat-jalan` | `data.ts` | Relational Live (`LogisticsSuratJalan`) | Legacy Payload Compat | Partial | Hybrid compat |
| Logistics | `proof-of-delivery` | `/data/proof-of-delivery` | `data.ts` | Relational Live (`LogisticsProofOfDelivery`) | Legacy Payload Compat | Partial | Hybrid compat |
| Project Docs | `berita-acara` | `/data/berita-acara` | `data.ts` | Relational Live (`ProjectBeritaAcara`) | Legacy Payload Compat | Partial | Hybrid compat |
| Project Docs | `spk-records` | `/data/spk-records` | `data.ts` | Relational Live (`ProjectSpkRecord`) | Legacy Payload Compat | Partial | Hybrid compat |

## C. Masih Payload Native / Belum Dipindah

| Modul / Menu | Resource | FE | BE | DB Source | API Contract | FK | Status |
|---|---|---|---|---|---|---|---|
| HR | `employees` | `/employees` | `hr.ts` | Dedicated Relational | Dedicated | Strong | Full backend |
| HR | `attendances` | `/attendances` | `hr.ts` | Dedicated Relational | Dedicated | Strong | Full backend |
| HR | `hr-leaves` | `/hr-leaves` | `data.ts` | Dedicated Relational | Dedicated | Weak | Backend-first |
| HR | `hr-online-status` | `/hr-online-status` | `data.ts` | Dedicated Relational | Dedicated | Weak | Backend-first |
| Correspondence | `surat-masuk` | `/surat-masuk` | `data.ts` | Dedicated Relational | Dedicated | Partial | Backend-first |
| Correspondence | `surat-keluar` | `/surat-keluar` | `data.ts` | Dedicated Relational | Dedicated | Partial | Backend-first |
| Correspondence | `template-surat` | `/template-surat` | `data.ts` | Dedicated Relational | Dedicated | Partial | Backend-first |
| Assets | `assets` | `/assets` | `data.ts` | Dedicated Relational | Dedicated | Partial | Backend-first |
| Assets | `maintenances` | `/maintenances` | `data.ts` | Dedicated Relational | Dedicated | Strong | Backend-first |
| Finance | `payrolls` | `/payrolls` | `data.ts` | Dedicated Relational | Dedicated | Partial | Backend-first |
| Misc | `invoices` | `/invoices` | `data.ts` | Dedicated Relational | Dedicated | Partial | Backend-first |
| Settings | `app-settings` | `/app-settings` | `data.ts` | Dedicated Relational | Dedicated | Partial | Backend-first |

## D. JSON Sisa yang Masih Ada di Model Baru

Walau beberapa domain sudah relational live, masih ada field JSON sisa di schema baru:

| Domain | Model | Field JSON Sisa | Catatan |
|---|---|---|---|
| Inventory | `InventoryItem` / related | `metadata`, `legacyPayload` | masih ada untuk compat / info tambahan |
| Production | beberapa model baru | `legacyPayload` | masih ada untuk compat |
| Production QC | `ProductionQcInspection` | `dimensions` | masih Json |

## E. Makna Praktis
- **Kalau pertanyaannya**: “apakah data bisnis utama sudah di database?” -> **iya**
- **Kalau pertanyaannya**: “apakah sudah full relational tanpa hybrid?” -> **belum**
- **Kalau pertanyaannya**: “apa yang paling hybrid sekarang?” -> **resource di section C**
- **Kalau pertanyaannya**: “apa yang relational tapi masih belum bersih?” -> **resource di section B**

## F. Prioritas Pembersihan Berikutnya
1. Hapus `Legacy Payload Compat` untuk resource di section B
2. Migrasikan resource di section C paling kritis:
3. Setelah itu baru HR/master data:
   - `employees`
   - `attendances`
