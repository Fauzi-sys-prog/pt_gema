import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const RESOURCE_TO_DELEGATE: Record<string, string> = {
  employees: "employeeRecord",
  attendances: "attendanceRecord",
  "stock-items": "stockItemRecord",
  "stock-movements": "stockMovementRecord",
  "stock-ins": "stockInRecord",
  "stock-outs": "stockOutRecord",
  "stock-opnames": "stockOpnameRecord",
  invoices: "invoiceRecord",
  "purchase-orders": "purchaseOrderRecord",
  receivings: "receivingRecord",
  "work-orders": "workOrderRecord",
  "production-reports": "productionReportRecord",
  "production-trackers": "productionTrackerRecord",
  "qc-inspections": "qcInspectionRecord",
  "material-requests": "materialRequestRecord",
  "surat-jalan": "suratJalanRecord",
  "berita-acara": "beritaAcaraRecord",
  "surat-masuk": "suratMasukRecord",
  "surat-keluar": "suratKeluarRecord",
  "template-surat": "templateSuratRecord",
  assets: "assetRecord",
  maintenances: "maintenanceRecord",
  payrolls: "payrollRecord",
  vendors: "vendorRecord",
  "vendor-expenses": "vendorExpenseRecord",
  "vendor-invoices": "vendorInvoiceRecord",
  customers: "customerRecord",
  "customer-invoices": "customerInvoiceRecord",
  "working-expense-sheets": "workingExpenseSheetRecord",
  "hr-shifts": "hrShiftRecord",
  "hr-shift-schedules": "hrShiftScheduleRecord",
  "hr-attendance-summaries": "hrAttendanceSummaryRecord",
  "hr-performance-reviews": "hrPerformanceReviewRecord",
  "hr-thl-contracts": "hrThlContractRecord",
  "hr-resignations": "hrResignationRecord",
  "hr-leaves": "hrLeaveRecord",
  "hr-online-status": "hrOnlineStatusRecord",
  "finance-bpjs-payments": "financeBpjsPaymentRecord",
  "finance-pph21-filings": "financePph21FilingRecord",
  "finance-thr-disbursements": "financeThrDisbursementRecord",
  "finance-employee-allowances": "financeEmployeeAllowanceRecord",
  "finance-po-payments": "financePoPaymentRecord",
  "finance-bank-reconciliations": "financeBankReconciliationRecord",
  "finance-petty-cash-transactions": "financePettyCashTransactionRecord",
  kasbons: "kasbonRecord",
  "proof-of-delivery": "proofOfDeliveryRecord",
  "spk-records": "spkRecord",
  "app-settings": "appSettingRecord",
};

type Delegate = {
  upsert: (args: {
    where: { id: string };
    create: { id: string; payload: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull };
    update: { payload: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull };
  }) => Promise<unknown>;
};

type BackfillResult = { resource: string; total: number; upserted: number };

async function backfillResource(resource: string, delegateName: string) {
  if (resource === "assets" || resource === "maintenances" || resource === "invoices") {
    const rows = await prisma.appEntity.findMany({
      where: { resource },
      select: { entityId: true, payload: true },
    });
    if (rows.length === 0) return { resource, total: 0, upserted: 0 } as BackfillResult;
    let upserted = 0;
    for (const row of rows) {
      const payloadObj =
        row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {};
      if (resource === "assets") {
        await prisma.assetRecord.upsert({
          where: { id: row.entityId },
          create: {
            id: row.entityId,
            projectId: typeof payloadObj.projectId === "string" ? payloadObj.projectId : null,
            assetCode: typeof payloadObj.assetCode === "string" ? payloadObj.assetCode : row.entityId,
            name: typeof payloadObj.name === "string" ? payloadObj.name : row.entityId,
            category: typeof payloadObj.category === "string" ? payloadObj.category : "General",
            location: typeof payloadObj.location === "string" ? payloadObj.location : "Unknown",
            status: typeof payloadObj.status === "string" ? payloadObj.status : "Available",
            condition: typeof payloadObj.condition === "string" ? payloadObj.condition : "Good",
            purchaseDate: typeof payloadObj.purchaseDate === "string" ? payloadObj.purchaseDate : null,
            purchasePrice: payloadObj.purchasePrice == null ? null : Number(payloadObj.purchasePrice || 0),
            rentalPrice: payloadObj.rentalPrice == null ? null : Number(payloadObj.rentalPrice || 0),
            lastMaintenance: typeof payloadObj.lastMaintenance === "string" ? payloadObj.lastMaintenance : null,
            nextMaintenance: typeof payloadObj.nextMaintenance === "string" ? payloadObj.nextMaintenance : null,
            operatorName: typeof payloadObj.operatorName === "string" ? payloadObj.operatorName : null,
            projectName: typeof payloadObj.projectName === "string" ? payloadObj.projectName : null,
            rentedTo: typeof payloadObj.rentedTo === "string" ? payloadObj.rentedTo : null,
            notes: typeof payloadObj.notes === "string" ? payloadObj.notes : null,
          },
          update: {
            projectId: typeof payloadObj.projectId === "string" ? payloadObj.projectId : null,
            assetCode: typeof payloadObj.assetCode === "string" ? payloadObj.assetCode : row.entityId,
            name: typeof payloadObj.name === "string" ? payloadObj.name : row.entityId,
            category: typeof payloadObj.category === "string" ? payloadObj.category : "General",
            location: typeof payloadObj.location === "string" ? payloadObj.location : "Unknown",
            status: typeof payloadObj.status === "string" ? payloadObj.status : "Available",
            condition: typeof payloadObj.condition === "string" ? payloadObj.condition : "Good",
            purchaseDate: typeof payloadObj.purchaseDate === "string" ? payloadObj.purchaseDate : null,
            purchasePrice: payloadObj.purchasePrice == null ? null : Number(payloadObj.purchasePrice || 0),
            rentalPrice: payloadObj.rentalPrice == null ? null : Number(payloadObj.rentalPrice || 0),
            lastMaintenance: typeof payloadObj.lastMaintenance === "string" ? payloadObj.lastMaintenance : null,
            nextMaintenance: typeof payloadObj.nextMaintenance === "string" ? payloadObj.nextMaintenance : null,
            operatorName: typeof payloadObj.operatorName === "string" ? payloadObj.operatorName : null,
            projectName: typeof payloadObj.projectName === "string" ? payloadObj.projectName : null,
            rentedTo: typeof payloadObj.rentedTo === "string" ? payloadObj.rentedTo : null,
            notes: typeof payloadObj.notes === "string" ? payloadObj.notes : null,
          },
        });
      } else if (resource === "maintenances") {
        await prisma.maintenanceRecord.upsert({
          where: { id: row.entityId },
          create: {
            id: row.entityId,
            assetId: typeof payloadObj.assetId === "string" ? payloadObj.assetId : null,
            projectId: typeof payloadObj.projectId === "string" ? payloadObj.projectId : null,
            maintenanceNo: typeof payloadObj.maintenanceNo === "string" ? payloadObj.maintenanceNo : row.entityId,
            assetCode: typeof payloadObj.assetCode === "string" ? payloadObj.assetCode : null,
            equipmentName: typeof payloadObj.equipmentName === "string" ? payloadObj.equipmentName : row.entityId,
            maintenanceType: typeof payloadObj.maintenanceType === "string" ? payloadObj.maintenanceType : "Routine",
            scheduledDate: typeof payloadObj.scheduledDate === "string" ? payloadObj.scheduledDate : null,
            completedDate: typeof payloadObj.completedDate === "string" ? payloadObj.completedDate : null,
            status: typeof payloadObj.status === "string" ? payloadObj.status : "Scheduled",
            cost: payloadObj.cost == null ? null : Number(payloadObj.cost || 0),
            performedBy: typeof payloadObj.performedBy === "string" ? payloadObj.performedBy : null,
            notes: typeof payloadObj.notes === "string" ? payloadObj.notes : null,
          },
          update: {
            assetId: typeof payloadObj.assetId === "string" ? payloadObj.assetId : null,
            projectId: typeof payloadObj.projectId === "string" ? payloadObj.projectId : null,
            maintenanceNo: typeof payloadObj.maintenanceNo === "string" ? payloadObj.maintenanceNo : row.entityId,
            assetCode: typeof payloadObj.assetCode === "string" ? payloadObj.assetCode : null,
            equipmentName: typeof payloadObj.equipmentName === "string" ? payloadObj.equipmentName : row.entityId,
            maintenanceType: typeof payloadObj.maintenanceType === "string" ? payloadObj.maintenanceType : "Routine",
            scheduledDate: typeof payloadObj.scheduledDate === "string" ? payloadObj.scheduledDate : null,
            completedDate: typeof payloadObj.completedDate === "string" ? payloadObj.completedDate : null,
            status: typeof payloadObj.status === "string" ? payloadObj.status : "Scheduled",
            cost: payloadObj.cost == null ? null : Number(payloadObj.cost || 0),
            performedBy: typeof payloadObj.performedBy === "string" ? payloadObj.performedBy : null,
            notes: typeof payloadObj.notes === "string" ? payloadObj.notes : null,
          },
        });
      } else {
        const itemsRaw = Array.isArray(payloadObj.items) ? payloadObj.items : [];
        const items = itemsRaw.map((item) => (item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {}));
        const subtotal = typeof payloadObj.subtotal === "number" ? payloadObj.subtotal : Number(payloadObj.subtotal || payloadObj.amount || payloadObj.totalBayar || 0);
        const ppn = typeof payloadObj.ppn === "number" ? payloadObj.ppn : Number(payloadObj.ppn || 0);
        const totalBayar = typeof payloadObj.totalBayar === "number" ? payloadObj.totalBayar : Number(payloadObj.totalBayar || payloadObj.amount || subtotal || 0);
        const paidAmount = typeof payloadObj.paidAmount === "number" ? payloadObj.paidAmount : Number(payloadObj.paidAmount || 0);
        const outstandingAmount = typeof payloadObj.outstandingAmount === "number" ? payloadObj.outstandingAmount : Math.max(0, totalBayar - paidAmount);
        await prisma.invoiceRecord.upsert({
          where: { id: row.entityId },
          create: {
            id: row.entityId,
            projectId: typeof payloadObj.projectId === "string" ? payloadObj.projectId : null,
            customerId: typeof payloadObj.customerId === "string" ? payloadObj.customerId : null,
            noInvoice: typeof payloadObj.noInvoice === "string" ? payloadObj.noInvoice : typeof payloadObj.invoiceNumber === "string" ? payloadObj.invoiceNumber : row.entityId,
            tanggal: typeof payloadObj.tanggal === "string" ? payloadObj.tanggal : typeof payloadObj.issuedDate === "string" ? payloadObj.issuedDate : new Date().toISOString().slice(0, 10),
            jatuhTempo: typeof payloadObj.jatuhTempo === "string" ? payloadObj.jatuhTempo : typeof payloadObj.dueDate === "string" ? payloadObj.dueDate : new Date().toISOString().slice(0, 10),
            customer: typeof payloadObj.customer === "string" ? payloadObj.customer : typeof payloadObj.customerName === "string" ? payloadObj.customerName : "-",
            customerName: typeof payloadObj.customerName === "string" ? payloadObj.customerName : typeof payloadObj.customer === "string" ? payloadObj.customer : null,
            alamat: typeof payloadObj.alamat === "string" ? payloadObj.alamat : "",
            noPO: typeof payloadObj.noPO === "string" ? payloadObj.noPO : "",
            subtotal,
            ppn,
            totalBayar,
            paidAmount,
            outstandingAmount,
            status: typeof payloadObj.status === "string" ? payloadObj.status : "Unpaid",
            projectName: typeof payloadObj.projectName === "string" ? payloadObj.projectName : null,
            noFakturPajak: typeof payloadObj.noFakturPajak === "string" ? payloadObj.noFakturPajak : null,
            perihal: typeof payloadObj.perihal === "string" ? payloadObj.perihal : null,
            termin: typeof payloadObj.termin === "string" ? payloadObj.termin : null,
            buktiTransfer: typeof payloadObj.buktiTransfer === "string" ? payloadObj.buktiTransfer : null,
            noKwitansi: typeof payloadObj.noKwitansi === "string" ? payloadObj.noKwitansi : null,
            tanggalBayar: typeof payloadObj.tanggalBayar === "string" ? payloadObj.tanggalBayar : null,
          },
          update: {
            projectId: typeof payloadObj.projectId === "string" ? payloadObj.projectId : null,
            customerId: typeof payloadObj.customerId === "string" ? payloadObj.customerId : null,
            noInvoice: typeof payloadObj.noInvoice === "string" ? payloadObj.noInvoice : typeof payloadObj.invoiceNumber === "string" ? payloadObj.invoiceNumber : row.entityId,
            tanggal: typeof payloadObj.tanggal === "string" ? payloadObj.tanggal : typeof payloadObj.issuedDate === "string" ? payloadObj.issuedDate : new Date().toISOString().slice(0, 10),
            jatuhTempo: typeof payloadObj.jatuhTempo === "string" ? payloadObj.jatuhTempo : typeof payloadObj.dueDate === "string" ? payloadObj.dueDate : new Date().toISOString().slice(0, 10),
            customer: typeof payloadObj.customer === "string" ? payloadObj.customer : typeof payloadObj.customerName === "string" ? payloadObj.customerName : "-",
            customerName: typeof payloadObj.customerName === "string" ? payloadObj.customerName : typeof payloadObj.customer === "string" ? payloadObj.customer : null,
            alamat: typeof payloadObj.alamat === "string" ? payloadObj.alamat : "",
            noPO: typeof payloadObj.noPO === "string" ? payloadObj.noPO : "",
            subtotal,
            ppn,
            totalBayar,
            paidAmount,
            outstandingAmount,
            status: typeof payloadObj.status === "string" ? payloadObj.status : "Unpaid",
            projectName: typeof payloadObj.projectName === "string" ? payloadObj.projectName : null,
            noFakturPajak: typeof payloadObj.noFakturPajak === "string" ? payloadObj.noFakturPajak : null,
            perihal: typeof payloadObj.perihal === "string" ? payloadObj.perihal : null,
            termin: typeof payloadObj.termin === "string" ? payloadObj.termin : null,
            buktiTransfer: typeof payloadObj.buktiTransfer === "string" ? payloadObj.buktiTransfer : null,
            noKwitansi: typeof payloadObj.noKwitansi === "string" ? payloadObj.noKwitansi : null,
            tanggalBayar: typeof payloadObj.tanggalBayar === "string" ? payloadObj.tanggalBayar : null,
          },
        });
        await prisma.invoiceItem.deleteMany({ where: { invoiceId: row.entityId } });
        if (items.length > 0) {
          await prisma.invoiceItem.createMany({
            data: items.map((item, idx) => ({
              id: `${row.entityId}-item-${idx + 1}`,
              invoiceId: row.entityId,
              deskripsi: typeof item.deskripsi === "string" ? item.deskripsi : "Item",
              qty: Number(item.qty || 0),
              unit: typeof item.unit === "string" ? item.unit : "pcs",
              hargaSatuan: Number(item.hargaSatuan || 0),
              total: Number(item.total || 0),
              sourceRef: typeof item.sourceRef === "string" ? item.sourceRef : null,
              batchNo: typeof item.batchNo === "string" ? item.batchNo : null,
            })),
          });
        }
      }
      upserted += 1;
    }
    return { resource, total: rows.length, upserted } as BackfillResult;
  }

  const delegate = (prisma as unknown as Record<string, unknown>)[delegateName] as Delegate | undefined;
  if (!delegate || typeof delegate.upsert !== "function") {
    throw new Error(`Delegate tidak ditemukan untuk resource '${resource}' -> '${delegateName}'`);
  }

  const rows = await prisma.appEntity.findMany({
    where: { resource },
    select: { entityId: true, payload: true },
  });

  if (rows.length === 0) return { resource, total: 0, upserted: 0 } as BackfillResult;

  let upserted = 0;
  for (const row of rows) {
    const jsonPayload =
      row.payload === null
        ? Prisma.JsonNull
        : (row.payload as Prisma.InputJsonValue);

    await delegate.upsert({
      where: { id: row.entityId },
      create: { id: row.entityId, payload: jsonPayload },
      update: { payload: jsonPayload },
    });
    upserted += 1;
  }

  return { resource, total: rows.length, upserted } as BackfillResult;
}

async function backfillProjectsFromAppEntity(): Promise<BackfillResult> {
  const rows = await prisma.appEntity.findMany({
    where: { resource: "projects" },
    select: { entityId: true, payload: true },
  });

  if (rows.length === 0) return { resource: "projects", total: 0, upserted: 0 };

  let upserted = 0;
  for (const row of rows) {
    const payloadObj =
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};
    const jsonPayload =
      row.payload === null
        ? Prisma.JsonNull
        : (row.payload as Prisma.InputJsonValue);

    const quotationId =
      typeof payloadObj.quotationId === "string" && payloadObj.quotationId.trim()
        ? payloadObj.quotationId.trim()
        : null;

    const customerId =
      typeof payloadObj.customerId === "string" && payloadObj.customerId.trim()
        ? payloadObj.customerId.trim()
        : null;

    await prisma.projectRecord.upsert({
      where: { id: row.entityId },
      create: {
        id: row.entityId,
        payload: jsonPayload,
        quotationId,
        customerId,
      },
      update: {
        payload: jsonPayload,
        quotationId,
        customerId,
      },
    });
    upserted += 1;
  }

  return { resource: "projects", total: rows.length, upserted };
}

async function backfillFleetHealthFromAppEntity(): Promise<BackfillResult> {
  const rows = await prisma.appEntity.findMany({
    where: { resource: "fleet-health" },
    select: { entityId: true, payload: true },
  });

  if (rows.length === 0) return { resource: "fleet-health", total: 0, upserted: 0 };

  let upserted = 0;
  for (const row of rows) {
    const payloadObj =
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};

    const assetId =
      typeof payloadObj.assetId === "string" && payloadObj.assetId.trim()
        ? payloadObj.assetId.trim()
        : typeof payloadObj.equipmentId === "string" && payloadObj.equipmentId.trim()
          ? payloadObj.equipmentId.trim()
          : null;
    const projectId =
      typeof payloadObj.projectId === "string" && payloadObj.projectId.trim()
        ? payloadObj.projectId.trim()
        : null;

    if (!assetId || !projectId) continue;

    await prisma.fleetHealthEntry.upsert({
      where: { id: row.entityId },
      create: {
        id: row.entityId,
        assetId,
        projectId,
        tanggal: typeof payloadObj.date === "string" ? new Date(payloadObj.date) : new Date(),
        equipmentName: typeof payloadObj.equipmentName === "string" ? payloadObj.equipmentName : row.entityId,
        hoursUsed: Number(payloadObj.hoursUsed || 0),
        operatorName: typeof payloadObj.operatorName === "string" ? payloadObj.operatorName : "System",
        fuelConsumption: payloadObj.fuelConsumption == null ? null : Number(payloadObj.fuelConsumption || 0),
        costPerHour: Number(payloadObj.costPerHour || 0),
        status: typeof payloadObj.status === "string" ? payloadObj.status : "Logged",
        notes: typeof payloadObj.notes === "string" ? payloadObj.notes : null,
      },
      update: {
        assetId,
        projectId,
        tanggal: typeof payloadObj.date === "string" ? new Date(payloadObj.date) : new Date(),
        equipmentName: typeof payloadObj.equipmentName === "string" ? payloadObj.equipmentName : row.entityId,
        hoursUsed: Number(payloadObj.hoursUsed || 0),
        operatorName: typeof payloadObj.operatorName === "string" ? payloadObj.operatorName : "System",
        fuelConsumption: payloadObj.fuelConsumption == null ? null : Number(payloadObj.fuelConsumption || 0),
        costPerHour: Number(payloadObj.costPerHour || 0),
        status: typeof payloadObj.status === "string" ? payloadObj.status : "Logged",
        notes: typeof payloadObj.notes === "string" ? payloadObj.notes : null,
      },
    });
    upserted += 1;
  }

  return { resource: "fleet-health", total: rows.length, upserted };
}

async function backfillAuditLogsFromAppEntity(): Promise<BackfillResult> {
  const rows = await prisma.appEntity.findMany({
    where: { resource: "audit-logs" },
    select: { entityId: true, payload: true },
  });

  if (rows.length === 0) return { resource: "audit-logs", total: 0, upserted: 0 };

  let upserted = 0;
  for (const row of rows) {
    const payloadObj =
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};

    await prisma.auditLogEntry.upsert({
      where: { id: row.entityId },
      create: {
        id: row.entityId,
        timestamp: typeof payloadObj.timestamp === "string" ? new Date(payloadObj.timestamp) : new Date(),
        actorUserId: typeof payloadObj.actorUserId === "string" ? payloadObj.actorUserId : null,
        actorRole: typeof payloadObj.actorRole === "string" ? payloadObj.actorRole : null,
        userId: typeof payloadObj.userId === "string" ? payloadObj.userId : null,
        userName: typeof payloadObj.userName === "string" ? payloadObj.userName : null,
        action: typeof payloadObj.action === "string" ? payloadObj.action : "SYSTEM_EVENT",
        module: typeof payloadObj.module === "string" ? payloadObj.module : null,
        details: typeof payloadObj.details === "string" ? payloadObj.details : null,
        status: typeof payloadObj.status === "string" ? payloadObj.status : "Success",
        domain: typeof payloadObj.domain === "string" ? payloadObj.domain : null,
        resource: typeof payloadObj.resource === "string" ? payloadObj.resource : null,
        entityId: typeof payloadObj.entityId === "string" ? payloadObj.entityId : null,
        operation: typeof payloadObj.operation === "string" ? payloadObj.operation : null,
        metadata: payloadObj.metadata == null ? null : JSON.stringify(payloadObj.metadata),
      },
      update: {
        timestamp: typeof payloadObj.timestamp === "string" ? new Date(payloadObj.timestamp) : new Date(),
        actorUserId: typeof payloadObj.actorUserId === "string" ? payloadObj.actorUserId : null,
        actorRole: typeof payloadObj.actorRole === "string" ? payloadObj.actorRole : null,
        userId: typeof payloadObj.userId === "string" ? payloadObj.userId : null,
        userName: typeof payloadObj.userName === "string" ? payloadObj.userName : null,
        action: typeof payloadObj.action === "string" ? payloadObj.action : "SYSTEM_EVENT",
        module: typeof payloadObj.module === "string" ? payloadObj.module : null,
        details: typeof payloadObj.details === "string" ? payloadObj.details : null,
        status: typeof payloadObj.status === "string" ? payloadObj.status : "Success",
        domain: typeof payloadObj.domain === "string" ? payloadObj.domain : null,
        resource: typeof payloadObj.resource === "string" ? payloadObj.resource : null,
        entityId: typeof payloadObj.entityId === "string" ? payloadObj.entityId : null,
        operation: typeof payloadObj.operation === "string" ? payloadObj.operation : null,
        metadata: payloadObj.metadata == null ? null : JSON.stringify(payloadObj.metadata),
      },
    });
    upserted += 1;
  }

  return { resource: "audit-logs", total: rows.length, upserted };
}

async function backfillArchiveRegistryFromAppEntity(): Promise<BackfillResult> {
  const rows = await prisma.appEntity.findMany({
    where: { resource: "archive-registry" },
    select: { entityId: true, payload: true },
  });

  if (rows.length === 0) return { resource: "archive-registry", total: 0, upserted: 0 };

  let upserted = 0;
  for (const row of rows) {
    const payloadObj =
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};

    await prisma.archiveRegistryEntry.upsert({
      where: { id: row.entityId },
      create: {
        id: row.entityId,
        tanggal: typeof payloadObj.date === "string" ? new Date(payloadObj.date) : new Date(),
        reference: typeof payloadObj.ref === "string" ? payloadObj.ref : row.entityId,
        description: typeof payloadObj.description === "string" ? payloadObj.description : row.entityId,
        amount: Number(payloadObj.amount || 0),
        projectName: typeof payloadObj.project === "string" ? payloadObj.project : "-",
        adminName: typeof payloadObj.admin === "string" ? payloadObj.admin : "System",
        type: typeof payloadObj.type === "string" ? payloadObj.type : "BK",
        source: typeof payloadObj.source === "string" ? payloadObj.source : "backfill",
      },
      update: {
        tanggal: typeof payloadObj.date === "string" ? new Date(payloadObj.date) : new Date(),
        reference: typeof payloadObj.ref === "string" ? payloadObj.ref : row.entityId,
        description: typeof payloadObj.description === "string" ? payloadObj.description : row.entityId,
        amount: Number(payloadObj.amount || 0),
        projectName: typeof payloadObj.project === "string" ? payloadObj.project : "-",
        adminName: typeof payloadObj.admin === "string" ? payloadObj.admin : "System",
        type: typeof payloadObj.type === "string" ? payloadObj.type : "BK",
        source: typeof payloadObj.source === "string" ? payloadObj.source : "backfill",
      },
    });
    upserted += 1;
  }

  return { resource: "archive-registry", total: rows.length, upserted };
}

async function backfillVendorsFromAppEntity(): Promise<BackfillResult> {
  const rows = await prisma.appEntity.findMany({
    where: { resource: "vendors" },
    select: { entityId: true, payload: true },
  });
  if (rows.length === 0) return { resource: "vendors", total: 0, upserted: 0 };
  let upserted = 0;
  for (const row of rows) {
    const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
    await prisma.vendorRecord.upsert({
      where: { id: row.entityId },
      create: {
        id: row.entityId,
        kodeVendor: typeof payload.kodeVendor === "string" ? payload.kodeVendor : row.entityId,
        namaVendor: typeof payload.namaVendor === "string" ? payload.namaVendor : row.entityId,
        kategori: typeof payload.kategori === "string" ? payload.kategori : null,
        alamat: typeof payload.alamat === "string" ? payload.alamat : null,
        kota: typeof payload.kota === "string" ? payload.kota : null,
        kontak: typeof payload.kontak === "string" ? payload.kontak : null,
        telepon: typeof payload.telepon === "string" ? payload.telepon : null,
        email: typeof payload.email === "string" ? payload.email : null,
        npwp: typeof payload.npwp === "string" ? payload.npwp : null,
        paymentTerms: typeof payload.paymentTerms === "string" ? payload.paymentTerms : null,
        rating: payload.rating == null ? null : Number(payload.rating || 0),
        status: typeof payload.status === "string" ? payload.status : "Active",
      },
      update: {
        kodeVendor: typeof payload.kodeVendor === "string" ? payload.kodeVendor : row.entityId,
        namaVendor: typeof payload.namaVendor === "string" ? payload.namaVendor : row.entityId,
        kategori: typeof payload.kategori === "string" ? payload.kategori : null,
        alamat: typeof payload.alamat === "string" ? payload.alamat : null,
        kota: typeof payload.kota === "string" ? payload.kota : null,
        kontak: typeof payload.kontak === "string" ? payload.kontak : null,
        telepon: typeof payload.telepon === "string" ? payload.telepon : null,
        email: typeof payload.email === "string" ? payload.email : null,
        npwp: typeof payload.npwp === "string" ? payload.npwp : null,
        paymentTerms: typeof payload.paymentTerms === "string" ? payload.paymentTerms : null,
        rating: payload.rating == null ? null : Number(payload.rating || 0),
        status: typeof payload.status === "string" ? payload.status : "Active",
      },
    });
    upserted += 1;
  }
  return { resource: "vendors", total: rows.length, upserted };
}

async function backfillCustomersFromAppEntity(): Promise<BackfillResult> {
  const rows = await prisma.appEntity.findMany({
    where: { resource: "customers" },
    select: { entityId: true, payload: true },
  });
  if (rows.length === 0) return { resource: "customers", total: 0, upserted: 0 };
  let upserted = 0;
  for (const row of rows) {
    const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
    await prisma.customerRecord.upsert({
      where: { id: row.entityId },
      create: {
        id: row.entityId,
        kodeCustomer: typeof payload.kodeCustomer === "string" ? payload.kodeCustomer : row.entityId,
        namaCustomer: typeof payload.namaCustomer === "string" ? payload.namaCustomer : row.entityId,
        alamat: typeof payload.alamat === "string" ? payload.alamat : null,
        kota: typeof payload.kota === "string" ? payload.kota : null,
        kontak: typeof payload.kontak === "string" ? payload.kontak : null,
        telepon: typeof payload.telepon === "string" ? payload.telepon : null,
        email: typeof payload.email === "string" ? payload.email : null,
        npwp: typeof payload.npwp === "string" ? payload.npwp : null,
        paymentTerms: typeof payload.paymentTerms === "string" ? payload.paymentTerms : null,
        rating: payload.rating == null ? null : Number(payload.rating || 0),
        status: typeof payload.status === "string" ? payload.status : "Active",
      },
      update: {
        kodeCustomer: typeof payload.kodeCustomer === "string" ? payload.kodeCustomer : row.entityId,
        namaCustomer: typeof payload.namaCustomer === "string" ? payload.namaCustomer : row.entityId,
        alamat: typeof payload.alamat === "string" ? payload.alamat : null,
        kota: typeof payload.kota === "string" ? payload.kota : null,
        kontak: typeof payload.kontak === "string" ? payload.kontak : null,
        telepon: typeof payload.telepon === "string" ? payload.telepon : null,
        email: typeof payload.email === "string" ? payload.email : null,
        npwp: typeof payload.npwp === "string" ? payload.npwp : null,
        paymentTerms: typeof payload.paymentTerms === "string" ? payload.paymentTerms : null,
        rating: payload.rating == null ? null : Number(payload.rating || 0),
        status: typeof payload.status === "string" ? payload.status : "Active",
      },
    });
    upserted += 1;
  }
  return { resource: "customers", total: rows.length, upserted };
}

async function main() {
  console.log("Start backfill AppEntity -> Dedicated tables");

  const resources = Object.entries(RESOURCE_TO_DELEGATE);
  const results: BackfillResult[] = [];

  for (const [resource, delegateName] of resources) {
    const result = await backfillResource(resource, delegateName);
    results.push(result);
  }

  results.push(await backfillProjectsFromAppEntity());
  results.push(await backfillFleetHealthFromAppEntity());
  results.push(await backfillAuditLogsFromAppEntity());
  results.push(await backfillArchiveRegistryFromAppEntity());
  results.push(await backfillVendorsFromAppEntity());
  results.push(await backfillCustomersFromAppEntity());

  const migrated = results.reduce((sum, item) => sum + item.upserted, 0);
  const touched = results.filter((item) => item.total > 0).length;

  console.table(results);
  console.log(`Backfill selesai. Total rows upserted: ${migrated}. Resource terisi: ${touched}/${results.length}`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
