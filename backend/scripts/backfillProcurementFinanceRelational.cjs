const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asString(value, fallback = "") {
  if (value == null) return fallback;
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function asDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function arrayOfObjects(value) {
  return Array.isArray(value) ? value.map(asObject) : [];
}

async function backfillPurchaseOrders() {
  const records = await prisma.purchaseOrderRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    await prisma.procurementPurchaseOrder.upsert({
      where: { id: record.id },
      update: {
        projectId: asString(payload.projectId || record.projectId) || null,
        vendorId: asString(payload.vendorId || record.vendorId) || null,
        number: asString(payload.noPO || record.id, record.id),
        tanggal: asDate(payload.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
        supplierName: asString(payload.supplier, "-"),
        supplierAddress: asString(payload.supplierAddress) || null,
        supplierPhone: asString(payload.supplierPhone) || null,
        supplierFax: asString(payload.supplierFax) || null,
        supplierContact: asString(payload.supplierContact) || null,
        attention: asString(payload.attention) || null,
        notes: asString(payload.notes) || null,
        ppnRate: asNumber(payload.ppnRate ?? payload.ppn, 0),
        topDays: Math.max(0, Math.trunc(asNumber(payload.top, 0))),
        ref: asString(payload.ref) || null,
        poCode: asString(payload.po) || null,
        deliveryDate: asDate(payload.deliveryDate),
        signatoryName: asString(payload.signatoryName) || null,
        totalAmount: asNumber(payload.total, 0),
        status: asString(payload.status, "Draft"),
      },
      create: {
        id: record.id,
        projectId: asString(payload.projectId || record.projectId) || null,
        vendorId: asString(payload.vendorId || record.vendorId) || null,
        number: asString(payload.noPO || record.id, record.id),
        tanggal: asDate(payload.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
        supplierName: asString(payload.supplier, "-"),
        supplierAddress: asString(payload.supplierAddress) || null,
        supplierPhone: asString(payload.supplierPhone) || null,
        supplierFax: asString(payload.supplierFax) || null,
        supplierContact: asString(payload.supplierContact) || null,
        attention: asString(payload.attention) || null,
        notes: asString(payload.notes) || null,
        ppnRate: asNumber(payload.ppnRate ?? payload.ppn, 0),
        topDays: Math.max(0, Math.trunc(asNumber(payload.top, 0))),
        ref: asString(payload.ref) || null,
        poCode: asString(payload.po) || null,
        deliveryDate: asDate(payload.deliveryDate),
        signatoryName: asString(payload.signatoryName) || null,
        totalAmount: asNumber(payload.total, 0),
        status: asString(payload.status, "Draft"),
      },
    });

    await prisma.procurementPurchaseOrderItem.deleteMany({ where: { purchaseOrderId: record.id } });
    const items = arrayOfObjects(payload.items);
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      await prisma.procurementPurchaseOrderItem.create({
        data: {
          id: asString(item.id) || `${record.id}-ITEM-${String(i + 1).padStart(3, "0")}`,
          purchaseOrderId: record.id,
          itemCode: asString(item.kode) || null,
          itemName: asString(item.nama, "-"),
          qty: asNumber(item.qty, 0),
          unit: asString(item.unit, "pcs"),
          unitPrice: asNumber(item.unitPrice ?? item.harga, 0),
          total: asNumber(item.total, asNumber(item.qty, 0) * asNumber(item.unitPrice ?? item.harga, 0)),
          qtyReceived: asNumber(item.qtyReceived, 0),
          source: asString(item.source) || null,
          sourceRef: asString(item.sourceRef) || null,
        },
      });
    }
  }
  return records.length;
}

async function backfillReceivings() {
  const records = await prisma.receivingRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    const purchaseOrderId = asString(payload.poId || record.poId);
    if (!purchaseOrderId) continue;
    await prisma.procurementReceiving.upsert({
      where: { id: record.id },
      update: {
        purchaseOrderId,
        projectId: asString(payload.projectId || record.projectId) || null,
        number: asString(payload.noReceiving || record.id, record.id),
        suratJalanNo: asString(payload.noSuratJalan) || null,
        suratJalanPhoto: asString(payload.fotoSuratJalan) || null,
        tanggal: asDate(payload.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
        purchaseOrderNo: asString(payload.noPO) || null,
        supplierName: asString(payload.supplier, "-"),
        projectName: asString(payload.project) || null,
        status: asString(payload.status, "Pending"),
        warehouseLocation: asString(payload.lokasiGudang) || null,
        notes: asString(payload.notes) || null,
      },
      create: {
        id: record.id,
        purchaseOrderId,
        projectId: asString(payload.projectId || record.projectId) || null,
        number: asString(payload.noReceiving || record.id, record.id),
        suratJalanNo: asString(payload.noSuratJalan) || null,
        suratJalanPhoto: asString(payload.fotoSuratJalan) || null,
        tanggal: asDate(payload.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
        purchaseOrderNo: asString(payload.noPO) || null,
        supplierName: asString(payload.supplier, "-"),
        projectName: asString(payload.project) || null,
        status: asString(payload.status, "Pending"),
        warehouseLocation: asString(payload.lokasiGudang) || null,
        notes: asString(payload.notes) || null,
      },
    });

    await prisma.procurementReceivingItem.deleteMany({ where: { receivingId: record.id } });
    const items = arrayOfObjects(payload.items);
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      await prisma.procurementReceivingItem.create({
        data: {
          id: asString(item.id) || `${record.id}-ITEM-${String(i + 1).padStart(3, "0")}`,
          receivingId: record.id,
          itemCode: asString(item.itemKode) || null,
          itemName: asString(item.itemName, "-"),
          qtyOrdered: asNumber(item.qtyOrdered, 0),
          qtyReceived: asNumber(item.qtyReceived ?? item.qtyGood ?? item.qty, 0),
          qtyGood: asNumber(item.qtyGood ?? item.qtyReceived ?? item.qty, 0),
          qtyDamaged: asNumber(item.qtyDamaged, 0),
          qtyPreviouslyReceived: asNumber(item.qtyPreviouslyReceived, 0),
          unit: asString(item.unit, "pcs"),
          condition: asString(item.condition) || null,
          batchNo: asString(item.batchNo) || null,
          expiryDate: asDate(item.expiryDate),
          photoUrl: asString(item.photoUrl) || null,
          notes: asString(item.notes) || null,
        },
      });
    }
  }
  return records.length;
}

async function backfillCustomerInvoices() {
  const records = await prisma.customerInvoiceRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    await prisma.financeCustomerInvoice.upsert({
      where: { id: record.id },
      update: {
        customerId: asString(payload.customerId || record.customerId) || null,
        projectId: asString(payload.projectId || record.projectId) || null,
        number: asString(payload.noInvoice || record.id, record.id),
        tanggal: asDate(payload.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
        dueDate: asDate(payload.dueDate),
        customerName: asString(payload.customerName, "-"),
        projectName: asString(payload.projectName) || null,
        perihal: asString(payload.perihal) || null,
        subtotal: asNumber(payload.subtotal, 0),
        ppn: asNumber(payload.ppn, 0),
        pph: asNumber(payload.pph, 0),
        totalAmount: asNumber(payload.totalNominal, 0),
        paidAmount: asNumber(payload.paidAmount, 0),
        outstandingAmount: asNumber(payload.outstandingAmount, 0),
        status: asString(payload.status, "Draft"),
        noKontrak: asString(payload.noKontrak) || null,
        noPO: asString(payload.noPO) || null,
        termin: asString(payload.termin) || null,
        remark: asString(payload.remark) || null,
        createdBy: asString(payload.createdBy) || null,
        sentAt: asDate(payload.sentAt),
      },
      create: {
        id: record.id,
        customerId: asString(payload.customerId || record.customerId) || null,
        projectId: asString(payload.projectId || record.projectId) || null,
        number: asString(payload.noInvoice || record.id, record.id),
        tanggal: asDate(payload.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
        dueDate: asDate(payload.dueDate),
        customerName: asString(payload.customerName, "-"),
        projectName: asString(payload.projectName) || null,
        perihal: asString(payload.perihal) || null,
        subtotal: asNumber(payload.subtotal, 0),
        ppn: asNumber(payload.ppn, 0),
        pph: asNumber(payload.pph, 0),
        totalAmount: asNumber(payload.totalNominal, 0),
        paidAmount: asNumber(payload.paidAmount, 0),
        outstandingAmount: asNumber(payload.outstandingAmount, 0),
        status: asString(payload.status, "Draft"),
        noKontrak: asString(payload.noKontrak) || null,
        noPO: asString(payload.noPO) || null,
        termin: asString(payload.termin) || null,
        remark: asString(payload.remark) || null,
        createdBy: asString(payload.createdBy) || null,
        sentAt: asDate(payload.sentAt),
      },
    });

    await prisma.financeCustomerInvoiceItem.deleteMany({ where: { invoiceId: record.id } });
    const items = arrayOfObjects(payload.items);
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      await prisma.financeCustomerInvoiceItem.create({
        data: {
          id: asString(item.id) || `${record.id}-ITEM-${String(i + 1).padStart(3, "0")}`,
          invoiceId: record.id,
          description: asString(item.deskripsi, "-"),
          qty: asNumber(item.qty, 0),
          unit: asString(item.satuan, "pcs"),
          unitPrice: asNumber(item.hargaSatuan, 0),
          amount: asNumber(item.jumlah, asNumber(item.qty, 0) * asNumber(item.hargaSatuan, 0)),
        },
      });
    }

    await prisma.financeCustomerInvoicePayment.deleteMany({ where: { invoiceId: record.id } });
    const payments = arrayOfObjects(payload.paymentHistory);
    for (let i = 0; i < payments.length; i += 1) {
      const payment = payments[i];
      await prisma.financeCustomerInvoicePayment.create({
        data: {
          id: asString(payment.id) || `${record.id}-PAY-${String(i + 1).padStart(3, "0")}`,
          invoiceId: record.id,
          tanggal: asDate(payment.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
          nominal: asNumber(payment.nominal, 0),
          method: asString(payment.metodeBayar, "Transfer"),
          proofNo: asString(payment.noBukti) || null,
          bankName: asString(payment.bankName) || null,
          remark: asString(payment.remark) || null,
          createdBy: asString(payment.createdBy) || null,
          paidAt: asDate(payment.createdAt),
        },
      });
    }
  }
  return records.length;
}

async function backfillVendorExpenses() {
  const records = await prisma.vendorExpenseRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    await prisma.financeVendorExpense.upsert({
      where: { id: record.id },
      update: {
        vendorId: asString(payload.vendorId || record.vendorId) || null,
        projectId: asString(payload.projectId || record.projectId) || null,
        number: asString(payload.noExpense || record.id, record.id),
        tanggal: asDate(payload.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
        vendorName: asString(payload.vendorName, "-"),
        projectName: asString(payload.projectName) || null,
        rabItemId: asString(payload.rabItemId) || null,
        rabItemName: asString(payload.rabItemName) || null,
        kategori: asString(payload.kategori) || null,
        keterangan: asString(payload.keterangan) || null,
        nominal: asNumber(payload.nominal, 0),
        ppn: asNumber(payload.ppn, 0),
        totalNominal: asNumber(payload.totalNominal, 0),
        hasKwitansi: Boolean(payload.hasKwitansi),
        kwitansiUrl: asString(payload.kwitansiUrl) || null,
        noKwitansi: asString(payload.noKwitansi) || null,
        metodeBayar: asString(payload.metodeBayar) || null,
        status: asString(payload.status, "Draft"),
        remark: asString(payload.remark) || null,
        approvedBy: asString(payload.approvedBy) || null,
        approvedAt: asDate(payload.approvedAt),
        rejectedBy: asString(payload.rejectedBy) || null,
        rejectedAt: asDate(payload.rejectedAt),
        rejectReason: asString(payload.rejectReason) || null,
        paidAt: asDate(payload.paidAt),
        createdBy: asString(payload.createdBy) || null,
      },
      create: {
        id: record.id,
        vendorId: asString(payload.vendorId || record.vendorId) || null,
        projectId: asString(payload.projectId || record.projectId) || null,
        number: asString(payload.noExpense || record.id, record.id),
        tanggal: asDate(payload.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
        vendorName: asString(payload.vendorName, "-"),
        projectName: asString(payload.projectName) || null,
        rabItemId: asString(payload.rabItemId) || null,
        rabItemName: asString(payload.rabItemName) || null,
        kategori: asString(payload.kategori) || null,
        keterangan: asString(payload.keterangan) || null,
        nominal: asNumber(payload.nominal, 0),
        ppn: asNumber(payload.ppn, 0),
        totalNominal: asNumber(payload.totalNominal, 0),
        hasKwitansi: Boolean(payload.hasKwitansi),
        kwitansiUrl: asString(payload.kwitansiUrl) || null,
        noKwitansi: asString(payload.noKwitansi) || null,
        metodeBayar: asString(payload.metodeBayar) || null,
        status: asString(payload.status, "Draft"),
        remark: asString(payload.remark) || null,
        approvedBy: asString(payload.approvedBy) || null,
        approvedAt: asDate(payload.approvedAt),
        rejectedBy: asString(payload.rejectedBy) || null,
        rejectedAt: asDate(payload.rejectedAt),
        rejectReason: asString(payload.rejectReason) || null,
        paidAt: asDate(payload.paidAt),
        createdBy: asString(payload.createdBy) || null,
      },
    });
  }
  return records.length;
}

async function backfillVendorInvoices() {
  const records = await prisma.vendorInvoiceRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    const candidateVendorId = asString(payload.vendorId || record.vendorId) || null;
    const candidateProjectId = asString(payload.projectId || record.projectId) || null;
    const candidatePurchaseOrderId = asString(payload.purchaseOrderId) || null;
    const vendorId =
      candidateVendorId &&
      (await prisma.vendorRecord.findUnique({ where: { id: candidateVendorId }, select: { id: true } }))
        ? candidateVendorId
        : null;
    const projectId =
      candidateProjectId &&
      (await prisma.projectRecord.findUnique({ where: { id: candidateProjectId }, select: { id: true } }))
        ? candidateProjectId
        : null;
    const purchaseOrderId =
      candidatePurchaseOrderId &&
      (await prisma.procurementPurchaseOrder.findUnique({ where: { id: candidatePurchaseOrderId }, select: { id: true } }))
        ? candidatePurchaseOrderId
        : null;
    await prisma.financeVendorInvoice.upsert({
      where: { id: record.id },
      update: {
        vendorId,
        projectId,
        purchaseOrderId,
        number: asString(payload.noInvoiceVendor || payload.noInvoice || record.id, record.id),
        noPO: asString(payload.noPO) || null,
        supplierName: asString(payload.supplier || payload.vendorName, "-"),
        totalAmount: asNumber(payload.totalAmount ?? payload.amount, 0),
        paidAmount: asNumber(payload.paidAmount, 0),
        outstandingAmount: asNumber(payload.outstandingAmount, 0),
        ppn: asNumber(payload.ppn, 0),
        status: asString(payload.status, "Unpaid"),
        tanggal: asDate(payload.tanggal),
        dueDate: asDate(payload.jatuhTempo),
      },
      create: {
        id: record.id,
        vendorId,
        projectId,
        purchaseOrderId,
        number: asString(payload.noInvoiceVendor || payload.noInvoice || record.id, record.id),
        noPO: asString(payload.noPO) || null,
        supplierName: asString(payload.supplier || payload.vendorName, "-"),
        totalAmount: asNumber(payload.totalAmount ?? payload.amount, 0),
        paidAmount: asNumber(payload.paidAmount, 0),
        outstandingAmount: asNumber(payload.outstandingAmount, 0),
        ppn: asNumber(payload.ppn, 0),
        status: asString(payload.status, "Unpaid"),
        tanggal: asDate(payload.tanggal),
        dueDate: asDate(payload.jatuhTempo),
      },
    });
  }
  return records.length;
}

async function main() {
  const purchaseOrders = await backfillPurchaseOrders();
  const receivings = await backfillReceivings();
  const customerInvoices = await backfillCustomerInvoices();
  const vendorExpenses = await backfillVendorExpenses();
  const vendorInvoices = await backfillVendorInvoices();
  console.log(JSON.stringify({ purchaseOrders, receivings, customerInvoices, vendorExpenses, vendorInvoices }, null, 2));
}

main()
  .catch((error) => {
    console.error("backfillProcurementFinanceRelational failed");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
