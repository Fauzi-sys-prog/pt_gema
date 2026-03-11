-- CreateTable
CREATE TABLE "ProcurementPurchaseOrder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "vendorId" TEXT,
    "number" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierAddress" TEXT,
    "supplierPhone" TEXT,
    "supplierFax" TEXT,
    "supplierContact" TEXT,
    "attention" TEXT,
    "notes" TEXT,
    "ppnRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topDays" INTEGER NOT NULL DEFAULT 0,
    "ref" TEXT,
    "poCode" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "signatoryName" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementPurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementPurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "itemCode" TEXT,
    "itemName" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtyReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT,
    "sourceRef" TEXT,

    CONSTRAINT "ProcurementPurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementReceiving" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "projectId" TEXT,
    "number" TEXT NOT NULL,
    "suratJalanNo" TEXT,
    "suratJalanPhoto" TEXT,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "purchaseOrderNo" TEXT,
    "supplierName" TEXT NOT NULL,
    "projectName" TEXT,
    "status" TEXT NOT NULL,
    "warehouseLocation" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementReceiving_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementReceivingItem" (
    "id" TEXT NOT NULL,
    "receivingId" TEXT NOT NULL,
    "itemCode" TEXT,
    "itemName" TEXT NOT NULL,
    "qtyOrdered" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtyReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtyGood" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtyDamaged" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qtyPreviouslyReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "condition" TEXT,
    "batchNo" TEXT,
    "expiryDate" TIMESTAMP(3),
    "photoUrl" TEXT,
    "notes" TEXT,

    CONSTRAINT "ProcurementReceivingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCustomerInvoice" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "projectId" TEXT,
    "number" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "customerName" TEXT NOT NULL,
    "projectName" TEXT,
    "perihal" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ppn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pph" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstandingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "noKontrak" TEXT,
    "noPO" TEXT,
    "termin" TEXT,
    "remark" TEXT,
    "createdBy" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCustomerInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCustomerInvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "FinanceCustomerInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCustomerInvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "nominal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL,
    "proofNo" TEXT,
    "bankName" TEXT,
    "remark" TEXT,
    "createdBy" TEXT,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "FinanceCustomerInvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceVendorExpense" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "projectId" TEXT,
    "number" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "vendorName" TEXT NOT NULL,
    "projectName" TEXT,
    "rabItemId" TEXT,
    "rabItemName" TEXT,
    "kategori" TEXT,
    "keterangan" TEXT,
    "nominal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ppn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNominal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hasKwitansi" BOOLEAN NOT NULL DEFAULT false,
    "kwitansiUrl" TEXT,
    "noKwitansi" TEXT,
    "metodeBayar" TEXT,
    "status" TEXT NOT NULL,
    "remark" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceVendorExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceVendorInvoice" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "projectId" TEXT,
    "purchaseOrderId" TEXT,
    "number" TEXT NOT NULL,
    "noPO" TEXT,
    "supplierName" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstandingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ppn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceVendorInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcurementPurchaseOrder_projectId_idx" ON "ProcurementPurchaseOrder"("projectId");
CREATE INDEX "ProcurementPurchaseOrder_vendorId_idx" ON "ProcurementPurchaseOrder"("vendorId");
CREATE INDEX "ProcurementPurchaseOrder_status_idx" ON "ProcurementPurchaseOrder"("status");
CREATE INDEX "ProcurementPurchaseOrder_tanggal_idx" ON "ProcurementPurchaseOrder"("tanggal");
CREATE INDEX "ProcurementPurchaseOrderItem_purchaseOrderId_idx" ON "ProcurementPurchaseOrderItem"("purchaseOrderId");
CREATE INDEX "ProcurementPurchaseOrderItem_itemCode_idx" ON "ProcurementPurchaseOrderItem"("itemCode");
CREATE INDEX "ProcurementReceiving_purchaseOrderId_idx" ON "ProcurementReceiving"("purchaseOrderId");
CREATE INDEX "ProcurementReceiving_projectId_idx" ON "ProcurementReceiving"("projectId");
CREATE INDEX "ProcurementReceiving_status_idx" ON "ProcurementReceiving"("status");
CREATE INDEX "ProcurementReceiving_tanggal_idx" ON "ProcurementReceiving"("tanggal");
CREATE INDEX "ProcurementReceivingItem_receivingId_idx" ON "ProcurementReceivingItem"("receivingId");
CREATE INDEX "ProcurementReceivingItem_itemCode_idx" ON "ProcurementReceivingItem"("itemCode");
CREATE INDEX "FinanceCustomerInvoice_customerId_idx" ON "FinanceCustomerInvoice"("customerId");
CREATE INDEX "FinanceCustomerInvoice_projectId_idx" ON "FinanceCustomerInvoice"("projectId");
CREATE INDEX "FinanceCustomerInvoice_status_idx" ON "FinanceCustomerInvoice"("status");
CREATE INDEX "FinanceCustomerInvoice_tanggal_idx" ON "FinanceCustomerInvoice"("tanggal");
CREATE INDEX "FinanceCustomerInvoiceItem_invoiceId_idx" ON "FinanceCustomerInvoiceItem"("invoiceId");
CREATE INDEX "FinanceCustomerInvoicePayment_invoiceId_idx" ON "FinanceCustomerInvoicePayment"("invoiceId");
CREATE INDEX "FinanceCustomerInvoicePayment_tanggal_idx" ON "FinanceCustomerInvoicePayment"("tanggal");
CREATE INDEX "FinanceVendorExpense_vendorId_idx" ON "FinanceVendorExpense"("vendorId");
CREATE INDEX "FinanceVendorExpense_projectId_idx" ON "FinanceVendorExpense"("projectId");
CREATE INDEX "FinanceVendorExpense_status_idx" ON "FinanceVendorExpense"("status");
CREATE INDEX "FinanceVendorExpense_tanggal_idx" ON "FinanceVendorExpense"("tanggal");
CREATE INDEX "FinanceVendorInvoice_vendorId_idx" ON "FinanceVendorInvoice"("vendorId");
CREATE INDEX "FinanceVendorInvoice_projectId_idx" ON "FinanceVendorInvoice"("projectId");
CREATE INDEX "FinanceVendorInvoice_purchaseOrderId_idx" ON "FinanceVendorInvoice"("purchaseOrderId");
CREATE INDEX "FinanceVendorInvoice_status_idx" ON "FinanceVendorInvoice"("status");

-- AddForeignKey
ALTER TABLE "ProcurementPurchaseOrder" ADD CONSTRAINT "ProcurementPurchaseOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProcurementPurchaseOrder" ADD CONSTRAINT "ProcurementPurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProcurementPurchaseOrderItem" ADD CONSTRAINT "ProcurementPurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "ProcurementPurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcurementReceiving" ADD CONSTRAINT "ProcurementReceiving_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "ProcurementPurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcurementReceiving" ADD CONSTRAINT "ProcurementReceiving_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProcurementReceivingItem" ADD CONSTRAINT "ProcurementReceivingItem_receivingId_fkey" FOREIGN KEY ("receivingId") REFERENCES "ProcurementReceiving"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceCustomerInvoice" ADD CONSTRAINT "FinanceCustomerInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceCustomerInvoice" ADD CONSTRAINT "FinanceCustomerInvoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceCustomerInvoiceItem" ADD CONSTRAINT "FinanceCustomerInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceCustomerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceCustomerInvoicePayment" ADD CONSTRAINT "FinanceCustomerInvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "FinanceCustomerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceVendorExpense" ADD CONSTRAINT "FinanceVendorExpense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceVendorExpense" ADD CONSTRAINT "FinanceVendorExpense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceVendorInvoice" ADD CONSTRAINT "FinanceVendorInvoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "VendorRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceVendorInvoice" ADD CONSTRAINT "FinanceVendorInvoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ProjectRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceVendorInvoice" ADD CONSTRAINT "FinanceVendorInvoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "ProcurementPurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
