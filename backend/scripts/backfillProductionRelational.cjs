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

async function backfillWorkOrders() {
  const records = await prisma.workOrderRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    const projectId = asString(payload.projectId || record.projectId);
    if (!projectId) continue;

    await prisma.productionWorkOrder.upsert({
      where: { id: record.id },
      update: {
        number: asString(payload.woNumber || payload.number || record.id, record.id),
        projectId,
        projectName: asString(payload.projectName, projectId),
        itemToProduce: asString(payload.itemToProduce, "N/A"),
        targetQty: asNumber(payload.targetQty, 0),
        completedQty: asNumber(payload.completedQty, 0),
        status: asString(payload.status, "Draft"),
        priority: asString(payload.priority, "Normal"),
        deadline: asDate(payload.deadline),
        leadTechnician: asString(payload.leadTechnician, "-"),
        machineId: asString(payload.machineId) || null,
        startDate: asDate(payload.startDate),
        endDate: asDate(payload.endDate),
        workflowStatus: asString(payload.workflowStatus) || null,
        legacyPayload: payload,
      },
      create: {
        id: record.id,
        number: asString(payload.woNumber || payload.number || record.id, record.id),
        projectId,
        projectName: asString(payload.projectName, projectId),
        itemToProduce: asString(payload.itemToProduce, "N/A"),
        targetQty: asNumber(payload.targetQty, 0),
        completedQty: asNumber(payload.completedQty, 0),
        status: asString(payload.status, "Draft"),
        priority: asString(payload.priority, "Normal"),
        deadline: asDate(payload.deadline),
        leadTechnician: asString(payload.leadTechnician, "-"),
        machineId: asString(payload.machineId) || null,
        startDate: asDate(payload.startDate),
        endDate: asDate(payload.endDate),
        workflowStatus: asString(payload.workflowStatus) || null,
        legacyPayload: payload,
      },
    });

    await prisma.productionWorkOrderBom.deleteMany({ where: { workOrderId: record.id } });
    const bomItems = arrayOfObjects(payload.bom);
    for (let i = 0; i < bomItems.length; i += 1) {
      const item = bomItems[i];
      await prisma.productionWorkOrderBom.create({
        data: {
          id: `${record.id}-BOM-${String(i + 1).padStart(3, "0")}`,
          workOrderId: record.id,
          itemCode: asString(item.kode || item.itemKode) || null,
          itemName: asString(item.nama || item.materialName, "-"),
          unit: asString(item.unit, "pcs"),
          qty: asNumber(item.qty, 0),
          completedQty: asNumber(item.completedQty, 0),
          needsProcurement: Boolean(item.needsProcurement),
          stockAvailable: item.stockAvailable == null ? null : asNumber(item.stockAvailable, 0),
        },
      });
    }
  }
  return records.length;
}

async function backfillProductionReports() {
  const records = await prisma.productionReportRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    const projectId = asString(payload.projectId || record.projectId);
    if (!projectId) continue;
    await prisma.productionExecutionReport.upsert({
      where: { id: record.id },
      update: {
        projectId,
        workOrderId: asString(payload.workOrderId || record.workOrderId) || null,
        tanggal: asDate(payload.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
        shift: asString(payload.shift) || null,
        outputQty: asNumber(payload.outputQty, 0),
        rejectQty: asNumber(payload.rejectQty, 0),
        efficiency: payload.efficiency == null ? null : asNumber(payload.efficiency, 0),
        notes: asString(payload.notes || payload.remarks) || null,
        workerName: asString(payload.workerName) || null,
        activity: asString(payload.activity) || null,
        machineNo: asString(payload.machineNo) || null,
        startTime: asString(payload.startTime) || null,
        endTime: asString(payload.endTime) || null,
        unit: asString(payload.unit) || null,
        photoUrl: asString(payload.photoUrl) || null,
        workflowStatus: asString(payload.workflowStatus) || null,
        legacyPayload: payload,
      },
      create: {
        id: record.id,
        projectId,
        workOrderId: asString(payload.workOrderId || record.workOrderId) || null,
        tanggal: asDate(payload.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
        shift: asString(payload.shift) || null,
        outputQty: asNumber(payload.outputQty, 0),
        rejectQty: asNumber(payload.rejectQty, 0),
        efficiency: payload.efficiency == null ? null : asNumber(payload.efficiency, 0),
        notes: asString(payload.notes || payload.remarks) || null,
        workerName: asString(payload.workerName) || null,
        activity: asString(payload.activity) || null,
        machineNo: asString(payload.machineNo) || null,
        startTime: asString(payload.startTime) || null,
        endTime: asString(payload.endTime) || null,
        unit: asString(payload.unit) || null,
        photoUrl: asString(payload.photoUrl) || null,
        workflowStatus: asString(payload.workflowStatus) || null,
        legacyPayload: payload,
      },
    });
  }
  return records.length;
}

async function backfillProductionTrackers() {
  const records = await prisma.productionTrackerRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    const projectId = asString(payload.projectId || record.projectId);
    if (!projectId) continue;
    await prisma.productionTrackerEntry.upsert({
      where: { id: record.id },
      update: {
        projectId,
        workOrderId: asString(payload.workOrderId || record.workOrderId) || null,
        customer: asString(payload.customer) || null,
        itemType: asString(payload.itemType, "-"),
        qty: asNumber(payload.qty, 0),
        startDate: asDate(payload.startDate),
        finishDate: asDate(payload.finishDate),
        status: asString(payload.status, "Planned"),
        machineId: asString(payload.machineId) || null,
        workflowStatus: asString(payload.workflowStatus) || null,
        legacyPayload: payload,
      },
      create: {
        id: record.id,
        projectId,
        workOrderId: asString(payload.workOrderId || record.workOrderId) || null,
        customer: asString(payload.customer) || null,
        itemType: asString(payload.itemType, "-"),
        qty: asNumber(payload.qty, 0),
        startDate: asDate(payload.startDate),
        finishDate: asDate(payload.finishDate),
        status: asString(payload.status, "Planned"),
        machineId: asString(payload.machineId) || null,
        workflowStatus: asString(payload.workflowStatus) || null,
        legacyPayload: payload,
      },
    });
  }
  return records.length;
}

async function backfillQcInspections() {
  const records = await prisma.qcInspectionRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    const projectId = asString(payload.projectId || record.projectId);
    if (!projectId) continue;
    await prisma.productionQcInspection.upsert({
      where: { id: record.id },
      update: {
        projectId,
        workOrderId: asString(payload.workOrderId || record.workOrderId) || null,
        tanggal: asDate(payload.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
        batchNo: asString(payload.batchNo) || null,
        itemName: asString(payload.itemNama, "-"),
        qtyInspected: asNumber(payload.qtyInspected, 0),
        qtyPassed: asNumber(payload.qtyPassed, 0),
        qtyRejected: asNumber(payload.qtyRejected, 0),
        inspectorName: asString(payload.inspectorName, "-"),
        status: asString(payload.status, "Pending"),
        notes: asString(payload.notes) || null,
        visualCheck: Boolean(payload.visualCheck),
        dimensionCheck: Boolean(payload.dimensionCheck),
        materialCheck: Boolean(payload.materialCheck),
        photoUrl: asString(payload.photoUrl) || null,
        customerName: asString(payload.customerName) || null,
        drawingUrl: asString(payload.drawingUrl) || null,
        remark: asString(payload.remark) || null,
        dimensions: payload.dimensions ?? null,
        workflowStatus: asString(payload.workflowStatus) || null,
        legacyPayload: payload,
      },
      create: {
        id: record.id,
        projectId,
        workOrderId: asString(payload.workOrderId || record.workOrderId) || null,
        tanggal: asDate(payload.tanggal) || new Date("1970-01-01T00:00:00.000Z"),
        batchNo: asString(payload.batchNo) || null,
        itemName: asString(payload.itemNama, "-"),
        qtyInspected: asNumber(payload.qtyInspected, 0),
        qtyPassed: asNumber(payload.qtyPassed, 0),
        qtyRejected: asNumber(payload.qtyRejected, 0),
        inspectorName: asString(payload.inspectorName, "-"),
        status: asString(payload.status, "Pending"),
        notes: asString(payload.notes) || null,
        visualCheck: Boolean(payload.visualCheck),
        dimensionCheck: Boolean(payload.dimensionCheck),
        materialCheck: Boolean(payload.materialCheck),
        photoUrl: asString(payload.photoUrl) || null,
        customerName: asString(payload.customerName) || null,
        drawingUrl: asString(payload.drawingUrl) || null,
        remark: asString(payload.remark) || null,
        dimensions: payload.dimensions ?? null,
        workflowStatus: asString(payload.workflowStatus) || null,
        legacyPayload: payload,
      },
    });
  }
  return records.length;
}

async function backfillMaterialRequests() {
  const records = await prisma.materialRequestRecord.findMany();
  for (const record of records) {
    const payload = asObject(record.payload);
    const projectId = asString(payload.projectId || record.projectId);
    if (!projectId) continue;
    await prisma.productionMaterialRequest.upsert({
      where: { id: record.id },
      update: {
        number: asString(payload.noRequest || payload.requestNo || record.id, record.id),
        projectId,
        projectName: asString(payload.projectName, projectId),
        requestedBy: asString(payload.requestedBy, "-"),
        requestedAt: asDate(payload.requestedAt || payload.date) || new Date("1970-01-01T00:00:00.000Z"),
        status: asString(payload.status, "Pending"),
        priority: asString(payload.priority) || null,
        legacyPayload: payload,
      },
      create: {
        id: record.id,
        number: asString(payload.noRequest || payload.requestNo || record.id, record.id),
        projectId,
        projectName: asString(payload.projectName, projectId),
        requestedBy: asString(payload.requestedBy, "-"),
        requestedAt: asDate(payload.requestedAt || payload.date) || new Date("1970-01-01T00:00:00.000Z"),
        status: asString(payload.status, "Pending"),
        priority: asString(payload.priority) || null,
        legacyPayload: payload,
      },
    });

    await prisma.productionMaterialRequestItem.deleteMany({ where: { materialRequestId: record.id } });
    const items = arrayOfObjects(payload.items);
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      await prisma.productionMaterialRequestItem.create({
        data: {
          id: `${record.id}-ITEM-${String(i + 1).padStart(3, "0")}`,
          materialRequestId: record.id,
          itemCode: asString(item.itemKode || item.kode) || null,
          itemName: asString(item.itemNama || item.nama, "-"),
          qty: asNumber(item.qty, 0),
          unit: asString(item.unit, "pcs"),
        },
      });
    }
  }
  return records.length;
}

async function main() {
  const workOrders = await backfillWorkOrders();
  const productionReports = await backfillProductionReports();
  const productionTrackers = await backfillProductionTrackers();
  const qcInspections = await backfillQcInspections();
  const materialRequests = await backfillMaterialRequests();

  console.log(JSON.stringify({
    ok: true,
    backfilled: {
      workOrders,
      productionReports,
      productionTrackers,
      qcInspections,
      materialRequests,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("BACKFILL_PRODUCTION_RELATIONAL_FAILED");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
