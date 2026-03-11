-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "onHandQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reservedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "onOrderQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPrice" DOUBLE PRECISION,
    "supplierName" TEXT,
    "status" TEXT,
    "lastStockUpdateAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStockIn" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "supplierName" TEXT,
    "suratJalanNumber" TEXT,
    "notes" TEXT,
    "createdByName" TEXT,
    "poId" TEXT,
    "projectId" TEXT,
    "legacyPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryStockIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStockInItem" (
    "id" TEXT NOT NULL,
    "stockInId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "batchNo" TEXT,
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "InventoryStockInItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStockOut" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recipientName" TEXT,
    "notes" TEXT,
    "createdByName" TEXT,
    "projectId" TEXT,
    "workOrderId" TEXT,
    "productionReportId" TEXT,
    "legacyPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryStockOut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStockOutItem" (
    "id" TEXT NOT NULL,
    "stockOutId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "batchNo" TEXT,
    "notes" TEXT,

    CONSTRAINT "InventoryStockOutItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStockOpname" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdByName" TEXT,
    "confirmedByName" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "legacyPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryStockOpname_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStockOpnameItem" (
    "id" TEXT NOT NULL,
    "stockOpnameId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "systemQty" DOUBLE PRECISION NOT NULL,
    "physicalQty" DOUBLE PRECISION NOT NULL,
    "differenceQty" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,

    CONSTRAINT "InventoryStockOpnameItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStockMovement" (
    "id" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "direction" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "stockBefore" DOUBLE PRECISION NOT NULL,
    "stockAfter" DOUBLE PRECISION NOT NULL,
    "batchNo" TEXT,
    "expiryDate" TIMESTAMP(3),
    "supplierName" TEXT,
    "poNumber" TEXT,
    "createdByName" TEXT,
    "projectId" TEXT,
    "stockInId" TEXT,
    "stockOutId" TEXT,
    "stockOpnameId" TEXT,
    "legacyPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_code_key" ON "InventoryItem"("code");
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");
CREATE INDEX "InventoryItem_location_idx" ON "InventoryItem"("location");
CREATE INDEX "InventoryItem_supplierName_idx" ON "InventoryItem"("supplierName");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryStockIn_number_key" ON "InventoryStockIn"("number");
CREATE INDEX "InventoryStockIn_tanggal_idx" ON "InventoryStockIn"("tanggal");
CREATE INDEX "InventoryStockIn_status_idx" ON "InventoryStockIn"("status");
CREATE INDEX "InventoryStockIn_poId_idx" ON "InventoryStockIn"("poId");
CREATE INDEX "InventoryStockIn_projectId_idx" ON "InventoryStockIn"("projectId");

-- CreateIndex
CREATE INDEX "InventoryStockInItem_stockInId_idx" ON "InventoryStockInItem"("stockInId");
CREATE INDEX "InventoryStockInItem_inventoryItemId_idx" ON "InventoryStockInItem"("inventoryItemId");
CREATE INDEX "InventoryStockInItem_itemCode_idx" ON "InventoryStockInItem"("itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryStockOut_number_key" ON "InventoryStockOut"("number");
CREATE INDEX "InventoryStockOut_tanggal_idx" ON "InventoryStockOut"("tanggal");
CREATE INDEX "InventoryStockOut_status_idx" ON "InventoryStockOut"("status");
CREATE INDEX "InventoryStockOut_projectId_idx" ON "InventoryStockOut"("projectId");
CREATE INDEX "InventoryStockOut_workOrderId_idx" ON "InventoryStockOut"("workOrderId");

-- CreateIndex
CREATE INDEX "InventoryStockOutItem_stockOutId_idx" ON "InventoryStockOutItem"("stockOutId");
CREATE INDEX "InventoryStockOutItem_inventoryItemId_idx" ON "InventoryStockOutItem"("inventoryItemId");
CREATE INDEX "InventoryStockOutItem_itemCode_idx" ON "InventoryStockOutItem"("itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryStockOpname_number_key" ON "InventoryStockOpname"("number");
CREATE INDEX "InventoryStockOpname_tanggal_idx" ON "InventoryStockOpname"("tanggal");
CREATE INDEX "InventoryStockOpname_location_idx" ON "InventoryStockOpname"("location");
CREATE INDEX "InventoryStockOpname_status_idx" ON "InventoryStockOpname"("status");

-- CreateIndex
CREATE INDEX "InventoryStockOpnameItem_stockOpnameId_idx" ON "InventoryStockOpnameItem"("stockOpnameId");
CREATE INDEX "InventoryStockOpnameItem_inventoryItemId_idx" ON "InventoryStockOpnameItem"("inventoryItemId");
CREATE INDEX "InventoryStockOpnameItem_itemCode_idx" ON "InventoryStockOpnameItem"("itemCode");

-- CreateIndex
CREATE INDEX "InventoryStockMovement_tanggal_idx" ON "InventoryStockMovement"("tanggal");
CREATE INDEX "InventoryStockMovement_inventoryItemId_idx" ON "InventoryStockMovement"("inventoryItemId");
CREATE INDEX "InventoryStockMovement_projectId_idx" ON "InventoryStockMovement"("projectId");
CREATE INDEX "InventoryStockMovement_stockInId_idx" ON "InventoryStockMovement"("stockInId");
CREATE INDEX "InventoryStockMovement_stockOutId_idx" ON "InventoryStockMovement"("stockOutId");
CREATE INDEX "InventoryStockMovement_stockOpnameId_idx" ON "InventoryStockMovement"("stockOpnameId");
CREATE INDEX "InventoryStockMovement_referenceNo_idx" ON "InventoryStockMovement"("referenceNo");

-- AddForeignKey
ALTER TABLE "InventoryStockIn"
  ADD CONSTRAINT "InventoryStockIn_poId_fkey"
  FOREIGN KEY ("poId") REFERENCES "PurchaseOrderRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryStockIn"
  ADD CONSTRAINT "InventoryStockIn_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryStockInItem"
  ADD CONSTRAINT "InventoryStockInItem_stockInId_fkey"
  FOREIGN KEY ("stockInId") REFERENCES "InventoryStockIn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryStockInItem"
  ADD CONSTRAINT "InventoryStockInItem_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryStockOut"
  ADD CONSTRAINT "InventoryStockOut_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryStockOut"
  ADD CONSTRAINT "InventoryStockOut_workOrderId_fkey"
  FOREIGN KEY ("workOrderId") REFERENCES "WorkOrderRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryStockOutItem"
  ADD CONSTRAINT "InventoryStockOutItem_stockOutId_fkey"
  FOREIGN KEY ("stockOutId") REFERENCES "InventoryStockOut"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryStockOutItem"
  ADD CONSTRAINT "InventoryStockOutItem_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryStockOpnameItem"
  ADD CONSTRAINT "InventoryStockOpnameItem_stockOpnameId_fkey"
  FOREIGN KEY ("stockOpnameId") REFERENCES "InventoryStockOpname"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryStockOpnameItem"
  ADD CONSTRAINT "InventoryStockOpnameItem_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryStockMovement"
  ADD CONSTRAINT "InventoryStockMovement_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryStockMovement"
  ADD CONSTRAINT "InventoryStockMovement_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryStockMovement"
  ADD CONSTRAINT "InventoryStockMovement_stockInId_fkey"
  FOREIGN KEY ("stockInId") REFERENCES "InventoryStockIn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryStockMovement"
  ADD CONSTRAINT "InventoryStockMovement_stockOutId_fkey"
  FOREIGN KEY ("stockOutId") REFERENCES "InventoryStockOut"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryStockMovement"
  ADD CONSTRAINT "InventoryStockMovement_stockOpnameId_fkey"
  FOREIGN KEY ("stockOpnameId") REFERENCES "InventoryStockOpname"("id") ON DELETE SET NULL ON UPDATE CASCADE;
