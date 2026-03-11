# DB-First Refactor Roadmap

Target dokumen ini:

- mengubah sistem dari `hybrid payload JSON` menjadi `database-first`
- tetap menjaga flow demo dan flow operasional yang sudah jalan
- menghindari refactor brutal yang mematahkan frontend, export, dan seed

## Prinsip Utama

1. **Core fields pindah ke kolom relational**
2. **Payload JSON hanya untuk metadata tambahan**
3. **Route generic `/data/:resource` dikurangi bertahap**
4. **Frontend diarahkan ke typed API per domain**
5. **Refactor dilakukan per domain, bukan semua sekaligus**

## Target Arsitektur

Model akhir yang diinginkan:

- `core business entity` = tabel relasional jelas
- `child rows` = tabel detail jelas
- `payload JSON` = opsional untuk fleksibilitas, bukan source of truth utama

Contoh:

### Sekarang

- `StockOutRecord`
  - `id`
  - `projectId`
  - `workOrderId`
  - `payload`

### Target

- `StockOut`
  - `id`
  - `projectId`
  - `workOrderId`
  - `noStockOut`
  - `tanggal`
  - `status`
  - `penerima`
  - `createdBy`
- `StockOutItem`
  - `id`
  - `stockOutId`
  - `stockItemId`
  - `kode`
  - `nama`
  - `qty`
  - `satuan`

## Urutan Refactor Yang Disarankan

### Phase 1: Inventory / Warehouse

Mulai dari sini karena paling sensitif dan paling mudah terasa manfaatnya.

#### Modul

- `stock-items`
- `stock-movements`
- `stock-ins`
- `stock-outs`
- `stock-opnames`

#### Kenapa dimulai dari sini

- integritas stok paling penting
- query audit paling sering dibutuhkan
- paling rawan rusak kalau tetap longgar
- jadi fondasi untuk production dan finance

#### Target schema

- `StockItem`
- `StockIn`
- `StockInItem`
- `StockOut`
- `StockOutItem`
- `StockMovement`
- `StockOpname`
- `StockOpnameItem`

#### Hasil setelah phase ini

- stok bisa dihitung dari data relasional
- stock card lebih akurat
- stock opname lebih audit-friendly
- warehouse report lebih kuat

### Phase 2: Production

#### Modul

- `work-orders`
- `production-reports`
- `production-trackers`
- `qc-inspections`
- `material-requests`

#### Target schema

- `WorkOrder`
- `WorkOrderItem` atau `WorkOrderBomItem`
- `MaterialRequest`
- `MaterialRequestItem`
- `ProductionReport`
- `ProductionReportItem`
- `ProductionTracker`
- `QcInspection`
- `QcInspectionItem`

#### Hasil

- WO, MR, report, QC benar-benar punya relasi kuat
- lebih enak join ke project, stock, dan schedule

### Phase 3: Finance Operational

#### Modul

- `customer-invoices`
- `vendor-expenses`
- `vendor-invoices`
- `finance-bank-reconciliations`
- `working-expense-sheets`

#### Target schema

- `CustomerInvoice`
- `CustomerInvoiceItem`
- `CustomerPayment`
- `VendorExpense`
- `VendorExpenseItem`
- `VendorInvoice`
- `BankReconciliation`
- `BankReconciliationLine`
- `WorkingExpenseSheet`
- `WorkingExpenseItem`

#### Hasil

- laporan finance lebih bisa diaudit
- AR/AP lebih kuat
- export finance lebih stabil

### Phase 4: Logistics / Correspondence

#### Modul

- `surat-jalan`
- `proof-of-delivery`
- `berita-acara`
- `spk-records`
- `surat-masuk`
- `surat-keluar`

#### Target schema

- `SuratJalan`
- `SuratJalanItem`
- `ProofOfDelivery`
- `ProofOfDeliveryItem`
- `BeritaAcara`
- `Spk`
- `SuratMasuk`
- `SuratKeluar`

#### Hasil

- dokumen operasional lebih rapi
- relasi ke project/work order/invoice lebih jelas

## Strategi Implementasi

### Langkah 1

Buat schema baru tanpa langsung menghapus schema lama.

### Langkah 2

Tambahkan adapter di backend:

- baca dari schema baru jika ada
- fallback ke `payload JSON` lama kalau belum dimigrasikan

### Langkah 3

Migrasi data lama ke schema baru dengan script backfill.

### Langkah 4

Arahkan frontend domain per domain ke route baru yang typed.

### Langkah 5

Setelah stabil:

- stop write ke schema lama
- read only dari schema baru
- baru hapus dependensi lama

## Strategi Aman Supaya Tidak Mematahkan Sistem

1. jangan hapus `payload` lama di awal
2. jangan ubah semua export sekaligus
3. buat 1 domain selesai penuh, baru pindah domain berikutnya
4. pertahankan sample `BW Water` sebagai regression chain
5. setelah tiap phase:
   - test API
   - test export
   - test sidebar role
   - test chain BW Water

## Modul Pertama Yang Saya Sarankan Dikerjakan

### Inventory

Mulai dari:

1. `StockItem`
2. `StockIn + StockInItem`
3. `StockOut + StockOutItem`
4. `StockMovement`
5. `StockOpname + StockOpnameItem`

### Kenapa ini paling aman

- impact bisnis tinggi
- domain cukup jelas
- tidak terlalu banyak dokumen administratif
- jadi fondasi untuk modul lain

## Output Yang Seharusnya Dicapai Setelah Inventory Beres

- `Monitoring Gudang` baca tabel relasional
- `Stock In/Out` tidak lagi bergantung ke payload penuh
- `Stock Card Detail` bisa pakai join normal
- `Stock Opname` bisa dihitung dan diadjust dengan jelas
- `Traceability` lebih kuat

## Definisi Selesai

Satu phase dianggap selesai kalau:

1. create/update/read tidak lagi tergantung payload lama
2. BW Water chain tetap hidup
3. export tetap jalan
4. query audit lebih mudah dari SQL biasa
5. tidak ada data penting yang cuma hidup di JSON

## Saran Praktis

Kalau mau langsung bergerak:

1. mulai dari `Inventory`
2. bikin schema relasional baru
3. bikin backfill script
4. pindahkan `Monitoring Gudang`, `Stock In`, `Stock Out`, `Stock Card`, `Stock Opname`
5. baru lanjut ke `Production`

## Kesimpulan

Target yang benar bukan:

- `hapus semua hybrid hari ini`

Target yang benar adalah:

- `core data jadi relational dulu`
- `payload JSON jadi sekunder`
- `refactor bertahap tapi irreversible ke arah database-first`
