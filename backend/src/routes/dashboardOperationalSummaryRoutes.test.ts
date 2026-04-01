import assert from "node:assert/strict";
import { once } from "node:events";
import { AddressInfo } from "node:net";
import test from "node:test";
import { Role } from "@prisma/client";
import { app } from "../app";
import { prisma } from "../prisma";
import { signAccessToken } from "../utils/token";

const TODAY = new Date().toISOString().slice(0, 10);

function createQuotationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "quot-1",
    noPenawaran: "Q-001",
    tanggal: "2026-03-01",
    status: "SENT",
    kepada: "PT Customer",
    perihal: "Penawaran Proyek",
    grandTotal: 60_000_000,
    dataCollectionId: "dc-1",
    payload: {
      projectId: "proj-1",
    },
    updatedAt: new Date("2026-03-11T00:00:00.000Z"),
    ...overrides,
  };
}

function createDataCollectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "dc-1",
    status: "DRAFT",
    updatedAt: new Date("2026-03-08T00:00:00.000Z"),
    ...overrides,
  };
}

function createProjectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "proj-1",
    quotationId: "quot-1",
    customerId: "cust-1",
    kodeProject: "PRJ-001",
    namaProject: "Project A",
    customerName: "PT Customer",
    status: "IN_PROGRESS",
    approvalStatus: "APPROVED",
    nilaiKontrak: 100_000_000,
    progress: 45,
    payload: {
      id: "proj-1",
      namaProject: "Project A",
      customer: "PT Customer",
      boq: [
        {
          itemKode: "MAT-001",
          materialName: "Steel Plate",
          qtyEstimate: 12,
          unit: "pcs",
          unitPrice: 120_000,
          supplier: "Vendor A",
        },
      ],
      materialRequests: [
        {
          status: "APPROVED",
          noRequest: "MR-001",
          items: [
            {
              itemKode: "MAT-001",
              itemNama: "Steel Plate",
              qty: 3,
              unit: "pcs",
            },
          ],
        },
      ],
    },
    updatedAt: new Date("2026-03-16T00:00:00.000Z"),
    ...overrides,
  };
}

function createInvoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    projectId: "proj-1",
    customerId: "cust-1",
    noInvoice: "INV-001",
    tanggal: "2026-03-04",
    jatuhTempo: "2026-03-11",
    customer: "PT Customer",
    customerName: "PT Customer",
    alamat: "Jl. Customer",
    noPO: "PO-001",
    subtotal: 3_000_000,
    ppn: 330_000,
    totalBayar: 3_330_000,
    paidAmount: 500_000,
    outstandingAmount: 2_830_000,
    status: "UNPAID",
    projectName: "Project A",
    noFakturPajak: null,
    perihal: "Invoice Proyek",
    termin: "Termin 1",
    buktiTransfer: null,
    noKwitansi: null,
    tanggalBayar: "2026-03-10",
    updatedAt: new Date("2026-03-10T00:00:00.000Z"),
    ...overrides,
  };
}

function createVendorInvoicePayloadRow(
  payload: Record<string, unknown>,
  updatedAt = new Date("2026-03-14T00:00:00.000Z"),
) {
  return {
    id: String(payload.id || "vinv-1"),
    payload,
    updatedAt,
  };
}

function createPurchaseOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "po-1",
    number: "PO-001",
    tanggal: new Date("2026-03-01T00:00:00.000Z"),
    supplierName: "Vendor A",
    projectId: "proj-1",
    vendorId: "vendor-1",
    supplierAddress: "Jl. Vendor No. 1",
    supplierPhone: "08123456789",
    supplierFax: null,
    supplierContact: "Dewi",
    attention: "Procurement",
    notes: "Catatan PO",
    ppnRate: 11,
    topDays: 14,
    ref: "REF-PO",
    poCode: "PO-CODE-001",
    deliveryDate: new Date("2026-03-05T00:00:00.000Z"),
    signatoryName: "Aji",
    totalAmount: 1_000_000,
    status: "SENT",
    updatedAt: new Date("2026-03-12T00:00:00.000Z"),
    items: [
      {
        id: "po-item-1",
        itemCode: "MAT-001",
        itemName: "Steel Plate",
        qty: 4,
        unit: "pcs",
        unitPrice: 250_000,
        total: 1_000_000,
        qtyReceived: 0,
        source: null,
        sourceRef: null,
      },
    ],
    ...overrides,
  };
}

function createReceivingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "recv-1",
    purchaseOrderId: "po-1",
    projectId: "proj-1",
    number: "RCV-001",
    suratJalanNo: "SJ-001",
    suratJalanPhoto: null,
    tanggal: new Date("2026-03-05T00:00:00.000Z"),
    purchaseOrderNo: "PO-001",
    supplierName: "Vendor A",
    projectName: "Project A",
    status: "RECEIVED",
    warehouseLocation: "Gudang A",
    notes: "Penerimaan barang",
    updatedAt: new Date("2026-03-06T00:00:00.000Z"),
    items: [
      {
        id: "recv-item-1",
        itemCode: "MAT-001",
        itemName: "Steel Plate",
        qtyOrdered: 4,
        qtyReceived: 4,
        qtyGood: 4,
        qtyDamaged: 0,
        qtyPreviouslyReceived: 0,
        unit: "pcs",
        condition: "GOOD",
        batchNo: null,
        expiryDate: null,
        photoUrl: null,
        notes: "",
      },
    ],
    ...overrides,
  };
}

function createInventoryItemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "stock-1",
    code: "MAT-001",
    name: "Steel Plate",
    category: "Material",
    unit: "pcs",
    location: "Gudang A",
    minStock: 1,
    onHandQty: 2,
    reservedQty: 0,
    onOrderQty: 0,
    unitPrice: 100_000,
    supplierName: "Vendor A",
    status: "ACTIVE",
    lastStockUpdateAt: new Date("2026-03-13T00:00:00.000Z"),
    metadata: null,
    updatedAt: new Date("2026-03-13T00:00:00.000Z"),
    ...overrides,
  };
}

function createWorkOrderRow(payload: Record<string, unknown>, updatedAt: Date) {
  return {
    id: String(payload.id || "wo-1"),
    payload,
    updatedAt,
  };
}

function createProductionReportRow(payload: Record<string, unknown>, updatedAt: Date) {
  return {
    id: String(payload.id || "pr-1"),
    payload,
    updatedAt,
  };
}

function createEmployeeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "emp-1",
    status: "ACTIVE",
    employmentType: "PERMANENT",
    updatedAt: new Date("2026-03-19T00:00:00.000Z"),
    ...overrides,
  };
}

function createAttendanceRow(overrides: Record<string, unknown> = {}) {
  return {
    date: TODAY,
    workHours: 8,
    updatedAt: new Date("2026-03-12T00:00:00.000Z"),
    ...overrides,
  };
}

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve test server address");
  }

  try {
    await run(`http://127.0.0.1:${(address as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

function installOperationalSummaryMocks(authRole: Role) {
  const prismaAny = prisma as unknown as Record<string, any>;
  const calls = {
    quotationFindMany: 0,
    dataCollectionFindMany: 0,
    projectFindMany: 0,
    invoiceFindMany: 0,
    vendorInvoiceFindMany: 0,
    attendanceFindMany: 0,
    stockItemFindMany: 0,
    purchaseOrderFindMany: 0,
    receivingFindMany: 0,
    workOrderFindMany: 0,
    productionReportFindMany: 0,
    employeeFindMany: 0,
    appEntityFindMany: [] as Array<Record<string, unknown>>,
  };

  const originalRevokedFindUnique = prismaAny.revokedToken.findUnique;
  const originalUserFindUnique = prismaAny.user.findUnique;
  const originalAppEntityFindMany = prismaAny.appEntity.findMany;
  const originalQuotationFindMany = prismaAny.quotation.findMany;
  const originalDataCollectionFindMany = prismaAny.dataCollection.findMany;
  const originalProjectFindMany = prismaAny.projectRecord.findMany;
  const originalInvoiceFindMany = prismaAny.invoiceRecord.findMany;
  const originalVendorInvoiceFindMany = prismaAny.vendorInvoiceRecord?.findMany;
  const originalAttendanceFindMany = prismaAny.attendanceRecord?.findMany;
  const originalInventoryItemFindMany = prismaAny.inventoryItem?.findMany;
  const originalPurchaseOrderFindMany = prismaAny.procurementPurchaseOrder?.findMany;
  const originalReceivingFindMany = prismaAny.procurementReceiving?.findMany;
  const originalWorkOrderFindMany = prismaAny.workOrderRecord?.findMany;
  const originalProductionReportFindMany = prismaAny.productionReportRecord?.findMany;
  const originalEmployeeFindMany = prismaAny.employeeRecord?.findMany;

  prismaAny.revokedToken.findUnique = async () => null;
  prismaAny.user.findUnique = async (args: Record<string, any>) => {
    if (args?.select?.isActive) {
      return { isActive: true, role: authRole };
    }
    return {
      id: "user-auth",
      username: "tester",
      name: "Tester",
      role: authRole,
    };
  };

  prismaAny.appEntity.findMany = async (args: Record<string, unknown>) => {
    calls.appEntityFindMany.push(args);
    return [];
  };

  prismaAny.quotation.findMany = async () => {
    calls.quotationFindMany += 1;
    return [
      createQuotationRow(),
      createQuotationRow({
        id: "quot-2",
        noPenawaran: "Q-002",
        status: "APPROVED",
        grandTotal: 10_000_000,
        payload: { projectId: "proj-2" },
        updatedAt: new Date("2026-03-18T00:00:00.000Z"),
      }),
    ];
  };

  prismaAny.dataCollection.findMany = async () => {
    calls.dataCollectionFindMany += 1;
    return [
      createDataCollectionRow(),
      createDataCollectionRow({
        id: "dc-2",
        status: "COMPLETED",
        updatedAt: new Date("2026-03-09T00:00:00.000Z"),
      }),
    ];
  };

  prismaAny.projectRecord.findMany = async () => {
    calls.projectFindMany += 1;
    return [
      createProjectRow(),
      createProjectRow({
        id: "proj-2",
        quotationId: "quot-2",
        customerId: "cust-2",
        kodeProject: "PRJ-002",
        namaProject: "Project B",
        customerName: "PT Customer Beta",
        status: "DONE",
        approvalStatus: "PENDING",
        nilaiKontrak: 20_000_000,
        payload: {
          id: "proj-2",
          namaProject: "Project B",
          customer: "PT Customer Beta",
          boq: [
            {
              itemKode: "MAT-002",
              materialName: "Cat Primer",
              qtyEstimate: 3,
              unit: "can",
              unitPrice: 60_000,
              supplier: "Vendor B",
            },
          ],
          materialRequests: [],
        },
        updatedAt: new Date("2026-03-20T00:00:00.000Z"),
      }),
    ];
  };

  prismaAny.invoiceRecord.findMany = async () => {
    calls.invoiceFindMany += 1;
    return [
      createInvoiceRow(),
      createInvoiceRow({
        id: "inv-2",
        projectId: "proj-2",
        customerId: "cust-2",
        noInvoice: "INV-002",
        customer: "PT Customer Beta",
        customerName: "PT Customer Beta",
        totalBayar: 1_000_000,
        paidAmount: 0,
        outstandingAmount: 1_000_000,
        tanggalBayar: null,
        updatedAt: new Date("2026-03-25T00:00:00.000Z"),
      }),
    ];
  };

  if (!prismaAny.vendorInvoiceRecord) {
    prismaAny.vendorInvoiceRecord = {};
  }
  prismaAny.vendorInvoiceRecord.findMany = async () => {
    calls.vendorInvoiceFindMany += 1;
    return [
      createVendorInvoicePayloadRow({
        id: "vinv-1",
        totalAmount: 800_000,
        paidAmount: 100_000,
        outstandingAmount: 700_000,
        status: "UNPAID",
      }),
      createVendorInvoicePayloadRow(
        {
          id: "vinv-2",
          totalAmount: 200_000,
          paidAmount: 50_000,
          outstandingAmount: 150_000,
          status: "PARTIAL",
        },
        new Date("2026-03-24T00:00:00.000Z"),
      ),
    ];
  };

  if (!prismaAny.attendanceRecord) {
    prismaAny.attendanceRecord = {};
  }
  prismaAny.attendanceRecord.findMany = async () => {
    calls.attendanceFindMany += 1;
    return [
      createAttendanceRow(),
      createAttendanceRow({
        date: TODAY,
        workHours: 6,
        updatedAt: new Date("2026-03-27T00:00:00.000Z"),
      }),
      createAttendanceRow({
        date: "2026-03-20",
        workHours: 7,
        updatedAt: new Date("2026-03-20T00:00:00.000Z"),
      }),
    ];
  };

  if (!prismaAny.inventoryItem) {
    prismaAny.inventoryItem = {};
  }
  prismaAny.inventoryItem.findMany = async () => {
    calls.stockItemFindMany += 1;
    return [
      createInventoryItemRow(),
      createInventoryItemRow({
        id: "stock-2",
        code: "MAT-002",
        name: "Cat Primer",
        unit: "can",
        onHandQty: 5,
        unitPrice: 50_000,
        supplierName: "Vendor B",
        updatedAt: new Date("2026-03-26T00:00:00.000Z"),
      }),
    ];
  };

  if (!prismaAny.procurementPurchaseOrder) {
    prismaAny.procurementPurchaseOrder = {};
  }
  prismaAny.procurementPurchaseOrder.findMany = async () => {
    calls.purchaseOrderFindMany += 1;
    return [
      createPurchaseOrderRow(),
      createPurchaseOrderRow({
        id: "po-2",
        number: "PO-002",
        tanggal: new Date("2026-03-05T00:00:00.000Z"),
        supplierName: "Vendor B",
        projectId: "proj-2",
        vendorId: "vendor-2",
        totalAmount: 500_000,
        status: "RECEIVED",
        updatedAt: new Date("2026-03-21T00:00:00.000Z"),
        items: [
          {
            id: "po-item-2",
            itemCode: "MAT-002",
            itemName: "Cat Primer",
            qty: 2,
            unit: "can",
            unitPrice: 250_000,
            total: 500_000,
            qtyReceived: 2,
            source: null,
            sourceRef: null,
          },
        ],
      }),
    ];
  };

  if (!prismaAny.procurementReceiving) {
    prismaAny.procurementReceiving = {};
  }
  prismaAny.procurementReceiving.findMany = async () => {
    calls.receivingFindMany += 1;
    return [
      createReceivingRow(),
      createReceivingRow({
        id: "recv-2",
        purchaseOrderId: "po-2",
        projectId: "proj-2",
        number: "RCV-002",
        suratJalanNo: "SJ-002",
        tanggal: new Date("2026-03-20T00:00:00.000Z"),
        purchaseOrderNo: "PO-002",
        supplierName: "Vendor B",
        projectName: "Project B",
        updatedAt: new Date("2026-03-22T00:00:00.000Z"),
        items: [
          {
            id: "recv-item-2",
            itemCode: "MAT-002",
            itemName: "Cat Primer",
            qtyOrdered: 2,
            qtyReceived: 2,
            qtyGood: 2,
            qtyDamaged: 0,
            qtyPreviouslyReceived: 0,
            unit: "can",
            condition: "GOOD",
            batchNo: null,
            expiryDate: null,
            photoUrl: null,
            notes: "",
          },
        ],
      }),
    ];
  };

  if (!prismaAny.workOrderRecord) {
    prismaAny.workOrderRecord = {};
  }
  prismaAny.workOrderRecord.findMany = async () => {
    calls.workOrderFindMany += 1;
    return [
      createWorkOrderRow(
        {
          id: "wo-1",
          status: "DRAFT",
          deadline: "2026-04-10",
          targetQty: 10,
          completedQty: 0,
        },
        new Date("2026-03-11T00:00:00.000Z"),
      ),
      createWorkOrderRow(
        {
          id: "wo-2",
          status: "IN_PROGRESS",
          deadline: "2026-03-20",
          targetQty: 10,
          completedQty: 5,
        },
        new Date("2026-03-12T00:00:00.000Z"),
      ),
      createWorkOrderRow(
        {
          id: "wo-3",
          status: "QC",
          deadline: "2026-04-15",
          targetQty: 10,
          completedQty: 10,
        },
        new Date("2026-03-13T00:00:00.000Z"),
      ),
      createWorkOrderRow(
        {
          id: "wo-4",
          status: "DONE",
          deadline: "2026-03-20",
          targetQty: 10,
          completedQty: 10,
        },
        new Date("2026-03-18T00:00:00.000Z"),
      ),
    ];
  };

  if (!prismaAny.productionReportRecord) {
    prismaAny.productionReportRecord = {};
  }
  prismaAny.productionReportRecord.findMany = async () => {
    calls.productionReportFindMany += 1;
    return [
      createProductionReportRow(
        { id: "pr-1", outputQty: 10, rejectQty: 1 },
        new Date("2026-03-14T00:00:00.000Z"),
      ),
      createProductionReportRow(
        { id: "pr-2", outputQty: 5, rejectQty: 1 },
        new Date("2026-03-28T00:00:00.000Z"),
      ),
    ];
  };

  if (!prismaAny.employeeRecord) {
    prismaAny.employeeRecord = {};
  }
  prismaAny.employeeRecord.findMany = async () => {
    calls.employeeFindMany += 1;
    return [
      createEmployeeRow(),
      createEmployeeRow({
        id: "emp-2",
        status: "RESIGNED",
        employmentType: "CONTRACT",
        updatedAt: new Date("2026-03-23T00:00:00.000Z"),
      }),
      createEmployeeRow({
        id: "emp-3",
        status: "INACTIVE",
        employmentType: "THL",
        updatedAt: new Date("2026-03-18T00:00:00.000Z"),
      }),
      createEmployeeRow({
        id: "emp-4",
        status: "ACTIVE",
        employmentType: "INTERNSHIP",
        updatedAt: new Date("2026-03-17T00:00:00.000Z"),
      }),
    ];
  };

  return {
    calls,
    restore() {
      prismaAny.revokedToken.findUnique = originalRevokedFindUnique;
      prismaAny.user.findUnique = originalUserFindUnique;
      prismaAny.appEntity.findMany = originalAppEntityFindMany;
      prismaAny.quotation.findMany = originalQuotationFindMany;
      prismaAny.dataCollection.findMany = originalDataCollectionFindMany;
      prismaAny.projectRecord.findMany = originalProjectFindMany;
      prismaAny.invoiceRecord.findMany = originalInvoiceFindMany;
      if (prismaAny.vendorInvoiceRecord) {
        prismaAny.vendorInvoiceRecord.findMany = originalVendorInvoiceFindMany;
      }
      if (prismaAny.attendanceRecord) {
        prismaAny.attendanceRecord.findMany = originalAttendanceFindMany;
      }
      if (prismaAny.inventoryItem) {
        prismaAny.inventoryItem.findMany = originalInventoryItemFindMany;
      }
      if (prismaAny.procurementPurchaseOrder) {
        prismaAny.procurementPurchaseOrder.findMany = originalPurchaseOrderFindMany;
      }
      if (prismaAny.procurementReceiving) {
        prismaAny.procurementReceiving.findMany = originalReceivingFindMany;
      }
      if (prismaAny.workOrderRecord) {
        prismaAny.workOrderRecord.findMany = originalWorkOrderFindMany;
      }
      if (prismaAny.productionReportRecord) {
        prismaAny.productionReportRecord.findMany = originalProductionReportFindMany;
      }
      if (prismaAny.employeeRecord) {
        prismaAny.employeeRecord.findMany = originalEmployeeFindMany;
      }
    },
  };
}

test("GET /dashboard/summary returns operational overview and latest timestamp", async () => {
  const mock = installOperationalSummaryMocks(Role.SPV);
  const token = signAccessToken({ id: "user-spv", role: Role.SPV });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.quotations.total, 2);
      assert.equal(payload.quotations.sent, 1);
      assert.equal(payload.quotations.approved, 1);
      assert.equal(payload.quotations.pendingHighValue, 1);
      assert.equal(payload.dataCollections.completed, 1);
      assert.equal(payload.projects.approved, 1);
      assert.equal(payload.projects.pending, 1);
      assert.equal(payload.projects.inProgress, 1);
      assert.equal(payload.projects.completed, 1);
      assert.equal(payload.finance.revenue, 4_330_000);
      assert.equal(payload.finance.accountsPayable, 850_000);
      assert.equal(payload.finance.estimatedPayroll, 525_000);
      assert.equal(payload.finance.totalCommitment, 1_500_000);
      assert.equal(payload.finance.inventoryValue, 450_000);
      assert.equal(payload.approvals.pendingPurchaseOrders, 1);
      assert.equal(payload.approvals.pendingCount, 2);
      assert.equal(payload.lastUpdatedAt, "2026-03-27T00:00:00.000Z");
    });

    assert.equal(mock.calls.quotationFindMany, 1);
    assert.equal(mock.calls.dataCollectionFindMany, 1);
    assert.equal(mock.calls.projectFindMany, 1);
    assert.equal(mock.calls.purchaseOrderFindMany, 1);
    assert.equal(mock.calls.invoiceFindMany, 1);
    assert.equal(mock.calls.vendorInvoiceFindMany, 1);
    assert.equal(mock.calls.attendanceFindMany, 1);
    assert.equal(mock.calls.stockItemFindMany, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/vendor-summary returns vendor performance summary and latest timestamp", async () => {
  const mock = installOperationalSummaryMocks(Role.PURCHASING);
  const token = signAccessToken({ id: "user-purch", role: Role.PURCHASING });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/vendor-summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.totalVendors, 2);
      assert.equal(payload.totalOrders, 2);
      assert.equal(payload.totalSpend, 1_500_000);
      assert.equal(payload.vendors[0].name, "Vendor A");
      assert.equal(payload.vendors[0].avgLeadTime, 4);
      assert.equal(payload.vendors[0].onTimeRate, 100);
      assert.equal(payload.lastUpdatedAt, "2026-03-22T00:00:00.000Z");
    });

    assert.equal(mock.calls.purchaseOrderFindMany, 1);
    assert.equal(mock.calls.receivingFindMany, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/production-summary returns work order and production output summary", async () => {
  const mock = installOperationalSummaryMocks(Role.PRODUKSI);
  const token = signAccessToken({ id: "user-prod", role: Role.PRODUKSI });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/production-summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.workOrders.total, 4);
      assert.equal(payload.workOrders.draft, 1);
      assert.equal(payload.workOrders.inProgress, 1);
      assert.equal(payload.workOrders.qc, 1);
      assert.equal(payload.workOrders.completed, 1);
      assert.equal(payload.workOrders.overdue, 1);
      assert.equal(payload.workOrders.avgProgress, 62.5);
      assert.equal(payload.reports.total, 2);
      assert.equal(payload.reports.outputQty, 15);
      assert.equal(payload.reports.rejectQty, 2);
      assert.equal(payload.lastUpdatedAt, "2026-03-28T00:00:00.000Z");
    });

    assert.equal(mock.calls.workOrderFindMany, 1);
    assert.equal(mock.calls.productionReportFindMany, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/procurement-summary returns gap analysis and latest timestamp", async () => {
  const mock = installOperationalSummaryMocks(Role.PURCHASING);
  const token = signAccessToken({ id: "user-purch", role: Role.PURCHASING });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/procurement-summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.totalGapItems, 1);
      assert.equal(payload.totalGapQty, 9);
      assert.equal(payload.demandGaps[0].kode, "MAT-001");
      assert.equal(payload.demandGaps[0].stock, 2);
      assert.equal(payload.demandGaps[0].onOrder, 4);
      assert.equal(payload.demandGaps[0].totalRequired, 15);
      assert.equal(payload.demandGaps[0].gap, 9);
      assert.equal(payload.lastUpdatedAt, "2026-03-26T00:00:00.000Z");
    });

    assert.equal(mock.calls.projectFindMany, 1);
    assert.equal(mock.calls.purchaseOrderFindMany, 1);
    assert.equal(mock.calls.stockItemFindMany, 1);
  } finally {
    mock.restore();
  }
});

test("GET /dashboard/hr-summary returns employee and attendance summary with latest timestamp", async () => {
  const mock = installOperationalSummaryMocks(Role.HR);
  const token = signAccessToken({ id: "user-hr", role: Role.HR });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard/hr-summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.equal(response.status, 200);
      const payload = (await response.json()) as Record<string, any>;
      assert.equal(payload.employees.total, 4);
      assert.equal(payload.employees.active, 2);
      assert.equal(payload.employees.inactive, 1);
      assert.equal(payload.employees.resigned, 1);
      assert.equal(payload.employees.permanent, 1);
      assert.equal(payload.employees.contract, 1);
      assert.equal(payload.employees.thl, 1);
      assert.equal(payload.employees.internship, 1);
      assert.equal(payload.attendance.totalRecords, 3);
      assert.equal(payload.attendance.todayAttendance, 2);
      assert.equal(payload.attendance.totalWorkHours, 21);
      assert.equal(payload.lastUpdatedAt, "2026-03-27T00:00:00.000Z");
    });

    assert.equal(mock.calls.employeeFindMany, 1);
    assert.equal(mock.calls.attendanceFindMany, 1);
  } finally {
    mock.restore();
  }
});
