# Inventory DB-First Schema Plan

Dokumen ini memecah refactor inventory dari model `payload JSON` menjadi model relational yang bisa diimplementasikan bertahap.

## Scope

Modul yang dicakup:

- `stock-items`
- `stock-ins`
- `stock-outs`
- `stock-movements`
- `stock-opnames`

## Target Model

### 1. InventoryItem

Tujuan:

- menggantikan `StockItemRecord.payload` sebagai source of truth master barang

Field inti:

- `id String @id`
- `code String @unique`
- `name String`
- `category String`
- `unit String`
- `location String`
- `minStock Float @default(0)`
- `onHandQty Float @default(0)`
- `reservedQty Float @default(0)`
- `onOrderQty Float @default(0)`
- `unitPrice Decimal?`
- `supplierName String?`
- `status String?`
- `lastStockUpdateAt DateTime?`
- `metadata Json?`
- `createdAt DateTime`
- `updatedAt DateTime`

Relasi:

- `stockInItems`
- `stockOutItems`
- `stockMovementItems`
- `stockOpnameItems`

### 2. InventoryStockIn

Tujuan:

- header transaksi barang masuk

Field inti:

- `id String @id`
- `number String @unique`
- `tanggal DateTime`
- `type String`
- `status String`
- `supplierName String?`
- `suratJalanNumber String?`
- `notes String?`
- `createdByName String?`
- `poId String?`
- `projectId String?`
- `legacyPayload Json?`
- `createdAt DateTime`
- `updatedAt DateTime`

Relasi:

- `po -> PurchaseOrderRecord?`
- `project -> ProjectRecord?`
- `items -> InventoryStockInItem[]`

### 3. InventoryStockInItem

Field inti:

- `id String @id`
- `stockInId String`
- `inventoryItemId String?`
- `itemCode String`
- `itemName String`
- `qty Decimal`
- `unit String`
- `batchNo String?`
- `expiryDate DateTime?`
- `notes String?`

Relasi:

- `stockIn`
- `inventoryItem`

### 4. InventoryStockOut

Tujuan:

- header transaksi barang keluar

Field inti:

- `id String @id`
- `number String @unique`
- `tanggal DateTime`
- `type String`
- `status String`
- `recipientName String?`
- `notes String?`
- `createdByName String?`
- `projectId String?`
- `workOrderId String?`
- `productionReportId String?`
- `legacyPayload Json?`
- `createdAt DateTime`
- `updatedAt DateTime`

Relasi:

- `project -> ProjectRecord?`
- `workOrder -> WorkOrderRecord?`
- `items -> InventoryStockOutItem[]`

### 5. InventoryStockOutItem

Field inti:

- `id String @id`
- `stockOutId String`
- `inventoryItemId String?`
- `itemCode String`
- `itemName String`
- `qty Decimal`
- `unit String`
- `batchNo String?`
- `notes String?`

Relasi:

- `stockOut`
- `inventoryItem`

### 6. InventoryStockMovement

Tujuan:

- ledger stok yang bisa diaudit

Field inti:

- `id String @id`
- `tanggal DateTime`
- `direction String`
- `referenceNo String`
- `referenceType String`
- `inventoryItemId String?`
- `itemCode String`
- `itemName String`
- `qty Decimal`
- `unit String`
- `location String`
- `stockBefore Decimal`
- `stockAfter Decimal`
- `batchNo String?`
- `expiryDate DateTime?`
- `supplierName String?`
- `poNumber String?`
- `createdByName String?`
- `projectId String?`
- `stockInId String?`
- `stockOutId String?`
- `stockOpnameId String?`
- `legacyPayload Json?`
- `createdAt DateTime`
- `updatedAt DateTime`

Relasi:

- `inventoryItem`
- `project`
- `stockIn`
- `stockOut`
- `stockOpname`

### 7. InventoryStockOpname

Tujuan:

- header stock opname

Field inti:

- `id String @id`
- `number String @unique`
- `tanggal DateTime`
- `location String`
- `status String`
- `notes String?`
- `createdByName String?`
- `confirmedByName String?`
- `confirmedAt DateTime?`
- `legacyPayload Json?`
- `createdAt DateTime`
- `updatedAt DateTime`

Relasi:

- `items -> InventoryStockOpnameItem[]`
- `movements -> InventoryStockMovement[]`

### 8. InventoryStockOpnameItem

Field inti:

- `id String @id`
- `stockOpnameId String`
- `inventoryItemId String?`
- `itemCode String`
- `itemName String`
- `systemQty Decimal`
- `physicalQty Decimal`
- `differenceQty Decimal`
- `notes String?`

Relasi:

- `stockOpname`
- `inventoryItem`

## Prinsip Penting

### Core vs Legacy

Field yang akan jadi source of truth:

- nomor dokumen
- tanggal
- status
- relasi project/PO/WO
- qty
- unit
- location
- stock before / after

Field yang boleh tetap di `legacyPayload` sementara:

- variasi note lama
- field UI lama yang belum dipakai query
- metadata dekoratif

## Mapping Dari Model Lama

### StockItemRecord.payload -> InventoryItem

- `payload.id` -> `id`
- `payload.kode` -> `code`
- `payload.nama` -> `name`
- `payload.kategori` -> `category`
- `payload.satuan` -> `unit`
- `payload.lokasi` -> `location`
- `payload.minStock` -> `minStock`
- `payload.stok` -> `onHandQty`
- `payload.reserved` -> `reservedQty`
- `payload.onOrder` -> `onOrderQty`
- `payload.hargaSatuan` -> `unitPrice`
- `payload.supplier` -> `supplierName`
- `payload.statusBarang` -> `status`
- `payload.lastUpdate` -> `lastStockUpdateAt`

### StockInRecord.payload -> InventoryStockIn + InventoryStockInItem

- `payload.id` -> `InventoryStockIn.id`
- `payload.noStockIn` -> `number`
- `payload.tanggal` -> `tanggal`
- `payload.type` -> `type`
- `payload.status` -> `status`
- `payload.supplier` -> `supplierName`
- `payload.noSuratJalan` -> `suratJalanNumber`
- `payload.notes` -> `notes`
- `payload.createdBy` -> `createdByName`
- `payload.poId` -> `poId`
- `payload.projectId` -> `projectId`
- `payload.items[]` -> `InventoryStockInItem[]`

### StockOutRecord.payload -> InventoryStockOut + InventoryStockOutItem

- `payload.id` -> `InventoryStockOut.id`
- `payload.noStockOut` -> `number`
- `payload.tanggal` -> `tanggal`
- `payload.type` -> `type`
- `payload.status` -> `status`
- `payload.penerima` -> `recipientName`
- `payload.notes` -> `notes`
- `payload.createdBy` -> `createdByName`
- `payload.projectId` -> `projectId`
- `payload.workOrderId` -> `workOrderId`
- `payload.productionReportId` -> `productionReportId`
- `payload.items[]` -> `InventoryStockOutItem[]`

### StockMovementRecord.payload -> InventoryStockMovement

- `payload.id` -> `id`
- `payload.tanggal` -> `tanggal`
- `payload.type` -> `direction`
- `payload.refNo` -> `referenceNo`
- `payload.refType` -> `referenceType`
- `payload.itemKode` -> `itemCode`
- `payload.itemNama` -> `itemName`
- `payload.qty` -> `qty`
- `payload.unit` -> `unit`
- `payload.lokasi` -> `location`
- `payload.stockBefore` -> `stockBefore`
- `payload.stockAfter` -> `stockAfter`
- `payload.batchNo` -> `batchNo`
- `payload.expiryDate` -> `expiryDate`
- `payload.supplier` -> `supplierName`
- `payload.noPO` -> `poNumber`
- `payload.createdBy` -> `createdByName`
- `payload.projectId` -> `projectId`

### StockOpnameRecord.payload -> InventoryStockOpname + InventoryStockOpnameItem

- `payload.id` -> `InventoryStockOpname.id`
- `payload.noOpname` -> `number`
- `payload.tanggal` -> `tanggal`
- `payload.lokasi` -> `location`
- `payload.status` -> `status`
- `payload.notes` -> `notes`
- `payload.createdBy` -> `createdByName`
- `payload.confirmedBy` -> `confirmedByName`
- `payload.confirmedAt` -> `confirmedAt`
- `payload.items[]` -> `InventoryStockOpnameItem[]`

## Migration Sequence

### Step 1

Tambahkan model baru ke Prisma schema:

- `InventoryItem`
- `InventoryStockIn`
- `InventoryStockInItem`
- `InventoryStockOut`
- `InventoryStockOutItem`
- `InventoryStockMovement`
- `InventoryStockOpname`
- `InventoryStockOpnameItem`

### Step 2

Buat migration SQL tanpa menghapus model lama.

### Step 3

Buat script backfill:

- baca `StockItemRecord`
- baca `StockInRecord`
- baca `StockOutRecord`
- baca `StockMovementRecord`
- baca `StockOpnameRecord`
- isi tabel baru

### Step 4

Tambahkan read adapter backend:

- inventory routes baca tabel baru dulu
- fallback ke tabel lama jika record baru belum ada

### Step 5

Update frontend:

- `InventoryCenter`
- `StockInPage`
- `StockOutPage`
- `StockCardDetailPage`
- `StockJournalPage`
- `WarehouseLedgerPage`
- `StockOpnamePage`
- `TraceabilityPage`
- `StockAgingPage`

### Step 6

Setelah stabil:

- write hanya ke tabel baru
- tabel lama menjadi fallback read-only sementara

## Definition of Done

Inventory dianggap selesai refactor jika:

1. create/update/read inventory sudah dari model baru
2. stock card bisa dibentuk dari query relasional
3. stock opname mengubah stok lewat movement yang terhubung
4. BW Water chain tetap hidup
5. export inventory tetap jalan

## Catatan Praktis

- `onHandQty` tidak boleh hanya dihitung manual di frontend
- movement tetap harus jadi sumber audit
- header/item table harus dipisah
- `legacyPayload` boleh ada sementara untuk kompatibilitas

## Rekomendasi Implementasi

Mulai paling aman dari:

1. `InventoryItem`
2. `InventoryStockIn + Item`
3. `InventoryStockOut + Item`
4. `InventoryStockMovement`
5. `InventoryStockOpname + Item`

Setelah itu baru frontend inventory dipindah domain per domain.
