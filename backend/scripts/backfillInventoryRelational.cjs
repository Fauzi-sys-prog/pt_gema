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
  if (!value) return new Date("1970-01-01T00:00:00.000Z");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date("1970-01-01T00:00:00.000Z") : date;
}

function optionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function arrayOfObjects(value) {
  return Array.isArray(value) ? value.map(asObject) : [];
}

async function backfillItems() {
  const records = await prisma.stockItemRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    const code = asString(payload.kode || payload.code);
    if (!code) continue;

    await prisma.inventoryItem.upsert({
      where: { code },
      update: {
        name: asString(payload.nama || payload.name, code),
        category: asString(payload.kategori || payload.category, "General"),
        unit: asString(payload.satuan || payload.unit, "pcs"),
        location: asString(payload.lokasi || payload.location, "Gudang Utama"),
        minStock: asNumber(payload.minStock, 0),
        onHandQty: asNumber(payload.stok ?? payload.onHandQty, 0),
        reservedQty: asNumber(payload.reserved ?? payload.reservedQty, 0),
        unitPrice: payload.hargaSatuan == null ? null : asNumber(payload.hargaSatuan),
        supplierName: asString(payload.supplier || payload.supplierName) || null,
        status: asString(payload.status) || null,
        lastStockUpdateAt: optionalDate(payload.lastUpdate || payload.lastStockUpdateAt),
        metadata: payload,
      },
      create: {
        id: record.id,
        code,
        name: asString(payload.nama || payload.name, code),
        category: asString(payload.kategori || payload.category, "General"),
        unit: asString(payload.satuan || payload.unit, "pcs"),
        location: asString(payload.lokasi || payload.location, "Gudang Utama"),
        minStock: asNumber(payload.minStock, 0),
        onHandQty: asNumber(payload.stok ?? payload.onHandQty, 0),
        reservedQty: asNumber(payload.reserved ?? payload.reservedQty, 0),
        onOrderQty: asNumber(payload.onOrderQty, 0),
        unitPrice: payload.hargaSatuan == null ? null : asNumber(payload.hargaSatuan),
        supplierName: asString(payload.supplier || payload.supplierName) || null,
        status: asString(payload.status) || null,
        lastStockUpdateAt: optionalDate(payload.lastUpdate || payload.lastStockUpdateAt),
        metadata: payload,
      },
    });
  }

  return records.length;
}

async function findInventoryItemIdByCode(itemCode) {
  if (!itemCode) return null;
  const item = await prisma.inventoryItem.findUnique({
    where: { code: itemCode },
    select: { id: true },
  });
  return item?.id ?? null;
}

async function backfillStockIns() {
  const records = await prisma.stockInRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    const number = asString(payload.noStockIn || payload.number || record.id, record.id);

    await prisma.inventoryStockIn.upsert({
      where: { number },
      update: {
        tanggal: asDate(payload.tanggal),
        type: asString(payload.type, "Receiving"),
        status: asString(payload.status, "Draft"),
        supplierName: asString(payload.supplier) || null,
        suratJalanNumber: asString(payload.noSuratJalan) || null,
        notes: asString(payload.notes) || null,
        createdByName: asString(payload.createdBy) || null,
        poId: asString(payload.poId) || record.poId || null,
        projectId: asString(payload.projectId) || record.projectId || null,
        legacyPayload: payload,
      },
      create: {
        id: record.id,
        number,
        tanggal: asDate(payload.tanggal),
        type: asString(payload.type, "Receiving"),
        status: asString(payload.status, "Draft"),
        supplierName: asString(payload.supplier) || null,
        suratJalanNumber: asString(payload.noSuratJalan) || null,
        notes: asString(payload.notes) || null,
        createdByName: asString(payload.createdBy) || null,
        poId: asString(payload.poId) || record.poId || null,
        projectId: asString(payload.projectId) || record.projectId || null,
        legacyPayload: payload,
      },
    });

    await prisma.inventoryStockInItem.deleteMany({ where: { stockInId: record.id } });
    const items = arrayOfObjects(payload.items);
    for (let i = 0; i < items.length; i += 1) {
      const row = items[i];
      const itemCode = asString(row.kode || row.itemKode || row.itemCode);
      if (!itemCode) continue;
      const inventoryItemId = await findInventoryItemIdByCode(itemCode);
      await prisma.inventoryStockInItem.create({
        data: {
          id: `${record.id}-ITEM-${String(i + 1).padStart(3, "0")}`,
          stockInId: record.id,
          inventoryItemId,
          itemCode,
          itemName: asString(row.nama || row.itemName || row.name, itemCode),
          qty: asNumber(row.qty ?? row.qtyReceived ?? row.qtyGood, 0),
          unit: asString(row.satuan || row.unit, "pcs"),
          batchNo: asString(row.batchNo) || null,
          expiryDate: optionalDate(row.expiryDate),
          notes: asString(row.notes) || null,
        },
      });
    }
  }

  return records.length;
}

async function backfillStockOuts() {
  const records = await prisma.stockOutRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    const number = asString(payload.noStockOut || payload.number || record.id, record.id);

    await prisma.inventoryStockOut.upsert({
      where: { number },
      update: {
        tanggal: asDate(payload.tanggal),
        type: asString(payload.type, "Project Issue"),
        status: asString(payload.status, "Draft"),
        recipientName: asString(payload.penerima || payload.recipientName) || null,
        notes: asString(payload.notes) || null,
        createdByName: asString(payload.createdBy) || null,
        projectId: asString(payload.projectId) || record.projectId || null,
        workOrderId: asString(payload.workOrderId) || record.workOrderId || null,
        productionReportId: asString(payload.productionReportId) || null,
        legacyPayload: payload,
      },
      create: {
        id: record.id,
        number,
        tanggal: asDate(payload.tanggal),
        type: asString(payload.type, "Project Issue"),
        status: asString(payload.status, "Draft"),
        recipientName: asString(payload.penerima || payload.recipientName) || null,
        notes: asString(payload.notes) || null,
        createdByName: asString(payload.createdBy) || null,
        projectId: asString(payload.projectId) || record.projectId || null,
        workOrderId: asString(payload.workOrderId) || record.workOrderId || null,
        productionReportId: asString(payload.productionReportId) || null,
        legacyPayload: payload,
      },
    });

    await prisma.inventoryStockOutItem.deleteMany({ where: { stockOutId: record.id } });
    const items = arrayOfObjects(payload.items);
    for (let i = 0; i < items.length; i += 1) {
      const row = items[i];
      const itemCode = asString(row.kode || row.itemKode || row.itemCode);
      if (!itemCode) continue;
      const inventoryItemId = await findInventoryItemIdByCode(itemCode);
      await prisma.inventoryStockOutItem.create({
        data: {
          id: `${record.id}-ITEM-${String(i + 1).padStart(3, "0")}`,
          stockOutId: record.id,
          inventoryItemId,
          itemCode,
          itemName: asString(row.nama || row.itemName || row.name, itemCode),
          qty: asNumber(row.qty, 0),
          unit: asString(row.satuan || row.unit, "pcs"),
          batchNo: asString(row.batchNo) || null,
          notes: asString(row.notes) || null,
        },
      });
    }
  }

  return records.length;
}

async function backfillStockOpnames() {
  const records = await prisma.stockOpnameRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    const number = asString(payload.noOpname || payload.number || record.id, record.id);

    await prisma.inventoryStockOpname.upsert({
      where: { number },
      update: {
        tanggal: asDate(payload.tanggal),
        location: asString(payload.location || payload.lokasi, "Gudang Utama"),
        status: asString(payload.status, "Draft"),
        notes: asString(payload.notes) || null,
        createdByName: asString(payload.createdBy) || null,
        confirmedByName: asString(payload.confirmedBy) || null,
        confirmedAt: optionalDate(payload.confirmedAt),
        legacyPayload: payload,
      },
      create: {
        id: record.id,
        number,
        tanggal: asDate(payload.tanggal),
        location: asString(payload.location || payload.lokasi, "Gudang Utama"),
        status: asString(payload.status, "Draft"),
        notes: asString(payload.notes) || null,
        createdByName: asString(payload.createdBy) || null,
        confirmedByName: asString(payload.confirmedBy) || null,
        confirmedAt: optionalDate(payload.confirmedAt),
        legacyPayload: payload,
      },
    });

    await prisma.inventoryStockOpnameItem.deleteMany({ where: { stockOpnameId: record.id } });
    const items = arrayOfObjects(payload.items);
    for (let i = 0; i < items.length; i += 1) {
      const row = items[i];
      const itemCode = asString(row.kode || row.itemKode || row.itemCode);
      if (!itemCode) continue;
      const inventoryItemId = await findInventoryItemIdByCode(itemCode);
      const systemQty = asNumber(row.systemQty ?? row.stokSistem ?? row.stok, 0);
      const physicalQty = asNumber(row.physicalQty ?? row.stokFisik, 0);
      await prisma.inventoryStockOpnameItem.create({
        data: {
          id: `${record.id}-ITEM-${String(i + 1).padStart(3, "0")}`,
          stockOpnameId: record.id,
          inventoryItemId,
          itemCode,
          itemName: asString(row.nama || row.itemName || row.name, itemCode),
          systemQty,
          physicalQty,
          differenceQty: asNumber(row.differenceQty ?? row.selisih, physicalQty - systemQty),
          notes: asString(row.notes) || null,
        },
      });
    }
  }

  return records.length;
}

async function backfillMovements() {
  const records = await prisma.stockMovementRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    const itemCode = asString(payload.kode || payload.itemCode || payload.itemKode);
    const inventoryItemId = await findInventoryItemIdByCode(itemCode);

    await prisma.inventoryStockMovement.upsert({
      where: { id: record.id },
      update: {
        tanggal: asDate(payload.tanggal || payload.date),
        direction: asString(payload.direction || payload.type, "IN"),
        referenceNo: asString(payload.referenceNo || payload.ref || payload.noReferensi, record.id),
        referenceType: asString(payload.referenceType || payload.source, "Manual"),
        inventoryItemId,
        itemCode,
        itemName: asString(payload.nama || payload.itemName || payload.name, itemCode),
        qty: asNumber(payload.qty, 0),
        unit: asString(payload.satuan || payload.unit, "pcs"),
        location: asString(payload.location || payload.lokasi, "Gudang Utama"),
        stockBefore: asNumber(payload.stockBefore ?? payload.stokSebelum, 0),
        stockAfter: asNumber(payload.stockAfter ?? payload.stokSesudah ?? payload.stokAkhir, 0),
        batchNo: asString(payload.batchNo) || null,
        expiryDate: optionalDate(payload.expiryDate),
        supplierName: asString(payload.supplier || payload.supplierName) || null,
        poNumber: asString(payload.noPO || payload.poNumber) || null,
        createdByName: asString(payload.createdBy) || null,
        projectId: asString(payload.projectId) || record.projectId || null,
        stockInId: asString(payload.stockInId) || null,
        stockOutId: asString(payload.stockOutId) || null,
        stockOpnameId: asString(payload.stockOpnameId) || null,
        legacyPayload: payload,
      },
      create: {
        id: record.id,
        tanggal: asDate(payload.tanggal || payload.date),
        direction: asString(payload.direction || payload.type, "IN"),
        referenceNo: asString(payload.referenceNo || payload.ref || payload.noReferensi, record.id),
        referenceType: asString(payload.referenceType || payload.source, "Manual"),
        inventoryItemId,
        itemCode,
        itemName: asString(payload.nama || payload.itemName || payload.name, itemCode),
        qty: asNumber(payload.qty, 0),
        unit: asString(payload.satuan || payload.unit, "pcs"),
        location: asString(payload.location || payload.lokasi, "Gudang Utama"),
        stockBefore: asNumber(payload.stockBefore ?? payload.stokSebelum, 0),
        stockAfter: asNumber(payload.stockAfter ?? payload.stokSesudah ?? payload.stokAkhir, 0),
        batchNo: asString(payload.batchNo) || null,
        expiryDate: optionalDate(payload.expiryDate),
        supplierName: asString(payload.supplier || payload.supplierName) || null,
        poNumber: asString(payload.noPO || payload.poNumber) || null,
        createdByName: asString(payload.createdBy) || null,
        projectId: asString(payload.projectId) || record.projectId || null,
        stockInId: asString(payload.stockInId) || null,
        stockOutId: asString(payload.stockOutId) || null,
        stockOpnameId: asString(payload.stockOpnameId) || null,
        legacyPayload: payload,
      },
    });
  }

  return records.length;
}

async function main() {
  const itemCount = await backfillItems();
  const stockInCount = await backfillStockIns();
  const stockOutCount = await backfillStockOuts();
  const stockOpnameCount = await backfillStockOpnames();
  const movementCount = await backfillMovements();

  console.log(
    JSON.stringify(
      {
        ok: true,
        backfilled: {
          items: itemCount,
          stockIns: stockInCount,
          stockOuts: stockOutCount,
          stockOpnames: stockOpnameCount,
          movements: movementCount,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("BACKFILL_INVENTORY_RELATIONAL_FAILED");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
