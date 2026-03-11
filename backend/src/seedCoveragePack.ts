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
  "spk-records": "spkRecord",
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
  "app-settings": "appSettingRecord",
};

type UpsertDelegate = {
  upsert: (args: {
    where: { id: string };
    create: { id: string; payload: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull };
    update: { payload: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull };
  }) => Promise<unknown>;
};

function asJson(payload: Record<string, unknown>): Prisma.InputJsonValue {
  return payload as Prisma.InputJsonValue;
}

async function upsertDataResource(resource: string, id: string, payload: Record<string, unknown>) {
  const jsonPayload = asJson(payload);

  if (resource === "assets") {
    await prisma.assetRecord.upsert({
      where: { id },
      update: {
        projectId: typeof payload.projectId === "string" ? payload.projectId : null,
        assetCode: typeof payload.assetCode === "string" ? payload.assetCode : id,
        name: typeof payload.name === "string" ? payload.name : id,
        category: typeof payload.category === "string" ? payload.category : "General",
        location: typeof payload.location === "string" ? payload.location : "Unknown",
        status: typeof payload.status === "string" ? payload.status : "Available",
        condition: typeof payload.condition === "string" ? payload.condition : "Good",
        purchaseDate: typeof payload.purchaseDate === "string" ? payload.purchaseDate : null,
        purchasePrice: payload.purchasePrice == null ? null : Number(payload.purchasePrice || 0),
        rentalPrice: payload.rentalPrice == null ? null : Number(payload.rentalPrice || 0),
        lastMaintenance: typeof payload.lastMaintenance === "string" ? payload.lastMaintenance : null,
        nextMaintenance: typeof payload.nextMaintenance === "string" ? payload.nextMaintenance : null,
        operatorName: typeof payload.operatorName === "string" ? payload.operatorName : null,
        projectName: typeof payload.projectName === "string" ? payload.projectName : null,
        rentedTo: typeof payload.rentedTo === "string" ? payload.rentedTo : null,
        notes: typeof payload.notes === "string" ? payload.notes : null,
      },
      create: {
        id,
        projectId: typeof payload.projectId === "string" ? payload.projectId : null,
        assetCode: typeof payload.assetCode === "string" ? payload.assetCode : id,
        name: typeof payload.name === "string" ? payload.name : id,
        category: typeof payload.category === "string" ? payload.category : "General",
        location: typeof payload.location === "string" ? payload.location : "Unknown",
        status: typeof payload.status === "string" ? payload.status : "Available",
        condition: typeof payload.condition === "string" ? payload.condition : "Good",
        purchaseDate: typeof payload.purchaseDate === "string" ? payload.purchaseDate : null,
        purchasePrice: payload.purchasePrice == null ? null : Number(payload.purchasePrice || 0),
        rentalPrice: payload.rentalPrice == null ? null : Number(payload.rentalPrice || 0),
        lastMaintenance: typeof payload.lastMaintenance === "string" ? payload.lastMaintenance : null,
        nextMaintenance: typeof payload.nextMaintenance === "string" ? payload.nextMaintenance : null,
        operatorName: typeof payload.operatorName === "string" ? payload.operatorName : null,
        projectName: typeof payload.projectName === "string" ? payload.projectName : null,
        rentedTo: typeof payload.rentedTo === "string" ? payload.rentedTo : null,
        notes: typeof payload.notes === "string" ? payload.notes : null,
      },
    });
    return;
  }

  if (resource === "maintenances") {
    await prisma.maintenanceRecord.upsert({
      where: { id },
      update: {
        assetId: typeof payload.assetId === "string" ? payload.assetId : null,
        projectId: typeof payload.projectId === "string" ? payload.projectId : null,
        maintenanceNo: typeof payload.maintenanceNo === "string" ? payload.maintenanceNo : id,
        assetCode: typeof payload.assetCode === "string" ? payload.assetCode : null,
        equipmentName: typeof payload.equipmentName === "string" ? payload.equipmentName : id,
        maintenanceType: typeof payload.maintenanceType === "string" ? payload.maintenanceType : "Routine",
        scheduledDate: typeof payload.scheduledDate === "string" ? payload.scheduledDate : null,
        completedDate: typeof payload.completedDate === "string" ? payload.completedDate : null,
        status: typeof payload.status === "string" ? payload.status : "Scheduled",
        cost: payload.cost == null ? null : Number(payload.cost || 0),
        performedBy: typeof payload.performedBy === "string" ? payload.performedBy : null,
        notes: typeof payload.notes === "string" ? payload.notes : null,
      },
      create: {
        id,
        assetId: typeof payload.assetId === "string" ? payload.assetId : null,
        projectId: typeof payload.projectId === "string" ? payload.projectId : null,
        maintenanceNo: typeof payload.maintenanceNo === "string" ? payload.maintenanceNo : id,
        assetCode: typeof payload.assetCode === "string" ? payload.assetCode : null,
        equipmentName: typeof payload.equipmentName === "string" ? payload.equipmentName : id,
        maintenanceType: typeof payload.maintenanceType === "string" ? payload.maintenanceType : "Routine",
        scheduledDate: typeof payload.scheduledDate === "string" ? payload.scheduledDate : null,
        completedDate: typeof payload.completedDate === "string" ? payload.completedDate : null,
        status: typeof payload.status === "string" ? payload.status : "Scheduled",
        cost: payload.cost == null ? null : Number(payload.cost || 0),
        performedBy: typeof payload.performedBy === "string" ? payload.performedBy : null,
        notes: typeof payload.notes === "string" ? payload.notes : null,
      },
    });
    return;
  }

  if (resource === "invoices") {
    const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
    const items = itemsRaw.map((item) => (item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {}));
    const subtotal = typeof payload.subtotal === "number" ? payload.subtotal : Number(payload.subtotal || payload.amount || payload.totalBayar || 0);
    const ppn = typeof payload.ppn === "number" ? payload.ppn : Number(payload.ppn || 0);
    const totalBayar = typeof payload.totalBayar === "number" ? payload.totalBayar : Number(payload.totalBayar || payload.amount || subtotal || 0);
    const paidAmount = typeof payload.paidAmount === "number" ? payload.paidAmount : Number(payload.paidAmount || 0);
    await prisma.invoiceRecord.upsert({
      where: { id },
      update: {
        projectId: typeof payload.projectId === "string" ? payload.projectId : null,
        customerId: typeof payload.customerId === "string" ? payload.customerId : null,
        noInvoice: typeof payload.noInvoice === "string" ? payload.noInvoice : typeof payload.invoiceNumber === "string" ? payload.invoiceNumber : id,
        tanggal: typeof payload.tanggal === "string" ? payload.tanggal : typeof payload.issuedDate === "string" ? payload.issuedDate : new Date().toISOString().slice(0, 10),
        jatuhTempo: typeof payload.jatuhTempo === "string" ? payload.jatuhTempo : typeof payload.dueDate === "string" ? payload.dueDate : new Date().toISOString().slice(0, 10),
        customer: typeof payload.customer === "string" ? payload.customer : typeof payload.customerName === "string" ? payload.customerName : "-",
        customerName: typeof payload.customerName === "string" ? payload.customerName : typeof payload.customer === "string" ? payload.customer : null,
        alamat: typeof payload.alamat === "string" ? payload.alamat : "",
        noPO: typeof payload.noPO === "string" ? payload.noPO : "",
        subtotal,
        ppn,
        totalBayar,
        paidAmount,
        outstandingAmount: typeof payload.outstandingAmount === "number" ? payload.outstandingAmount : Math.max(0, totalBayar - paidAmount),
        status: typeof payload.status === "string" ? payload.status : "Unpaid",
        projectName: typeof payload.projectName === "string" ? payload.projectName : null,
        noFakturPajak: typeof payload.noFakturPajak === "string" ? payload.noFakturPajak : null,
        perihal: typeof payload.perihal === "string" ? payload.perihal : null,
        termin: typeof payload.termin === "string" ? payload.termin : null,
        buktiTransfer: typeof payload.buktiTransfer === "string" ? payload.buktiTransfer : null,
        noKwitansi: typeof payload.noKwitansi === "string" ? payload.noKwitansi : null,
        tanggalBayar: typeof payload.tanggalBayar === "string" ? payload.tanggalBayar : null,
      },
      create: {
        id,
        projectId: typeof payload.projectId === "string" ? payload.projectId : null,
        customerId: typeof payload.customerId === "string" ? payload.customerId : null,
        noInvoice: typeof payload.noInvoice === "string" ? payload.noInvoice : typeof payload.invoiceNumber === "string" ? payload.invoiceNumber : id,
        tanggal: typeof payload.tanggal === "string" ? payload.tanggal : typeof payload.issuedDate === "string" ? payload.issuedDate : new Date().toISOString().slice(0, 10),
        jatuhTempo: typeof payload.jatuhTempo === "string" ? payload.jatuhTempo : typeof payload.dueDate === "string" ? payload.dueDate : new Date().toISOString().slice(0, 10),
        customer: typeof payload.customer === "string" ? payload.customer : typeof payload.customerName === "string" ? payload.customerName : "-",
        customerName: typeof payload.customerName === "string" ? payload.customerName : typeof payload.customer === "string" ? payload.customer : null,
        alamat: typeof payload.alamat === "string" ? payload.alamat : "",
        noPO: typeof payload.noPO === "string" ? payload.noPO : "",
        subtotal,
        ppn,
        totalBayar,
        paidAmount,
        outstandingAmount: typeof payload.outstandingAmount === "number" ? payload.outstandingAmount : Math.max(0, totalBayar - paidAmount),
        status: typeof payload.status === "string" ? payload.status : "Unpaid",
        projectName: typeof payload.projectName === "string" ? payload.projectName : null,
        noFakturPajak: typeof payload.noFakturPajak === "string" ? payload.noFakturPajak : null,
        perihal: typeof payload.perihal === "string" ? payload.perihal : null,
        termin: typeof payload.termin === "string" ? payload.termin : null,
        buktiTransfer: typeof payload.buktiTransfer === "string" ? payload.buktiTransfer : null,
        noKwitansi: typeof payload.noKwitansi === "string" ? payload.noKwitansi : null,
        tanggalBayar: typeof payload.tanggalBayar === "string" ? payload.tanggalBayar : null,
      },
    });
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
    if (items.length > 0) {
      await prisma.invoiceItem.createMany({
        data: items.map((item, idx) => ({
          id: `${id}-item-${idx + 1}`,
          invoiceId: id,
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
    return;
  }

  if (resource === "fleet-health") {
    const assetId = typeof payload.assetId === "string" ? payload.assetId : typeof payload.equipmentId === "string" ? payload.equipmentId : null;
    const projectId = typeof payload.projectId === "string" ? payload.projectId : null;
    if (!assetId || !projectId) {
      throw new Error("fleet-health seed membutuhkan assetId dan projectId");
    }

    await prisma.fleetHealthEntry.upsert({
      where: { id },
      update: {
        assetId,
        projectId,
        tanggal: typeof payload.date === "string" ? new Date(payload.date) : new Date(),
        equipmentName: typeof payload.equipmentName === "string" ? payload.equipmentName : id,
        hoursUsed: Number(payload.hoursUsed || 0),
        operatorName: typeof payload.operatorName === "string" ? payload.operatorName : "System",
        fuelConsumption: payload.fuelConsumption == null ? null : Number(payload.fuelConsumption || 0),
        costPerHour: Number(payload.costPerHour || 0),
        status: typeof payload.status === "string" ? payload.status : "Logged",
        notes: typeof payload.notes === "string" ? payload.notes : null,
      },
      create: {
        id,
        assetId,
        projectId,
        tanggal: typeof payload.date === "string" ? new Date(payload.date) : new Date(),
        equipmentName: typeof payload.equipmentName === "string" ? payload.equipmentName : id,
        hoursUsed: Number(payload.hoursUsed || 0),
        operatorName: typeof payload.operatorName === "string" ? payload.operatorName : "System",
        fuelConsumption: payload.fuelConsumption == null ? null : Number(payload.fuelConsumption || 0),
        costPerHour: Number(payload.costPerHour || 0),
        status: typeof payload.status === "string" ? payload.status : "Logged",
        notes: typeof payload.notes === "string" ? payload.notes : null,
      },
    });
    return;
  }

  if (resource === "audit-logs") {
    await prisma.auditLogEntry.upsert({
      where: { id },
      update: {
        timestamp: typeof payload.timestamp === "string" ? new Date(payload.timestamp) : new Date(),
        actorUserId: typeof payload.actorUserId === "string" ? payload.actorUserId : null,
        actorRole: typeof payload.actorRole === "string" ? payload.actorRole : null,
        userId: typeof payload.userId === "string" ? payload.userId : null,
        userName: typeof payload.userName === "string" ? payload.userName : null,
        action: typeof payload.action === "string" ? payload.action : "SYSTEM_EVENT",
        module: typeof payload.module === "string" ? payload.module : null,
        details: typeof payload.details === "string" ? payload.details : null,
        status: typeof payload.status === "string" ? payload.status : "Success",
        domain: typeof payload.domain === "string" ? payload.domain : null,
        resource: typeof payload.resource === "string" ? payload.resource : null,
        entityId: typeof payload.entityId === "string" ? payload.entityId : null,
        operation: typeof payload.operation === "string" ? payload.operation : null,
        metadata: payload.metadata == null ? null : JSON.stringify(payload.metadata),
      },
      create: {
        id,
        timestamp: typeof payload.timestamp === "string" ? new Date(payload.timestamp) : new Date(),
        actorUserId: typeof payload.actorUserId === "string" ? payload.actorUserId : null,
        actorRole: typeof payload.actorRole === "string" ? payload.actorRole : null,
        userId: typeof payload.userId === "string" ? payload.userId : null,
        userName: typeof payload.userName === "string" ? payload.userName : null,
        action: typeof payload.action === "string" ? payload.action : "SYSTEM_EVENT",
        module: typeof payload.module === "string" ? payload.module : null,
        details: typeof payload.details === "string" ? payload.details : null,
        status: typeof payload.status === "string" ? payload.status : "Success",
        domain: typeof payload.domain === "string" ? payload.domain : null,
        resource: typeof payload.resource === "string" ? payload.resource : null,
        entityId: typeof payload.entityId === "string" ? payload.entityId : null,
        operation: typeof payload.operation === "string" ? payload.operation : null,
        metadata: payload.metadata == null ? null : JSON.stringify(payload.metadata),
      },
    });
    return;
  }

  if (resource === "archive-registry") {
    await prisma.archiveRegistryEntry.upsert({
      where: { id },
      update: {
        tanggal: typeof payload.date === "string" ? new Date(payload.date) : new Date(),
        reference: typeof payload.ref === "string" ? payload.ref : id,
        description: typeof payload.description === "string" ? payload.description : id,
        amount: Number(payload.amount || 0),
        projectName: typeof payload.project === "string" ? payload.project : "-",
        adminName: typeof payload.admin === "string" ? payload.admin : "System",
        type: typeof payload.type === "string" ? payload.type : "BK",
        source: typeof payload.source === "string" ? payload.source : "seed",
      },
      create: {
        id,
        tanggal: typeof payload.date === "string" ? new Date(payload.date) : new Date(),
        reference: typeof payload.ref === "string" ? payload.ref : id,
        description: typeof payload.description === "string" ? payload.description : id,
        amount: Number(payload.amount || 0),
        projectName: typeof payload.project === "string" ? payload.project : "-",
        adminName: typeof payload.admin === "string" ? payload.admin : "System",
        type: typeof payload.type === "string" ? payload.type : "BK",
        source: typeof payload.source === "string" ? payload.source : "seed",
      },
    });
    return;
  }

  if (resource === "vendors") {
    await prisma.vendorRecord.upsert({
      where: { id },
      update: {
        kodeVendor: typeof payload.kodeVendor === "string" ? payload.kodeVendor : id,
        namaVendor: typeof payload.namaVendor === "string" ? payload.namaVendor : id,
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
      create: {
        id,
        kodeVendor: typeof payload.kodeVendor === "string" ? payload.kodeVendor : id,
        namaVendor: typeof payload.namaVendor === "string" ? payload.namaVendor : id,
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
    return;
  }

  if (resource === "customers") {
    await prisma.customerRecord.upsert({
      where: { id },
      update: {
        kodeCustomer: typeof payload.kodeCustomer === "string" ? payload.kodeCustomer : id,
        namaCustomer: typeof payload.namaCustomer === "string" ? payload.namaCustomer : id,
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
      create: {
        id,
        kodeCustomer: typeof payload.kodeCustomer === "string" ? payload.kodeCustomer : id,
        namaCustomer: typeof payload.namaCustomer === "string" ? payload.namaCustomer : id,
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
    return;
  }

  await prisma.appEntity.upsert({
    where: {
      resource_entityId: {
        resource,
        entityId: id,
      },
    },
    update: {
      payload: jsonPayload,
    },
    create: {
      resource,
      entityId: id,
      payload: jsonPayload,
    },
  });

  if (resource === "projects") {
    const quotationId = typeof payload.quotationId === "string" ? payload.quotationId : null;
    const customerId = typeof payload.customerId === "string" ? payload.customerId : null;
    await prisma.projectRecord.upsert({
      where: { id },
      update: {
        payload: jsonPayload,
        quotationId,
        customerId,
      },
      create: {
        id,
        payload: jsonPayload,
        quotationId,
        customerId,
      },
    });
    return;
  }

  const delegateName = RESOURCE_TO_DELEGATE[resource];
  if (!delegateName) return;

  const delegate = (prisma as unknown as Record<string, unknown>)[delegateName] as UpsertDelegate | undefined;
  if (!delegate || typeof delegate.upsert !== "function") return;

  await delegate.upsert({
    where: { id },
    update: { payload: jsonPayload },
    create: { id, payload: jsonPayload },
  });
}

async function main() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const nowIso = now.toISOString();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const ids = {
    dataCollection: "DC-UAT-2026-0001",
    quotation: "QUO-UAT-2026-0001",
    project: "PRJ-UAT-2026-0001",
    customer: "CST-UAT-2026-0001",
    vendor: "VDR-UAT-2026-0001",
    employee: "EMP-UAT-2026-0001",
    po: "PO-UAT-2026-0001",
    receiving: "RCV-UAT-2026-0001",
    wo: "WO-UAT-2026-0001",
    stockItem: "STK-UAT-2026-0001",
    stockIn: "SI-UAT-2026-0001",
    stockOut: "SO-UAT-2026-0001",
    stockMove: "SM-UAT-2026-0001",
    stockOpname: "SOP-UAT-2026-0001",
    suratJalan: "SJ-UAT-2026-0001",
    spk: "SPK-UAT-2026-0001",
    materialReq: "MR-UAT-2026-0001",
    invoice: "INV-UAT-2026-0001",
    productionReport: "PRD-UAT-2026-0001",
    productionTracker: "TRK-UAT-2026-0001",
    qc: "QC-UAT-2026-0001",
    attendance: "ATT-UAT-2026-0001",
    leave: "LV-UAT-2026-0001",
    online: "ONLINE-UAT-2026-0001",
    shift: "SHIFT-UAT-2026-0001",
    shiftSchedule: "SHS-UAT-2026-0001",
    attendanceSummary: "ATS-UAT-2026-0001",
    performanceReview: "PRV-UAT-2026-0001",
    thlContract: "THL-UAT-2026-0001",
    resignation: "RSG-UAT-2026-0001",
    expenseSheet: "BK-UAT-2026-0001",
    financeBpjs: "BPJS-UAT-2026-0001",
    financePph21: "PPH21-UAT-2026-0001",
    financeThr: "THR-UAT-2026-0001",
    financeAllowance: "ALLW-UAT-2026-0001",
    financePoPayment: "FPOP-UAT-2026-0001",
    bankRecon: "BREC-UAT-2026-0001",
    petty: "PETTY-UAT-2026-0001",
    beritaAcara: "BA-UAT-2026-0001",
    suratMasuk: "SMK-UAT-2026-0001",
    suratKeluar: "SKR-UAT-2026-0001",
    template: "TPL-UAT-2026-0001",
    asset: "AST-UAT-2026-0001",
    maintenance: "MNT-UAT-2026-0001",
    payroll: "PAY-UAT-2026-0001",
    archive: "ARC-UAT-2026-0001",
    audit: "AUD-UAT-2026-0001",
    vendorExpense: "VEX-UAT-2026-0001",
    vendorInvoice: "VIN-UAT-2026-0001",
    customerInvoice: "CIN-UAT-2026-0001",
    kasbon: "KSB-UAT-2026-0001",
    fleet: "FLT-UAT-2026-0001",
    pod: "POD-UAT-2026-0001",
    appSetting: "APPSET-UAT-2026-0001",
  };

  await prisma.dataCollection.upsert({
    where: { id: ids.dataCollection },
    update: {
      namaResponden: "Bpk. Alois",
      lokasi: "JAKSEL",
      tipePekerjaan: "Repair Furnace Boiler",
      status: "Completed",
      tanggalSurvey: today,
      payload: asJson({
        id: ids.dataCollection,
        status: "Completed",
        namaResponden: "Bpk. Alois",
        namaProyek: "Penawaran Repair Furnace Boiler",
        customer: "PT Asahimas Indonesia",
        lokasi: "JAKSEL",
        tipePekerjaan: "Repair Furnace Boiler",
        date: today,
      }),
    },
    create: {
      id: ids.dataCollection,
      namaResponden: "Bpk. Alois",
      lokasi: "JAKSEL",
      tipePekerjaan: "Repair Furnace Boiler",
      status: "Completed",
      tanggalSurvey: today,
      payload: asJson({
        id: ids.dataCollection,
        status: "Completed",
        namaResponden: "Bpk. Alois",
        namaProyek: "Penawaran Repair Furnace Boiler",
        customer: "PT Asahimas Indonesia",
        lokasi: "JAKSEL",
        tipePekerjaan: "Repair Furnace Boiler",
        date: today,
      }),
    },
  });

  await prisma.quotation.upsert({
    where: { id: ids.quotation },
    update: {
      noPenawaran: "QUO/GTP/UAT/2026/0001",
      tanggal: today,
      status: "Approved",
      kepada: "Bpk. Alois",
      perihal: "Penawaran Repair Furnace Boiler",
      grandTotal: 175164820889,
      dataCollectionId: ids.dataCollection,
      payload: asJson({
        id: ids.quotation,
        noPenawaran: "QUO/GTP/UAT/2026/0001",
        tanggal: today,
        status: "Approved",
        kepada: "Bpk. Alois",
        perusahaan: "PT Asahimas Indonesia",
        lokasi: "JAKSEL",
        perihal: "Penawaran Repair Furnace Boiler",
        sourceType: "from-survey",
        dataCollectionId: ids.dataCollection,
        grandTotal: 175164820889,
      }),
    },
    create: {
      id: ids.quotation,
      noPenawaran: "QUO/GTP/UAT/2026/0001",
      tanggal: today,
      status: "Approved",
      kepada: "Bpk. Alois",
      perihal: "Penawaran Repair Furnace Boiler",
      grandTotal: 175164820889,
      dataCollectionId: ids.dataCollection,
      payload: asJson({
        id: ids.quotation,
        noPenawaran: "QUO/GTP/UAT/2026/0001",
        tanggal: today,
        status: "Approved",
        kepada: "Bpk. Alois",
        perusahaan: "PT Asahimas Indonesia",
        lokasi: "JAKSEL",
        perihal: "Penawaran Repair Furnace Boiler",
        sourceType: "from-survey",
        dataCollectionId: ids.dataCollection,
        grandTotal: 175164820889,
      }),
    },
  });

  await upsertDataResource("customers", ids.customer, {
    id: ids.customer,
    namaCustomer: "PT Asahimas Indonesia",
    pic: "Bpk. Alois",
    phone: "081261296172",
    email: "procurement@asahimas.co.id",
    alamat: "JAKSEL",
    status: "Active",
  });

  await upsertDataResource("vendors", ids.vendor, {
    id: ids.vendor,
    namaVendor: "PT Gemilang Mitra Abadi",
    pic: "Andri",
    phone: "081234567890",
    email: "sales@gemilang.co.id",
    alamat: "Bekasi",
    status: "Active",
  });

  await upsertDataResource("projects", ids.project, {
    id: ids.project,
    kodeProject: ids.project,
    namaProject: "Penawaran Repair Furnace Boiler",
    customer: "Bpk. Alois",
    customerId: ids.customer,
    nilaiKontrak: 175164820889,
    status: "Planning",
    progress: 20,
    endDate: "2026-12-31",
    quotationId: ids.quotation,
    approvalStatus: "Approved",
    approvedBy: "System Seed",
    approvedAt: nowIso,
  });

  await upsertDataResource("employees", ids.employee, {
    id: ids.employee,
    employeeId: "KRY-UAT-0001",
    name: "AJI TEJA PRATAMA",
    position: "Mandor",
    department: "PRODUKSI",
    employmentType: "THL",
    joinDate: "2025-01-10",
    email: "aji.teja@example.com",
    phone: "082161296172",
    address: "Purwakarta",
    emergencyContact: "ELIS SUPRIYATI",
    emergencyPhone: "082161296172",
    salary: 6500000,
    status: "Active",
    identityType: "KTP",
    identityNumber: "3216062904950023",
    familyStatusCode: "K/1",
    gender: "L",
    birthDate: "1995-04-29",
    birthPlace: "Tasikmalaya",
    motherName: "ELIS SUPRIYATI",
    occupationTypeCode: "10",
    occupationName: "MANDOR",
    startWorkDate: "2025-01-10",
  });

  await upsertDataResource("purchase-orders", ids.po, {
    id: ids.po,
    noPO: "PO/GTP/UAT/2026/0001",
    tanggal: today,
    supplier: "PT Gemilang Mitra Abadi",
    total: 35000000,
    status: "Approved",
    projectId: ids.project,
    items: [{ id: "POI-1", kode: "MAT-001", nama: "BLANKET 25MM", qty: 20, unit: "Roll", unitPrice: 1750000, total: 35000000 }],
  });

  await upsertDataResource("receivings", ids.receiving, {
    id: ids.receiving,
    noReceiving: "RCV/GTP/UAT/2026/0001",
    noSuratJalan: "SJ/GTP/UAT/2026/0001",
    tanggal: today,
    noPO: "PO/GTP/UAT/2026/0001",
    poId: ids.po,
    supplier: "PT Gemilang Mitra Abadi",
    projectId: ids.project,
    project: "Penawaran Repair Furnace Boiler",
    status: "Complete",
    items: [{ id: "RCI-1", itemKode: "MAT-001", itemName: "BLANKET 25MM", unit: "Roll", qtyReceived: 20, qtyGood: 20 }],
  });

  await upsertDataResource("work-orders", ids.wo, {
    id: ids.wo,
    woNumber: "WO-UAT-1772880911761",
    projectId: ids.project,
    projectName: "Penawaran Repair Furnace Boiler",
    itemToProduce: "INSTALL INSULATION",
    targetQty: 10,
    completedQty: 2,
    workflowStatus: "IN_PROGRESS",
    status: "In Progress",
    priority: "High",
    deadline: "2026-03-31",
    leadTechnician: "AJI TEJA PRATAMA",
    bom: [{ kode: "MAT-001", nama: "BLANKET 25MM", qty: 10, unit: "Roll" }],
  });

  await upsertDataResource("stock-items", ids.stockItem, {
    id: ids.stockItem,
    kode: "MAT-001",
    nama: "BLANKET 25MM",
    stok: 20,
    satuan: "Roll",
    kategori: "Material",
    minStock: 5,
    hargaSatuan: 1750000,
    supplier: "PT Gemilang Mitra Abadi",
    lokasi: "Gudang Utama",
    shelfLifeDays: 365,
    fefoBatch: "BATCH-UAT-01",
  });

  await upsertDataResource("stock-ins", ids.stockIn, {
    id: ids.stockIn,
    noStockIn: "SI/GTP/UAT/2026/0001",
    tanggal: today,
    type: "Receiving",
    status: "Posted",
    createdBy: "System Seed",
    noPO: "PO/GTP/UAT/2026/0001",
    poId: ids.po,
    projectId: ids.project,
    items: [{ kode: "MAT-001", nama: "BLANKET 25MM", qty: 20, satuan: "Roll" }],
  });

  await upsertDataResource("stock-outs", ids.stockOut, {
    id: ids.stockOut,
    noStockOut: "SO/GTP/UAT/2026/0001",
    projectId: ids.project,
    workOrderId: ids.wo,
    penerima: "Site Team JAKSEL",
    tanggal: today,
    type: "Project Issue",
    status: "Posted",
    createdBy: "System Seed",
    items: [{ kode: "MAT-001", nama: "BLANKET 25MM", qty: 2, satuan: "Roll" }],
  });

  await upsertDataResource("stock-movements", ids.stockMove, {
    id: ids.stockMove,
    tanggal: today,
    type: "OUT",
    refNo: "SO/GTP/UAT/2026/0001",
    refType: "Stock Out",
    itemKode: "MAT-001",
    itemNama: "BLANKET 25MM",
    qty: 2,
    unit: "Roll",
    lokasi: "Gudang Utama",
    stockBefore: 20,
    stockAfter: 18,
    createdBy: "System Seed",
    projectId: ids.project,
    projectName: "Penawaran Repair Furnace Boiler",
  });

  await upsertDataResource("stock-opnames", ids.stockOpname, {
    id: ids.stockOpname,
    tanggal: today,
    lokasi: "Gudang Utama",
    auditor: "System Seed",
    status: "Closed",
    items: [{ itemKode: "MAT-001", itemNama: "BLANKET 25MM", stockSystem: 18, stockActual: 18, variance: 0 }],
  });

  await upsertDataResource("surat-jalan", ids.suratJalan, {
    id: ids.suratJalan,
    noSurat: "SJ/GTP/UAT/2026/0001",
    tanggal: today,
    sjType: "Material Delivery",
    tujuan: "PT Asahimas Indonesia",
    alamat: "JAKSEL",
    upPerson: "Bpk. Alois",
    noPO: "PO/GTP/UAT/2026/0001",
    projectId: ids.project,
    sopir: "Ujang",
    noPolisi: "B 1234 GTP",
    pengirim: "Gudang GTP",
    items: [{ namaBarang: "BLANKET 25MM", qty: 2, unit: "Roll" }],
    status: "Sent",
  });

  await upsertDataResource("spk-records", ids.spk, {
    id: ids.spk,
    spkNumber: "SPK/GTP/2026/0001",
    projectId: ids.project,
    workOrderId: ids.wo,
    date: today,
    title: "SPK Lembur Instalasi",
    technician: "AJI TEJA PRATAMA",
    status: "Active",
  });

  await upsertDataResource("material-requests", ids.materialReq, {
    id: ids.materialReq,
    requestNo: "MR/GTP/UAT/2026/0001",
    projectId: ids.project,
    projectName: "Penawaran Repair Furnace Boiler",
    requestedBy: "AJI TEJA PRATAMA",
    date: today,
    status: "Approved",
    priority: "High",
    items: [{ kode: "MAT-001", nama: "BLANKET 25MM", qty: 2, unit: "Roll" }],
  });

  await upsertDataResource("invoices", ids.invoice, {
    id: ids.invoice,
    invoiceNumber: "INV/GTP/UAT/2026/0001",
    customer: "PT Asahimas Indonesia",
    customerId: ids.customer,
    amount: 175164820889,
    issuedDate: today,
    dueDate: "2026-04-30",
    status: "Sent",
    projectId: ids.project,
  });

  await upsertDataResource("production-reports", ids.productionReport, {
    id: ids.productionReport,
    tanggal: today,
    shift: "Shift 1",
    outputQty: 2,
    rejectQty: 0,
    efficiency: 95,
    notes: "Produksi sesuai rencana",
    projectId: ids.project,
    workOrderId: ids.wo,
  });

  await upsertDataResource("production-trackers", ids.productionTracker, {
    id: ids.productionTracker,
    customer: "PT Asahimas Indonesia",
    itemType: "INSTALL INSULATION",
    qty: 10,
    startDate: today,
    finishDate: "2026-03-31",
    status: "On Track",
    projectId: ids.project,
    workOrderId: ids.wo,
  });

  await upsertDataResource("qc-inspections", ids.qc, {
    id: ids.qc,
    tanggal: today,
    batchNo: "BATCH-UAT-01",
    itemNama: "INSTALL INSULATION",
    qtyInspected: 2,
    qtyPassed: 2,
    qtyRejected: 0,
    inspectorName: "Dewi",
    status: "Passed",
    visualCheck: true,
    dimensionCheck: true,
    materialCheck: true,
    projectId: ids.project,
    workOrderId: ids.wo,
  });

  await upsertDataResource("attendances", ids.attendance, {
    id: ids.attendance,
    employeeId: ids.employee,
    employeeName: "AJI TEJA PRATAMA",
    date: today,
    status: "Present",
    checkIn: "07:00",
    checkOut: "17:00",
    workHours: 10,
    overtime: 2,
    location: "JAKSEL",
    projectId: ids.project,
  });

  await upsertDataResource("hr-leaves", ids.leave, {
    id: ids.leave,
    leaveNo: "LV-UAT-202603-001",
    employeeId: ids.employee,
    employeeName: "AJI TEJA PRATAMA",
    leaveType: "Annual",
    startDate: "2026-03-20",
    endDate: "2026-03-21",
    totalDays: 2,
    reason: "Keperluan keluarga",
    status: "Pending",
    notes: "",
  });

  await upsertDataResource("hr-online-status", ids.online, {
    id: ids.online,
    employeeId: ids.employee,
    name: "AJI TEJA PRATAMA",
    position: "Mandor",
    department: "Production",
    status: "online",
    lastSeen: nowIso,
    location: "JAKSEL",
    activeMinutes: 45,
    email: "aji.teja@example.com",
    phone: "082161296172",
  });

  await upsertDataResource("hr-shifts", ids.shift, {
    id: ids.shift,
    shiftCode: "SHIFT-1",
    shiftName: "Shift 1",
    startTime: "07:00",
    endTime: "16:00",
    breakMinutes: 60,
    status: "Active",
  });

  await upsertDataResource("hr-shift-schedules", ids.shiftSchedule, {
    id: ids.shiftSchedule,
    employeeId: ids.employee,
    employeeName: "AJI TEJA PRATAMA",
    shiftId: ids.shift,
    shiftName: "Shift 1",
    date: today,
    status: "Assigned",
  });

  await upsertDataResource("hr-attendance-summaries", ids.attendanceSummary, {
    id: ids.attendanceSummary,
    employeeId: ids.employee,
    employeeName: "AJI TEJA PRATAMA",
    month: period,
    totalDays: 26,
    presentDays: 24,
    lateDays: 1,
    leaveDays: 1,
    overtimeHours: 12,
  });

  await upsertDataResource("hr-performance-reviews", ids.performanceReview, {
    id: ids.performanceReview,
    employeeId: ids.employee,
    employeeName: "AJI TEJA PRATAMA",
    period,
    reviewer: "Supervisor",
    score: 88,
    summary: "Performa baik dan stabil.",
    status: "Completed",
  });

  await upsertDataResource("hr-thl-contracts", ids.thlContract, {
    id: ids.thlContract,
    employeeId: ids.employee,
    employeeName: "AJI TEJA PRATAMA",
    contractNo: "THL/GTP/UAT/2026/0001",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    dailyRate: 275000,
    status: "Active",
  });

  await upsertDataResource("hr-resignations", ids.resignation, {
    id: ids.resignation,
    employeeId: ids.employee,
    employeeName: "AJI TEJA PRATAMA",
    requestDate: "2026-12-01",
    effectiveDate: "2026-12-31",
    reason: "Personal",
    status: "Draft",
  });

  await upsertDataResource("working-expense-sheets", ids.expenseSheet, {
    id: ids.expenseSheet,
    date: today,
    projectId: ids.project,
    project: "Penawaran Repair Furnace Boiler",
    location: "JAKSEL",
    status: "Submitted",
    totalKas: 1850000,
    items: [
      { id: "BK-ITEM-1", date: today, description: "Transport", nominal: 550000, hasNota: "Y" },
      { id: "BK-ITEM-2", date: today, description: "Konsumsi", nominal: 300000, hasNota: "Y" },
      { id: "BK-ITEM-3", date: today, description: "Lain-lain", nominal: 1000000, hasNota: "N" },
    ],
  });

  await upsertDataResource("finance-bpjs-payments", ids.financeBpjs, {
    id: ids.financeBpjs,
    period,
    employeeCount: 12,
    amount: 4500000,
    status: "Submitted",
  });

  await upsertDataResource("finance-pph21-filings", ids.financePph21, {
    id: ids.financePph21,
    period,
    amount: 6200000,
    status: "Filed",
    filingDate: today,
  });

  await upsertDataResource("finance-thr-disbursements", ids.financeThr, {
    id: ids.financeThr,
    period: "2026-04",
    employeeCount: 12,
    amount: 28000000,
    status: "Planned",
  });

  await upsertDataResource("finance-employee-allowances", ids.financeAllowance, {
    id: ids.financeAllowance,
    employeeId: ids.employee,
    period,
    amount: 500000,
    allowanceType: "Meal",
    status: "Approved",
  });

  await upsertDataResource("finance-po-payments", ids.financePoPayment, {
    id: ids.financePoPayment,
    poId: ids.po,
    projectId: ids.project,
    amount: 17500000,
    paymentDate: today,
    paymentMethod: "Transfer",
    status: "Paid",
  });

  await upsertDataResource("finance-bank-reconciliations", ids.bankRecon, {
    id: ids.bankRecon,
    period,
    invoiceId: ids.invoice,
    amount: 175164820889,
    bankRef: "BR-2026-0001",
    status: "Matched",
  });

  await upsertDataResource("finance-petty-cash-transactions", ids.petty, {
    id: ids.petty,
    employeeId: ids.employee,
    date: today,
    direction: "debit",
    amount: 350000,
    accountCode: "PETTY-01",
    note: "Biaya operasional lapangan",
    source: "seed-coverage-pack",
  });

  await upsertDataResource("berita-acara", ids.beritaAcara, {
    id: ids.beritaAcara,
    noBA: "BA/GTP/UAT/2026/0001",
    tanggal: today,
    projectId: ids.project,
    project: "Penawaran Repair Furnace Boiler",
    status: "Final",
    catatan: "Progress pekerjaan sesuai SPK.",
  });

  await upsertDataResource("surat-masuk", ids.suratMasuk, {
    id: ids.suratMasuk,
    nomor: "SMK/GTP/UAT/2026/0001",
    tanggal: today,
    pengirim: "PT Asahimas Indonesia",
    perihal: "Permintaan update progres",
    status: "Open",
  });

  await upsertDataResource("template-surat", ids.template, {
    id: ids.template,
    namaTemplate: "Template SPK UAT",
    kategori: "SPK",
    versi: "1.0",
    aktif: true,
  });

  await upsertDataResource("surat-keluar", ids.suratKeluar, {
    id: ids.suratKeluar,
    nomor: "SKR/GTP/UAT/2026/0001",
    tanggal: today,
    tujuan: "PT Asahimas Indonesia",
    perihal: "Balasan update progres",
    templateId: ids.template,
    status: "Sent",
  });

  await upsertDataResource("assets", ids.asset, {
    id: ids.asset,
    assetCode: "AST/GTP/UAT/2026/0001",
    name: "Forklift 3 Ton",
    category: "Fleet",
    purchaseDate: "2025-01-10",
    value: 225000000,
    status: "Active",
    location: "Gudang Utama",
  });

  await upsertDataResource("maintenances", ids.maintenance, {
    id: ids.maintenance,
    assetId: ids.asset,
    assetCode: "AST/GTP/UAT/2026/0001",
    assetName: "Forklift 3 Ton",
    scheduleDate: "2026-03-20",
    technician: "Teknisi Internal",
    status: "Planned",
    notes: "Maintenance berkala 250 jam.",
  });

  await upsertDataResource("payrolls", ids.payroll, {
    id: ids.payroll,
    period,
    employeeId: ids.employee,
    employeeName: "AJI TEJA PRATAMA",
    basicSalary: 6500000,
    allowance: 500000,
    deduction: 350000,
    netSalary: 6650000,
    status: "Draft",
  });

  await upsertDataResource("archive-registry", ids.archive, {
    id: ids.archive,
    date: today,
    ref: "INV/GTP/UAT/2026/0001",
    description: "Arsip invoice UAT",
    amount: 175164820889,
    project: "Penawaran Repair Furnace Boiler",
    admin: "System Seed",
    type: "AR",
    source: "Invoice Module",
  });

  await upsertDataResource("audit-logs", ids.audit, {
    id: ids.audit,
    timestamp: nowIso,
    userId: "seed-system",
    userName: "System Seed",
    action: "SEED_COVERAGE_PACK_RUN",
    module: "SYSTEM",
    details: "Initial UAT coverage pack inserted.",
    status: "Success",
  });

  await upsertDataResource("vendor-expenses", ids.vendorExpense, {
    id: ids.vendorExpense,
    vendorId: ids.vendor,
    vendorName: "PT Gemilang Mitra Abadi",
    tanggal: today,
    kategori: "Transport",
    nominal: 1500000,
    keterangan: "Biaya kirim material",
    status: "Approved",
  });

  await upsertDataResource("vendor-invoices", ids.vendorInvoice, {
    id: ids.vendorInvoice,
    noInvoice: "VIN/GTP/UAT/2026/0001",
    vendorId: ids.vendor,
    vendorName: "PT Gemilang Mitra Abadi",
    tanggal: today,
    jatuhTempo: "2026-04-30",
    amount: 35000000,
    status: "Sent",
  });

  await upsertDataResource("customer-invoices", ids.customerInvoice, {
    id: ids.customerInvoice,
    noInvoice: "CIN/GTP/UAT/2026/0001",
    customerId: ids.customer,
    customerName: "PT Asahimas Indonesia",
    tanggal: today,
    dueDate: "2026-04-30",
    amount: 175164820889,
    status: "Sent",
  });

  // Additional resources used by several pages but not counted in /system/coverage
  await upsertDataResource("kasbons", ids.kasbon, {
    id: ids.kasbon,
    employeeId: ids.employee,
    employeeName: "AJI TEJA PRATAMA",
    projectId: ids.project,
    date: today,
    amount: 250000,
    status: "Approved",
    note: "Kasbon makan lapangan",
  });

  await upsertDataResource("fleet-health", ids.fleet, {
    id: ids.fleet,
    assetId: ids.asset,
    projectId: ids.project,
    date: today,
    equipmentName: "Forklift 3 Ton",
    hoursUsed: 6,
    operatorName: "Ujang",
    costPerHour: 120000,
    status: "Ready",
  });

  await upsertDataResource("proof-of-delivery", ids.pod, {
    id: ids.pod,
    projectId: ids.project,
    suratJalanId: ids.suratJalan,
    workOrderId: ids.wo,
    deliveryDate: today,
    receiverName: "Bpk. Alois",
    status: "Delivered",
    notes: "Barang diterima baik.",
  });

  await upsertDataResource("app-settings", ids.appSetting, {
    id: ids.appSetting,
    key: "ui.theme.primary",
    value: "blue",
    section: "appearance",
    updatedBy: "System Seed",
    updatedByUserId: null,
    updatedAt: nowIso,
  });

  console.log("Seed coverage pack selesai: data lintas modul + relasi dasar terisi.");
}

main()
  .catch((err) => {
    console.error("Seed coverage pack failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
