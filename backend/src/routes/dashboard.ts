import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import {
  canReadCoverage,
  canReadFinance,
  asRecord,
  readString,
  readNumber,
  parseTaggedSource,
  maxDate,
  toActionList,
  invoiceDashboardSelect,
  invoiceDashboardDetailSelect,
  projectDashboardSelect,
  quotationDashboardSelect,
  dataCollectionDashboardSelect,
  mapInvoiceDashboardPayload,
  mapDataCollectionDashboardPayload,
  mapProjectDashboardPayload,
  mapQuotationDashboardPayload,
  resolveActorSnapshot,
  mapProcurementPurchaseOrderDashboardPayload,
  mapProductionMaterialRequestDashboardPayload,
  mapProcurementReceivingDashboardPayload,
  mapInventoryItemDashboardPayload,
  mapInventoryMovementDashboardPayload,
  mapInventoryStockInDashboardPayload,
  mapInventoryStockOutDashboardPayload,
  mapInventoryStockOpnameDashboardPayload,
  type FinanceQueueRow,
  type DashboardPettyCashDelegate,
  mapDashboardLogisticsSuratJalanPayload,
  mapDashboardProofOfDeliveryPayload,
  getDashboardDedicatedDelegate,
  mergeFinanceRows,
} from "./dashboardRouteSupport";
import {
  buildFinanceApSummary,
  buildFinanceArAgingSummary,
  buildFinanceGeneralLedgerSummary,
  buildFinancePpnSummary,
} from "./dashboardFinanceAnalytics";
import {
  buildFinanceBankReconSummary,
  buildFinancePaymentSummary,
  buildFinancePettyCashSummary,
  buildFinanceReconciliationCheck,
} from "./dashboardFinanceCashHelpers";
import {
  canReadFinanceApprovalQueue,
} from "./dashboardFinanceApprovalHelpers";
import {
  executeFinanceApprovalAction,
  FinanceApprovalActionError,
  parseFinanceApprovalActionInput,
} from "./dashboardFinanceApprovalAction";
import { buildFinanceApprovalQueuePayload } from "./dashboardFinanceApprovalQueue";
import {
  upsertProjectFromQuotationForApprovalSync,
  writeQuotationApprovalLogSafe,
} from "./dashboardQuotationWorkflow";
import {
  buildSystemCoveragePayload,
  buildSystemSecurityHealthPayload,
  buildSystemSpkWoHealthPayload,
  buildWorkflowMonitorPayload,
  canReadWorkflow,
} from "./dashboardSystemSupport";

export const dashboardRouter = Router();

async function loadDashboardWorkflowRows(resource: string): Promise<FinanceQueueRow[]> {
  const [appRows, delegate] = await Promise.all([
    prisma.appEntity.findMany({
      where: { resource },
      select: { entityId: true, payload: true, updatedAt: true },
    }),
    Promise.resolve(getDashboardDedicatedDelegate(resource)),
  ]);

  if (resource === "purchase-orders") {
    const procurementRows = await prisma.procurementPurchaseOrder.findMany({
      select: {
        id: true,
        number: true,
        tanggal: true,
        supplierName: true,
        projectId: true,
        vendorId: true,
        supplierAddress: true,
        supplierPhone: true,
        supplierFax: true,
        supplierContact: true,
        attention: true,
        notes: true,
        ppnRate: true,
        topDays: true,
        ref: true,
        poCode: true,
        deliveryDate: true,
        signatoryName: true,
        totalAmount: true,
        status: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            itemCode: true,
            itemName: true,
            qty: true,
            unit: true,
            unitPrice: true,
            total: true,
            qtyReceived: true,
            source: true,
            sourceRef: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    return mergeFinanceRows(
      appRows,
      procurementRows.map((row) => ({
        id: row.id,
        payload: mapProcurementPurchaseOrderDashboardPayload(row),
        updatedAt: row.updatedAt,
      }))
    );
  }

  if (resource === "receivings") {
    const procurementRows = await prisma.procurementReceiving.findMany({
      select: {
        id: true,
        purchaseOrderId: true,
        projectId: true,
        number: true,
        suratJalanNo: true,
        suratJalanPhoto: true,
        tanggal: true,
        purchaseOrderNo: true,
        supplierName: true,
        projectName: true,
        status: true,
        warehouseLocation: true,
        notes: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            itemCode: true,
            itemName: true,
            qtyOrdered: true,
            qtyReceived: true,
            qtyGood: true,
            qtyDamaged: true,
            qtyPreviouslyReceived: true,
            unit: true,
            condition: true,
            batchNo: true,
            expiryDate: true,
            photoUrl: true,
            notes: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    return mergeFinanceRows(
      appRows,
      procurementRows.map((row) => ({
        id: row.id,
        payload: mapProcurementReceivingDashboardPayload(row),
        updatedAt: row.updatedAt,
      }))
    );
  }

  if (resource === "invoices") {
    const invoiceRows = await prisma.invoiceRecord.findMany({
      select: invoiceDashboardSelect,
    });
    return mergeFinanceRows(
      appRows,
      invoiceRows.map((row) => ({
        id: row.id,
        payload: mapInvoiceDashboardPayload(row),
        updatedAt: row.updatedAt,
      }))
    );
  }

  if (resource === "material-requests") {
    const materialRequestRows = await prisma.productionMaterialRequest.findMany({
      select: {
        id: true,
        number: true,
        projectId: true,
        projectName: true,
        requestedBy: true,
        requestedAt: true,
        status: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            itemCode: true,
            itemName: true,
            qty: true,
            unit: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    return mergeFinanceRows(
      appRows,
      materialRequestRows.map((row) => ({
        id: row.id,
        payload: mapProductionMaterialRequestDashboardPayload(row),
        updatedAt: row.updatedAt,
      }))
    );
  }

  if (resource === "surat-jalan") {
    const rows = await prisma.logisticsSuratJalan.findMany({
      select: {
        id: true,
        noSurat: true,
        tanggal: true,
        sjType: true,
        tujuan: true,
        alamat: true,
        upPerson: true,
        noPO: true,
        projectId: true,
        assetId: true,
        sopir: true,
        noPolisi: true,
        pengirim: true,
        deliveryStatus: true,
        podName: true,
        podTime: true,
        podPhoto: true,
        podSignature: true,
        expectedReturnDate: true,
        actualReturnDate: true,
        returnStatus: true,
        workflowStatus: true,
        updatedAt: true,
        items: {
          select: {
            itemKode: true,
            namaItem: true,
            jumlah: true,
            satuan: true,
            batchNo: true,
            keterangan: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    return mergeFinanceRows(
      appRows,
      rows.map((row) => ({
        id: row.id,
        payload: mapDashboardLogisticsSuratJalanPayload(row),
        updatedAt: row.updatedAt,
      }))
    );
  }

  if (resource === "proof-of-delivery") {
    const rows = await prisma.logisticsProofOfDelivery.findMany({
      select: {
        id: true,
        suratJalanId: true,
        projectId: true,
        workOrderId: true,
        status: true,
        receiverName: true,
        deliveredAt: true,
        photo: true,
        signature: true,
        noSurat: true,
        tujuan: true,
        receiver: true,
        driver: true,
        plate: true,
        note: true,
        updatedAt: true,
        items: {
          select: {
            itemKode: true,
            namaItem: true,
            jumlah: true,
            satuan: true,
            batchNo: true,
            keterangan: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    return mergeFinanceRows(
      appRows,
      rows.map((row) => ({
        id: row.id,
        payload: mapDashboardProofOfDeliveryPayload(row),
        updatedAt: row.updatedAt,
      }))
    );
  }

  if (resource === "quotations") {
    const quotationRows = await prisma.quotation.findMany({
      select: quotationDashboardSelect,
    });
    return mergeFinanceRows(
      appRows,
      quotationRows.map((row) => ({
        id: row.id,
        payload: mapQuotationDashboardPayload(row),
        updatedAt: row.updatedAt,
      }))
    );
  }

  if (resource === "data-collections") {
    const dataCollectionRows = await prisma.dataCollection.findMany({
      select: dataCollectionDashboardSelect,
    });
    return mergeFinanceRows(
      appRows,
      dataCollectionRows.map((row) => ({
        id: row.id,
        payload: mapDataCollectionDashboardPayload(row),
        updatedAt: row.updatedAt,
      }))
    );
  }

  if (resource === "stock-items") {
    const inventoryRows = await prisma.inventoryItem.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        unit: true,
        location: true,
        minStock: true,
        onHandQty: true,
        reservedQty: true,
        onOrderQty: true,
        unitPrice: true,
        supplierName: true,
        status: true,
        lastStockUpdateAt: true,
        metadata: true,
        updatedAt: true,
      },
    });
    return mergeFinanceRows(
      appRows,
      inventoryRows.map((row) => ({
        id: row.id,
        payload: mapInventoryItemDashboardPayload(row),
        updatedAt: row.updatedAt,
      }))
    );
  }

  if (resource === "stock-movements") {
    const inventoryRows = await prisma.inventoryStockMovement.findMany({
      select: {
        id: true,
        tanggal: true,
        direction: true,
        referenceNo: true,
        referenceType: true,
        inventoryItemId: true,
        itemCode: true,
        itemName: true,
        qty: true,
        unit: true,
        location: true,
        stockBefore: true,
        stockAfter: true,
        batchNo: true,
        expiryDate: true,
        supplierName: true,
        poNumber: true,
        createdByName: true,
        projectId: true,
        legacyPayload: true,
        updatedAt: true,
      },
    });
    return mergeFinanceRows(
      appRows,
      inventoryRows.map((row) => ({
        id: row.id,
        payload: mapInventoryMovementDashboardPayload(row),
        updatedAt: row.updatedAt,
      }))
    );
  }

  if (resource === "stock-ins") {
    const inventoryRows = await prisma.inventoryStockIn.findMany({
      select: {
        id: true,
        number: true,
        tanggal: true,
        type: true,
        status: true,
        supplierName: true,
        suratJalanNumber: true,
        notes: true,
        createdByName: true,
        poId: true,
        projectId: true,
        legacyPayload: true,
        updatedAt: true,
        items: {
          select: {
            itemCode: true,
            itemName: true,
            qty: true,
            unit: true,
            batchNo: true,
            expiryDate: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    return mergeFinanceRows(
      appRows,
      inventoryRows.map((row) => ({
        id: row.id,
        payload: mapInventoryStockInDashboardPayload(row),
        updatedAt: row.updatedAt,
      }))
    );
  }

  if (resource === "stock-outs") {
    const inventoryRows = await prisma.inventoryStockOut.findMany({
      select: {
        id: true,
        number: true,
        tanggal: true,
        type: true,
        status: true,
        recipientName: true,
        notes: true,
        createdByName: true,
        projectId: true,
        workOrderId: true,
        productionReportId: true,
        legacyPayload: true,
        updatedAt: true,
        items: {
          select: {
            itemCode: true,
            itemName: true,
            qty: true,
            unit: true,
            batchNo: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    return mergeFinanceRows(
      appRows,
      inventoryRows.map((row) => ({
        id: row.id,
        payload: mapInventoryStockOutDashboardPayload(row),
        updatedAt: row.updatedAt,
      }))
    );
  }

  if (resource === "stock-opnames") {
    const inventoryRows = await prisma.inventoryStockOpname.findMany({
      select: {
        id: true,
        number: true,
        tanggal: true,
        location: true,
        status: true,
        notes: true,
        createdByName: true,
        confirmedByName: true,
        confirmedAt: true,
        legacyPayload: true,
        updatedAt: true,
        items: {
          select: {
            inventoryItemId: true,
            itemCode: true,
            itemName: true,
            systemQty: true,
            physicalQty: true,
            differenceQty: true,
            notes: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    return mergeFinanceRows(
      appRows,
      inventoryRows.map((row) => ({
        id: row.id,
        payload: mapInventoryStockOpnameDashboardPayload(row),
        updatedAt: row.updatedAt,
      }))
    );
  }

  if (!delegate) return appRows;

  const dedicatedRows = await delegate.findMany({
    select: { id: true, payload: true, updatedAt: true },
  });
  return mergeFinanceRows(appRows, dedicatedRows);
}

async function loadDashboardPayloadRows(resource: string): Promise<Array<{ entityId: string; payload: unknown; updatedAt: Date }>> {
  return loadDashboardWorkflowRows(resource);
}

async function findFinanceResourceDoc(resource: string, entityId: string): Promise<{ source: "app" | "dedicated"; payload: Record<string, unknown> } | null> {
  if (resource === "purchase-orders") {
    const procurementRow = await prisma.procurementPurchaseOrder.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        number: true,
        tanggal: true,
        supplierName: true,
        projectId: true,
        vendorId: true,
        supplierAddress: true,
        supplierPhone: true,
        supplierFax: true,
        supplierContact: true,
        attention: true,
        notes: true,
        ppnRate: true,
        topDays: true,
        ref: true,
        poCode: true,
        deliveryDate: true,
        signatoryName: true,
        totalAmount: true,
        status: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            itemCode: true,
            itemName: true,
            qty: true,
            unit: true,
            unitPrice: true,
            total: true,
            qtyReceived: true,
            source: true,
            sourceRef: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (procurementRow) {
      return {
        source: "dedicated",
        payload: asRecord(mapProcurementPurchaseOrderDashboardPayload(procurementRow)),
      };
    }
  }

  if (resource === "invoices") {
    const appRow = await prisma.appEntity.findUnique({
      where: { resource_entityId: { resource, entityId } },
      select: { payload: true },
    });
    const dedicatedInvoice = await prisma.invoiceRecord.findUnique({
      where: { id: entityId },
      select: invoiceDashboardDetailSelect,
    });
    if (dedicatedInvoice) {
      return {
        source: "dedicated",
        payload: {
          ...mapInvoiceDashboardPayload(dedicatedInvoice),
          ...(appRow ? asRecord(appRow.payload) : {}),
        },
      };
    }
  }

  if (resource === "material-requests") {
    const appRow = await prisma.appEntity.findUnique({
      where: { resource_entityId: { resource, entityId } },
      select: { payload: true },
    });
    const materialRequest = await prisma.productionMaterialRequest.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        number: true,
        projectId: true,
        projectName: true,
        requestedBy: true,
        requestedAt: true,
        status: true,
        items: {
          select: {
            id: true,
            itemCode: true,
            itemName: true,
            qty: true,
            unit: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (materialRequest) {
      const appPayload = appRow ? asRecord(appRow.payload) : {};
      const dedicatedPayload = asRecord(mapProductionMaterialRequestDashboardPayload(materialRequest));
      return {
        source: "dedicated",
        payload: { ...dedicatedPayload, ...appPayload },
      };
    }
  }

  const appRow = await prisma.appEntity.findUnique({
    where: { resource_entityId: { resource, entityId } },
    select: { payload: true },
  });
  if (appRow) {
    return { source: "app", payload: asRecord(appRow.payload) };
  }

  const delegate = getDashboardDedicatedDelegate(resource);
  if (!delegate) return null;
  const dedicatedRow = await delegate.findUnique({ where: { id: entityId } });
  if (!dedicatedRow) return null;
  return { source: "dedicated", payload: asRecord(dedicatedRow.payload) };
}

async function updateFinanceResourceDoc(
  resource: string,
  entityId: string,
  source: "app" | "dedicated",
  payload: Record<string, unknown>
): Promise<void> {
  if (resource === "purchase-orders") {
    const next = asRecord(payload);
    await prisma.$transaction(async (tx) => {
      const currentRow = await tx.procurementPurchaseOrder.findUnique({
        where: { id: entityId },
        include: { items: true },
      });
      if (!currentRow) {
        throw new Error(`Purchase order ${entityId} not found`);
      }

      const tanggalRaw = readString(next, "tanggal");
      const tanggalValue =
        tanggalRaw && !Number.isNaN(new Date(tanggalRaw).getTime())
          ? new Date(`${tanggalRaw}T00:00:00.000Z`)
          : currentRow.tanggal;
      const deliveryDateRaw = readString(next, "deliveryDate");
      const deliveryDateValue =
        deliveryDateRaw && !Number.isNaN(new Date(deliveryDateRaw).getTime())
          ? new Date(deliveryDateRaw)
          : null;

      await tx.procurementPurchaseOrder.update({
        where: { id: entityId },
        data: {
          projectId: readString(next, "projectId"),
          vendorId: readString(next, "vendorId"),
          number: readString(next, "noPO") || currentRow.number,
          tanggal: tanggalValue,
          supplierName:
            readString(next, "supplier") ||
            readString(next, "vendor") ||
            readString(next, "vendorName") ||
            currentRow.supplierName,
          supplierAddress: readString(next, "supplierAddress") || "",
          supplierPhone: readString(next, "supplierPhone") || "",
          supplierFax: readString(next, "supplierFax") || "",
          supplierContact: readString(next, "supplierContact") || "",
          attention: readString(next, "attention") || "",
          notes: readString(next, "notes") || "",
          ppnRate: readNumber(next, "ppn") || readNumber(next, "ppnRate"),
          topDays: readNumber(next, "top"),
          ref: readString(next, "ref") || "",
          poCode: readString(next, "po") || "",
          deliveryDate: deliveryDateValue,
          signatoryName: readString(next, "signatoryName") || "",
          totalAmount:
            readNumber(next, "total") ||
            readNumber(next, "totalAmount") ||
            readNumber(next, "grandTotal"),
          status: readString(next, "status") || currentRow.status,
          items: {
            deleteMany: {},
            create: (Array.isArray(next.items) ? next.items : []).map((itemRaw, index) => {
              const item = asRecord(itemRaw);
              return {
                id: readString(item, "id") || `${entityId}-item-${index + 1}`,
                itemCode:
                  readString(item, "kode") ||
                  readString(item, "itemCode") ||
                  readString(item, "itemKode"),
                itemName:
                  readString(item, "nama") ||
                  readString(item, "itemName") ||
                  `Item ${index + 1}`,
                qty: readNumber(item, "qty"),
                unit: readString(item, "unit") || "pcs",
                unitPrice: readNumber(item, "unitPrice") || readNumber(item, "harga"),
                total: readNumber(item, "total"),
                qtyReceived: readNumber(item, "qtyReceived"),
                source: readString(item, "source"),
                sourceRef: readString(item, "sourceRef"),
              };
            }),
          },
        },
      });

      await tx.appEntity.upsert({
        where: {
          resource_entityId: {
            resource,
            entityId,
          },
        },
        update: {
          payload: next as Prisma.InputJsonValue,
        },
        create: {
          resource,
          entityId,
          payload: next as Prisma.InputJsonValue,
        },
      });
    });
    return;
  }

  if (resource === "material-requests") {
    const next = asRecord(payload);
    await prisma.$transaction(async (tx) => {
      const currentRow = await tx.productionMaterialRequest.findUnique({
        where: { id: entityId },
        include: { items: true },
      });
      if (!currentRow) {
        throw new Error(`Material request ${entityId} not found`);
      }

      await tx.productionMaterialRequest.update({
        where: { id: entityId },
        data: {
          number:
            readString(next, "noRequest") ||
            readString(next, "requestNo") ||
            currentRow.number,
          projectId: readString(next, "projectId") || currentRow.projectId,
          projectName: readString(next, "projectName") || currentRow.projectName,
          requestedBy: readString(next, "requestedBy") || currentRow.requestedBy,
          requestedAt: parseDate(readString(next, "requestedAt")) || currentRow.requestedAt,
          status: readString(next, "status") || currentRow.status,
          priority: readString(next, "priority"),
          items: {
            deleteMany: {},
            create: (Array.isArray(next.items) ? next.items : []).map((itemRaw, index) => {
              const item = asRecord(itemRaw);
              return {
                id: readString(item, "id") || `${entityId}-item-${index + 1}`,
                itemCode:
                  readString(item, "itemKode") ||
                  readString(item, "itemCode") ||
                  undefined,
                itemName:
                  readString(item, "itemNama") ||
                  readString(item, "itemName") ||
                  `Item ${index + 1}`,
                qty: readNumber(item, "qty"),
                unit: readString(item, "unit") || "pcs",
              };
            }),
          },
        },
      });

      await tx.appEntity.upsert({
        where: {
          resource_entityId: {
            resource,
            entityId,
          },
        },
        update: {
          payload: next as Prisma.InputJsonValue,
        },
        create: {
          resource,
          entityId,
          payload: next as Prisma.InputJsonValue,
        },
      });
    });
    return;
  }

  if (source === "app") {
    await prisma.appEntity.update({
      where: { resource_entityId: { resource, entityId } },
      data: { payload: payload as Prisma.InputJsonValue },
    });
    return;
  }

  if (resource === "invoices") {
    const next = asRecord(payload);
    await prisma.$transaction(async (tx) => {
      await tx.invoiceRecord.update({
        where: { id: entityId },
        data: {
          projectId: readString(next, "projectId"),
          customerId: readString(next, "customerId"),
          noInvoice: readString(next, "noInvoice") || entityId,
          tanggal: readString(next, "tanggal") || new Date().toISOString().slice(0, 10),
          jatuhTempo: readString(next, "jatuhTempo") || new Date().toISOString().slice(0, 10),
          customer: readString(next, "customer") || readString(next, "customerName") || "-",
          customerName: readString(next, "customerName") || readString(next, "customer"),
          alamat: readString(next, "alamat") || "",
          noPO: readString(next, "noPO") || "",
          subtotal: readNumber(next, "subtotal"),
          ppn: readNumber(next, "ppn"),
          totalBayar: readNumber(next, "totalBayar"),
          paidAmount: readNumber(next, "paidAmount"),
          outstandingAmount: readNumber(next, "outstandingAmount"),
          status: readString(next, "status") || "Unpaid",
          projectName: readString(next, "projectName"),
          noFakturPajak: readString(next, "noFakturPajak"),
          perihal: readString(next, "perihal"),
          termin: readString(next, "termin"),
          buktiTransfer: readString(next, "buktiTransfer"),
          noKwitansi: readString(next, "noKwitansi"),
          tanggalBayar: readString(next, "tanggalBayar"),
        },
      });
      if (Array.isArray(next.items)) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: entityId } });
        if (next.items.length > 0) {
          await tx.invoiceItem.createMany({
            data: next.items.map((item, idx) => {
              const row = asRecord(item);
              return {
                id: `${entityId}-item-${idx + 1}`,
                invoiceId: entityId,
                deskripsi: readString(row, "deskripsi") || "Item",
                qty: readNumber(row, "qty"),
                unit: readString(row, "unit") || "pcs",
                hargaSatuan: readNumber(row, "hargaSatuan"),
                total: readNumber(row, "total"),
                sourceRef: readString(row, "sourceRef"),
                batchNo: readString(row, "batchNo"),
              };
            }),
          });
        }
      }
      await tx.appEntity.upsert({
        where: {
          resource_entityId: {
            resource,
            entityId,
          },
        },
        update: {
          payload: next as Prisma.InputJsonValue,
        },
        create: {
          resource,
          entityId,
          payload: next as Prisma.InputJsonValue,
        },
      });
    });
    return;
  }

  const delegate = getDashboardDedicatedDelegate(resource);
  if (!delegate) {
    throw new Error(`Dedicated delegate for ${resource} not found`);
  }

  await delegate.update({
    where: { id: entityId },
    data: { payload: payload as Prisma.InputJsonValue },
  });
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asArray(input: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => item as Record<string, unknown>);
}

dashboardRouter.get("/dashboard/summary", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const [
      quotations,
      dataCollections,
      projects,
      purchaseOrders,
      invoices,
      vendorInvoices,
      attendances,
      stockItems,
    ] = await Promise.all([
      prisma.quotation.findMany({
        select: quotationDashboardSelect,
      }),
      prisma.dataCollection.findMany({
        select: { status: true, updatedAt: true },
      }),
      prisma.projectRecord.findMany({
        select: projectDashboardSelect,
      }),
      loadDashboardPayloadRows("purchase-orders"),
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      loadDashboardPayloadRows("vendor-invoices"),
      prisma.attendanceRecord.findMany({
        select: { workHours: true, updatedAt: true },
      }),
      loadDashboardPayloadRows("stock-items"),
    ]);

    const quotationSummary = {
      total: quotations.length,
      draft: 0,
      sent: 0,
      approved: 0,
      rejected: 0,
      totalValue: 0,
      pendingHighValue: 0,
    };

    for (const row of quotations) {
      const payload = mapQuotationDashboardPayload(row);
      const status = String(payload.status || "").toUpperCase();
      const grandTotal = Number(readNumber(payload, "grandTotal"));
      quotationSummary.totalValue += grandTotal;

      if (status === "SENT") quotationSummary.sent += 1;
      else if (status === "APPROVED") quotationSummary.approved += 1;
      else if (status === "REJECTED") quotationSummary.rejected += 1;
      else quotationSummary.draft += 1;

      if (!["APPROVED", "REJECTED"].includes(status) && grandTotal >= 50000000) {
        quotationSummary.pendingHighValue += 1;
      }
    }

    const dataCollectionSummary = {
      total: dataCollections.length,
      completed: 0,
      draft: 0,
    };
    for (const row of dataCollections) {
      const status = String(row.status || "").toUpperCase();
      if (status === "COMPLETED" || status === "SELESAI") dataCollectionSummary.completed += 1;
      else dataCollectionSummary.draft += 1;
    }

    const projectSummary = {
      total: projects.length,
      approved: 0,
      rejected: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      totalContractValue: 0,
    };
    for (const row of projects) {
      const payload = mapProjectDashboardPayload(row);
      const approvalStatus = String(payload.approvalStatus || "").toUpperCase();
      const status = String(payload.status || "").toUpperCase();
      const value = readNumber(payload, "nilaiKontrak");
      projectSummary.totalContractValue += value;

      if (approvalStatus === "APPROVED") projectSummary.approved += 1;
      else if (approvalStatus === "REJECTED") projectSummary.rejected += 1;
      else projectSummary.pending += 1;

      if (status === "IN PROGRESS" || status === "IN_PROGRESS") projectSummary.inProgress += 1;
      if (status === "COMPLETED" || status === "DONE") projectSummary.completed += 1;
    }

    let revenue = 0;
    for (const row of invoices) {
      const payload = mapInvoiceDashboardPayload(row);
      revenue += readNumber(payload, "totalBayar");
    }

    let accountsPayable = 0;
    for (const row of vendorInvoices) {
      const payload = asRecord(row.payload);
      const totalAmount = readNumber(payload, "totalAmount");
      const paidAmount = readNumber(payload, "paidAmount");
      const outstandingAmount = readNumber(payload, "outstandingAmount");
      accountsPayable += Math.max(0, outstandingAmount || Math.max(0, totalAmount - paidAmount));
    }

    let totalCommitment = 0;
    for (const row of purchaseOrders) {
      const payload = asRecord(row.payload);
      totalCommitment +=
        readNumber(payload, "total") ||
        readNumber(payload, "totalAmount") ||
        readNumber(payload, "grandTotal");
    }

    let inventoryValue = 0;
    for (const row of stockItems) {
      const payload = asRecord(row.payload);
      const qty =
        readNumber(payload, "onHandQty") ||
        readNumber(payload, "stok") ||
        readNumber(payload, "stock") ||
        readNumber(payload, "qty");
      const unitPrice =
        readNumber(payload, "hargaSatuan") ||
        readNumber(payload, "unitPrice") ||
        readNumber(payload, "price");
      inventoryValue += qty * unitPrice;
    }

    let totalManHours = 0;
    for (const row of attendances) {
      totalManHours += row.workHours ?? 0;
    }

    const pendingPurchaseOrders = purchaseOrders.filter((row) => {
      const payload = asRecord(row.payload);
      const status = String(readString(payload, "status") || "").toUpperCase();
      return status === "DRAFT" || status === "SENT";
    }).length;

    const response = {
      generatedAt: new Date().toISOString(),
      projects: projectSummary,
      quotations: quotationSummary,
      dataCollections: dataCollectionSummary,
      finance: {
        revenue,
        accountsPayable,
        estimatedPayroll: totalManHours * 25000,
        totalCommitment,
        inventoryValue,
      },
      approvals: {
        pendingHighValueQuotations: quotationSummary.pendingHighValue,
        pendingPurchaseOrders,
        pendingCount: quotationSummary.pendingHighValue + pendingPurchaseOrders,
      },
      lastUpdatedAt: maxDate([
        ...quotations.map((row) => row.updatedAt),
        ...dataCollections.map((row) => row.updatedAt),
        ...projects.map((row) => row.updatedAt),
        ...purchaseOrders.map((row) => row.updatedAt),
        ...invoices.map((row) => row.updatedAt),
        ...vendorInvoices.map((row) => row.updatedAt),
        ...attendances.map((row) => row.updatedAt),
        ...stockItems.map((row) => row.updatedAt),
      ]),
    };

    return res.json(response);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/workflow-monitor", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadWorkflow(req.user?.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const staleDaysRaw = Number(req.query?.staleDays);
  const staleDays = Number.isFinite(staleDaysRaw) ? Math.max(1, Math.min(60, Math.floor(staleDaysRaw))) : 2;
  try {
    return res.json(
      await buildWorkflowMonitorPayload({
        staleDays,
        loadDashboardWorkflowRows,
      })
    );
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/system/coverage", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadCoverage(req.user?.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    return res.json(
      await buildSystemCoveragePayload({
        loadDashboardPayloadRows,
      })
    );
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/system/security-health", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadCoverage(req.user?.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    return res.json(await buildSystemSecurityHealthPayload());
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/system/spk-wo-health", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadCoverage(req.user?.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    return res.json(await buildSystemSpkWoHealthPayload());
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/vendor-summary", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const [purchaseOrders, receivings] = await Promise.all([
      loadDashboardPayloadRows("purchase-orders"),
      loadDashboardPayloadRows("receivings"),
    ]);

    const receivingByPoId = new Map<string, Array<Record<string, unknown>>>();
    for (const row of receivings) {
      const payload = asRecord(row.payload);
      const poId = readString(payload, "poId") || readString(payload, "purchaseOrderId");
      if (!poId) continue;
      const list = receivingByPoId.get(poId) || [];
      list.push(payload);
      receivingByPoId.set(poId, list);
    }

    const vendorMap = new Map<
      string,
      {
        name: string;
        totalOrders: number;
        totalValue: number;
        onTimeDeliveries: number;
        lateDeliveries: number;
        partialDeliveries: number;
        leads: number[];
      }
    >();

    for (const row of purchaseOrders) {
      const payload = asRecord(row.payload);
      const poId = readString(payload, "id") || row.entityId;
      const vendorName =
        readString(payload, "vendor") ||
        readString(payload, "supplier") ||
        readString(payload, "vendorName") ||
        "Unknown Vendor";

      const current = vendorMap.get(vendorName) || {
        name: vendorName,
        totalOrders: 0,
        totalValue: 0,
        onTimeDeliveries: 0,
        lateDeliveries: 0,
        partialDeliveries: 0,
        leads: [],
      };

      current.totalOrders += 1;
      current.totalValue +=
        readNumber(payload, "total") ||
        readNumber(payload, "totalAmount") ||
        readNumber(payload, "amount") ||
        readNumber(payload, "grandTotal");

      const status = String(readString(payload, "status") || "").toUpperCase();
      if (status === "PARTIAL") current.partialDeliveries += 1;

      const poDate = parseDate(readString(payload, "tanggal") || readString(payload, "date"));
      const recvRows = receivingByPoId.get(poId) || [];
      for (const recvPayload of recvRows) {
        const recvDate = parseDate(
          readString(recvPayload, "tanggal") || readString(recvPayload, "date")
        );
        if (!poDate || !recvDate) continue;
        const diffDays = Math.ceil(
          (recvDate.getTime() - poDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        current.leads.push(diffDays);
        if (diffDays <= 7) current.onTimeDeliveries += 1;
        else current.lateDeliveries += 1;
      }

      vendorMap.set(vendorName, current);
    }

    const vendors = Array.from(vendorMap.values())
      .map((vendor) => {
        const avgLeadTime =
          vendor.leads.length > 0
            ? vendor.leads.reduce((acc, days) => acc + days, 0) / vendor.leads.length
            : 0;
        const onTimeRate =
          vendor.totalOrders > 0 ? (vendor.onTimeDeliveries / vendor.totalOrders) * 100 : 0;
        return {
          ...vendor,
          avgLeadTime,
          onTimeRate,
          score: (vendor.onTimeDeliveries / (vendor.totalOrders || 1)) * 5,
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue);

    return res.json({
      generatedAt: new Date().toISOString(),
      totalVendors: vendors.length,
      totalOrders: vendors.reduce((sum, vendor) => sum + vendor.totalOrders, 0),
      totalSpend: vendors.reduce((sum, vendor) => sum + vendor.totalValue, 0),
      vendors,
      lastUpdatedAt: maxDate([
        ...purchaseOrders.map((row) => row.updatedAt),
        ...receivings.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/production-summary", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const [workOrders, productionReports] = await Promise.all([
      loadDashboardPayloadRows("work-orders"),
      loadDashboardPayloadRows("production-reports"),
    ]);

    let draft = 0;
    let inProgress = 0;
    let qc = 0;
    let completed = 0;
    let overdue = 0;
    let avgProgress = 0;
    let progressCount = 0;

    const now = new Date();
    for (const row of workOrders) {
      const payload = asRecord(row.payload);
      const status = String(
        readString(payload, "status") || readString(payload, "workflowStatus") || ""
      ).toUpperCase();
      const deadline = parseDate(readString(payload, "deadline") || readString(payload, "dueDate"));
      const completedQty = readNumber(payload, "completedQty");
      const targetQty = readNumber(payload, "targetQty");

      if (status === "DRAFT") draft += 1;
      else if (status === "IN PROGRESS" || status === "IN_PROGRESS") inProgress += 1;
      else if (status === "QC") qc += 1;
      else if (status === "COMPLETED" || status === "DONE") completed += 1;

      if (deadline && deadline < now && status !== "COMPLETED" && status !== "DONE") overdue += 1;

      if (targetQty > 0) {
        avgProgress += Math.max(0, Math.min(100, (completedQty / targetQty) * 100));
        progressCount += 1;
      }
    }

    let outputQty = 0;
    let rejectQty = 0;
    for (const row of productionReports) {
      const payload = asRecord(row.payload);
      outputQty += readNumber(payload, "outputQty") || readNumber(payload, "qty");
      rejectQty += readNumber(payload, "rejectQty") || readNumber(payload, "rejectedQty");
    }

    return res.json({
      generatedAt: new Date().toISOString(),
      workOrders: {
        total: workOrders.length,
        draft,
        inProgress,
        qc,
        completed,
        overdue,
        avgProgress: progressCount > 0 ? Number((avgProgress / progressCount).toFixed(2)) : 0,
      },
      reports: {
        total: productionReports.length,
        outputQty,
        rejectQty,
      },
      lastUpdatedAt: maxDate([
        ...workOrders.map((row) => row.updatedAt),
        ...productionReports.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/procurement-summary", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const [projects, purchaseOrders, stockItems] = await Promise.all([
      prisma.projectRecord.findMany({
        select: projectDashboardSelect,
      }),
      loadDashboardPayloadRows("purchase-orders"),
      loadDashboardPayloadRows("stock-items"),
    ]);

    const stockByKode = new Map<string, Record<string, unknown>>();
    for (const row of stockItems) {
      const payload = asRecord(row.payload);
      const kode = readString(payload, "kode") || readString(payload, "code") || readString(payload, "itemKode");
      if (!kode) continue;
      stockByKode.set(kode, payload);
    }

    const pendingPoQtyMap: Record<string, number> = {};
    for (const row of purchaseOrders) {
      const payload = asRecord(row.payload);
      const status = String(readString(payload, "status") || "").toUpperCase();
      if (!["SENT", "PARTIAL", "APPROVED"].includes(status)) continue;
      const poItems = asArray(payload.items);
      for (const item of poItems) {
        const kode = readString(item, "kode") || readString(item, "itemCode") || readString(item, "itemKode");
        if (!kode) continue;
        const qty = readNumber(item, "qty");
        pendingPoQtyMap[kode] = (pendingPoQtyMap[kode] || 0) + qty;
      }
    }

    type DemandRow = {
      kode: string;
      nama: string;
      unit: string;
      supplier: string;
      stock: number;
      onOrder: number;
      requiredByProjects: Array<{
        projectId: string;
        projectNo: string;
        projectName: string;
        qty: number;
        source: string;
      }>;
      totalRequired: number;
      gap: number;
    };

    const demandMap = new Map<string, DemandRow>();
    for (const row of projects) {
      const payload = mapProjectDashboardPayload(row);
      const projectStatus = String(readString(payload, "status") || "").toUpperCase();
      const approvalStatus = String(readString(payload, "approvalStatus") || "").toUpperCase();
      const projectReady =
        ["IN PROGRESS", "IN_PROGRESS", "PLANNING"].includes(projectStatus) &&
        approvalStatus === "APPROVED";
      if (!projectReady) continue;

      const projectId = readString(payload, "id") || "";
      const projectNo = readString(payload, "kodeProject") || projectId;
      const projectName = readString(payload, "namaProject") || "Unknown Project";

      const boqItems = asArray(payload.boq);
      for (const boqItem of boqItems) {
        const itemKode = readString(boqItem, "itemKode");
        if (!itemKode) continue;
        const master = stockByKode.get(itemKode) || {};
        const current =
          demandMap.get(itemKode) ||
          {
            kode: itemKode,
            nama:
              readString(boqItem, "materialName") ||
              readString(master, "nama") ||
              "Unknown Item",
            unit: readString(boqItem, "unit") || readString(master, "satuan") || "Unit",
            supplier:
              readString(boqItem, "supplier") ||
              readString(master, "supplier") ||
              "Unknown",
            stock:
              readNumber(master, "onHandQty") ||
              readNumber(master, "stok") ||
              readNumber(master, "stock") ||
              readNumber(master, "qty"),
            onOrder: pendingPoQtyMap[itemKode] || 0,
            requiredByProjects: [],
            totalRequired: 0,
            gap: 0,
          };

        const qty = readNumber(boqItem, "qtyEstimate");
        current.totalRequired += qty;
        current.requiredByProjects.push({
          projectId,
          projectNo,
          projectName,
          qty,
          source: "BOQ",
        });
        demandMap.set(itemKode, current);
      }

      const materialRequests = asArray(payload.materialRequests);
      for (const mr of materialRequests) {
        const mrStatus = String(readString(mr, "status") || "").toUpperCase();
        if (!["APPROVED", "ORDERED"].includes(mrStatus)) continue;
        const sourceRef = readString(mr, "noRequest") || "-";
        const mrItems = asArray(mr.items);
        for (const mrItem of mrItems) {
          const itemKode = readString(mrItem, "itemKode");
          if (!itemKode) continue;
          const master = stockByKode.get(itemKode) || {};
          const current =
            demandMap.get(itemKode) ||
            {
              kode: itemKode,
              nama:
                readString(mrItem, "itemNama") ||
                readString(master, "nama") ||
                "Unknown Item",
              unit: readString(mrItem, "unit") || readString(master, "satuan") || "Unit",
              supplier: readString(master, "supplier") || "Unknown",
              stock: readNumber(master, "stok"),
              onOrder: pendingPoQtyMap[itemKode] || 0,
              requiredByProjects: [],
              totalRequired: 0,
              gap: 0,
            };

          const qty = readNumber(mrItem, "qty");
          current.totalRequired += qty;
          current.requiredByProjects.push({
            projectId,
            projectNo,
            projectName,
            qty,
            source: `MR ${sourceRef}`,
          });
          demandMap.set(itemKode, current);
        }
      }
    }

    const demandGaps = Array.from(demandMap.values())
      .map((item) => ({
        ...item,
        gap: item.totalRequired - (item.stock + item.onOrder),
      }))
      .filter((item) => item.gap > 0)
      .sort((a, b) => b.gap - a.gap);

    return res.json({
      generatedAt: new Date().toISOString(),
      totalGapItems: demandGaps.length,
      totalGapQty: demandGaps.reduce((sum, item) => sum + item.gap, 0),
      demandGaps,
      lastUpdatedAt: maxDate([
        ...projects.map((row) => row.updatedAt),
        ...purchaseOrders.map((row) => row.updatedAt),
        ...stockItems.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/hr-summary", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const [employees, attendances] = await Promise.all([
      prisma.employeeRecord.findMany({
        select: { status: true, employmentType: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.attendanceRecord.findMany({
        select: { date: true, workHours: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    let active = 0;
    let inactive = 0;
    let resigned = 0;
    let permanent = 0;
    let contract = 0;
    let thl = 0;
    let internship = 0;

    for (const row of employees) {
      const status = String(row.status || "").toUpperCase();
      const employmentType = String(row.employmentType || "").toUpperCase();

      if (status === "ACTIVE" || status === "AKTIF") active += 1;
      else if (status === "RESIGNED") resigned += 1;
      else inactive += 1;

      if (employmentType === "PERMANENT" || employmentType === "TETAP") permanent += 1;
      else if (employmentType === "CONTRACT" || employmentType === "PKWT") contract += 1;
      else if (employmentType === "THL") thl += 1;
      else if (employmentType === "INTERNSHIP" || employmentType === "MAGANG") internship += 1;
    }

    const today = new Date().toISOString().slice(0, 10);
    let todayAttendance = 0;
    let totalWorkHours = 0;
    for (const row of attendances) {
      const date = row.date;
      if (date === today) todayAttendance += 1;
      totalWorkHours += row.workHours ?? 0;
    }

    return res.json({
      generatedAt: new Date().toISOString(),
      employees: {
        total: employees.length,
        active,
        inactive,
        resigned,
        permanent,
        contract,
        thl,
        internship,
      },
      attendance: {
        totalRecords: attendances.length,
        todayAttendance,
        totalWorkHours,
      },
      lastUpdatedAt: maxDate([
        ...employees.map((row) => row.updatedAt),
        ...attendances.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-cashflow-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [customerInvoices, vendorInvoices, vendorExpenses, vendors, customers] = await Promise.all([
      prisma.financeCustomerInvoice.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          customerId: true,
          tanggal: true,
          dueDate: true,
          totalAmount: true,
          paidAmount: true,
          outstandingAmount: true,
          status: true,
          updatedAt: true,
        },
      }),
      prisma.financeVendorInvoice.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          vendorId: true,
          totalAmount: true,
          paidAmount: true,
          outstandingAmount: true,
          status: true,
          tanggal: true,
          dueDate: true,
          updatedAt: true,
        },
      }),
      prisma.financeVendorExpense.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          vendorId: true,
          totalNominal: true,
          status: true,
          paidAt: true,
          tanggal: true,
          updatedAt: true,
        },
      }),
      prisma.vendorRecord.findMany({
        select: { id: true, kodeVendor: true, namaVendor: true, kategori: true, alamat: true, kota: true, kontak: true, telepon: true, email: true, npwp: true, paymentTerms: true, rating: true, status: true, updatedAt: true },
      }),
      prisma.customerRecord.findMany({
        select: { id: true, kodeCustomer: true, namaCustomer: true, alamat: true, kota: true, kontak: true, telepon: true, email: true, npwp: true, paymentTerms: true, rating: true, status: true, updatedAt: true },
      }),
    ]);

    const vendorRows = vendors.map((row) => ({
      id: row.id,
      kodeVendor: row.kodeVendor,
      namaVendor: row.namaVendor,
      kategori: row.kategori,
      alamat: row.alamat,
      kota: row.kota,
      kontak: row.kontak,
      telepon: row.telepon,
      email: row.email,
      npwp: row.npwp,
      paymentTerms: row.paymentTerms,
      rating: row.rating,
      status: row.status,
    }));
    const customerRows = customers.map((row) => ({
      id: row.id,
      kodeCustomer: row.kodeCustomer,
      namaCustomer: row.namaCustomer,
      alamat: row.alamat,
      kota: row.kota,
      kontak: row.kontak,
      telepon: row.telepon,
      email: row.email,
      npwp: row.npwp,
      paymentTerms: row.paymentTerms,
      rating: row.rating,
      status: row.status,
    }));

    const calculateAgingDays = (dueDateRaw: string | null, statusRaw: string) => {
      if (statusRaw.toUpperCase() === "PAID") return 0;
      const due = parseDate(dueDateRaw);
      if (!due) return 0;
      const today = new Date();
      const diffTime = today.getTime() - due.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    };

    const normalizedInvoices = customerInvoices.map((row, idx) => {
      const totalNominal = Number(row.totalAmount || 0);
      const paidAmount = Number(row.paidAmount || 0);
      const outstandingAmount = Math.max(0, Number(row.outstandingAmount || totalNominal - paidAmount));
      return {
        id: row.id || `INV-${idx + 1}`,
        customerId: row.customerId || "",
        tanggal: row.tanggal ? row.tanggal.toISOString().slice(0, 10) : "",
        dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : "",
        status: row.status || "Unpaid",
        totalNominal,
        paidAmount,
        outstandingAmount,
      };
    });

    const normalizedVendorInvoices = vendorInvoices.map((row, idx) => ({
      id: row.id || `VIN-${idx + 1}`,
      vendorId: row.vendorId || "",
      status: row.status || "Unpaid",
      totalNominal: Number(row.totalAmount || 0),
      paidAmount: Number(row.paidAmount || 0),
      outstandingAmount: Math.max(0, Number(row.outstandingAmount || Number(row.totalAmount || 0) - Number(row.paidAmount || 0))),
      tanggal: row.tanggal ? row.tanggal.toISOString().slice(0, 10) : "",
      dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : "",
    }));

    const normalizedExpenses = vendorExpenses.map((row, idx) => ({
      id: row.id || `EXP-${idx + 1}`,
      vendorId: row.vendorId || "",
      status: row.status || "Draft",
      totalNominal: Number(row.totalNominal || 0),
      paidAt: row.paidAt ? row.paidAt.toISOString().slice(0, 10) : "",
      tanggal: row.tanggal ? row.tanggal.toISOString().slice(0, 10) : "",
    }));

    const normalizedVendors = vendorRows.map((payload, idx) => ({
      id: readString(payload, "id") || `VND-${idx + 1}`,
      namaVendor: readString(payload, "namaVendor") || readString(payload, "name") || "Unknown Vendor",
    }));

    const normalizedCustomers = customerRows.map((payload, idx) => ({
      id: readString(payload, "id") || `CST-${idx + 1}`,
      namaCustomer:
        readString(payload, "namaCustomer") || readString(payload, "name") || "Unknown Customer",
    }));

    const totalAR = normalizedInvoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0);
    const totalARInvoiced = normalizedInvoices.reduce((sum, inv) => sum + inv.totalNominal, 0);
    const totalARPaid = normalizedInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);

    const totalAP =
      normalizedVendorInvoices
        .filter((inv) => inv.status.toUpperCase() !== "PAID")
        .reduce((sum, inv) => sum + inv.outstandingAmount, 0) +
      normalizedExpenses
        .filter((exp) => ["APPROVED", "PENDING APPROVAL"].includes(exp.status.toUpperCase()))
        .reduce((sum, exp) => sum + exp.totalNominal, 0);
    const totalAPPaid =
      normalizedVendorInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0) +
      normalizedExpenses
        .filter((exp) => exp.status.toUpperCase() === "PAID")
        .reduce((sum, exp) => sum + exp.totalNominal, 0);

    const arAging = {
      current: normalizedInvoices
        .filter((inv) => calculateAgingDays(inv.dueDate, inv.status) === 0 && inv.status.toUpperCase() !== "PAID")
        .reduce((sum, inv) => sum + inv.outstandingAmount, 0),
      days0to30: normalizedInvoices
        .filter((inv) => {
          const days = calculateAgingDays(inv.dueDate, inv.status);
          return days > 0 && days <= 30 && inv.status.toUpperCase() !== "PAID";
        })
        .reduce((sum, inv) => sum + inv.outstandingAmount, 0),
      days31to60: normalizedInvoices
        .filter((inv) => {
          const days = calculateAgingDays(inv.dueDate, inv.status);
          return days > 30 && days <= 60 && inv.status.toUpperCase() !== "PAID";
        })
        .reduce((sum, inv) => sum + inv.outstandingAmount, 0),
      days61to90: normalizedInvoices
        .filter((inv) => {
          const days = calculateAgingDays(inv.dueDate, inv.status);
          return days > 60 && days <= 90 && inv.status.toUpperCase() !== "PAID";
        })
        .reduce((sum, inv) => sum + inv.outstandingAmount, 0),
      over90: normalizedInvoices
        .filter((inv) => {
          const days = calculateAgingDays(inv.dueDate, inv.status);
          return days > 90 && inv.status.toUpperCase() !== "PAID";
        })
        .reduce((sum, inv) => sum + inv.outstandingAmount, 0),
    };

    const netWorkingCapital = totalAR - totalAP;
    const workingCapitalRatio = totalAP > 0 ? totalAR / totalAP : 0;
    const hasCashflowData =
      normalizedInvoices.length > 0 ||
      normalizedVendorInvoices.length > 0 ||
      normalizedExpenses.length > 0;
    let healthScore = 0;
    if (hasCashflowData) {
      healthScore = 50;
      if (arAging.over90 === 0) healthScore += 20;
      if (arAging.days61to90 < totalAR * 0.1) healthScore += 10;
      if (workingCapitalRatio > 1) healthScore += 20;
      healthScore = Math.min(100, Math.max(0, healthScore));
    }

    const today = new Date();
    const getExpectedCollections = (days: number) => {
      const futureDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
      return normalizedInvoices
        .filter((inv) => {
          const due = parseDate(inv.dueDate);
          return !!due && inv.status.toUpperCase() !== "PAID" && due >= today && due <= futureDate;
        })
        .reduce((sum, inv) => sum + inv.outstandingAmount, 0);
    };

    const overdueInvoices = normalizedInvoices.filter((inv) => {
      const days = calculateAgingDays(inv.dueDate, inv.status);
      return days > 0 && inv.status.toUpperCase() !== "PAID";
    }).length;

    const highValueOverdue = normalizedInvoices.filter((inv) => {
      const days = calculateAgingDays(inv.dueDate, inv.status);
      return days > 30 && inv.outstandingAmount > 100000000 && inv.status.toUpperCase() !== "PAID";
    }).length;

    const unpaidInvoices = normalizedInvoices.filter((inv) => inv.status.toUpperCase() !== "PAID");
    const unpaidInvoiceCount = unpaidInvoices.length;
    const pendingExpenseCount =
      normalizedVendorInvoices.filter((inv) => inv.status.toUpperCase() !== "PAID").length +
      normalizedExpenses.filter((exp) =>
        ["APPROVED", "PENDING APPROVAL"].includes(exp.status.toUpperCase())
      ).length;
    const avgDaysOutstanding = unpaidInvoiceCount > 0
      ? Math.round(
        unpaidInvoices.reduce((sum, inv) => {
          const issuedDate = parseDate(inv.tanggal);
          if (!issuedDate) return sum;
          const diffTime = new Date().getTime() - issuedDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return sum + Math.max(0, diffDays);
        }, 0) / unpaidInvoiceCount
      )
      : 0;

    const topCustomers = normalizedCustomers
      .map((customer) => {
        const invoices = normalizedInvoices.filter((inv) => inv.customerId === customer.id);
        const outstanding = invoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0);
        return {
          ...customer,
          outstanding,
          invoiceCount: invoices.length,
        };
      })
      .filter((row) => row.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 5);

    const topVendors = normalizedVendors
      .map((vendor) => {
        const invoices = normalizedVendorInvoices.filter(
          (inv) => inv.vendorId === vendor.id && inv.status.toUpperCase() !== "PAID"
        );
        const expenses = normalizedExpenses.filter(
          (exp) => exp.vendorId === vendor.id && ["APPROVED", "PENDING APPROVAL"].includes(exp.status.toUpperCase())
        );
        const payable =
          invoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0) +
          expenses.reduce((sum, exp) => sum + exp.totalNominal, 0);
        return {
          ...vendor,
          payable,
          expenseCount: invoices.length + expenses.length,
        };
      })
      .filter((row) => row.payable > 0)
      .sort((a, b) => b.payable - a.payable)
      .slice(0, 5);

    return res.json({
      generatedAt: new Date().toISOString(),
      metrics: {
        totalAR,
        totalARInvoiced,
        totalARPaid,
        totalAP,
        totalAPPaid,
        netWorkingCapital,
        workingCapitalRatio,
        healthScore,
        arAging,
        expectedCollections30: getExpectedCollections(30),
        expectedCollections60: getExpectedCollections(60),
        expectedCollections90: getExpectedCollections(90),
        overdueInvoices,
        highValueOverdue,
        unpaidInvoiceCount,
        pendingExpenseCount,
        avgDaysOutstanding,
        topCustomers,
        topVendors,
      },
      lastUpdatedAt: maxDate([
        ...customerInvoices.map((row) => row.updatedAt),
        ...vendorInvoices.map((row) => row.updatedAt),
        ...vendorExpenses.map((row) => row.updatedAt),
        ...vendors.map((row) => row.updatedAt),
        ...customers.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-cashflow-page-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [invoices, purchaseOrders, payrolls, vendorInvoices] = await Promise.all([
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      loadDashboardPayloadRows("purchase-orders"),
      prisma.payrollRecord.findMany({
        select: { month: true, year: true, employeeName: true, totalPayroll: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      loadDashboardPayloadRows("vendor-invoices"),
    ]);

    const invoiceRows = invoices.map((row) => mapInvoiceDashboardPayload(row));
    const poRows = purchaseOrders.map((row) => asRecord(row.payload));
    const vendorInvRows = vendorInvoices.map((row) => asRecord(row.payload));

    const parsePayrollDate = (month?: string | null, year?: number | null): Date | null => {
      if (!month || !year) return null;
      const normalized = String(month).trim().toLowerCase();
      const monthMap: Record<string, number> = {
        january: 0, januari: 0, jan: 0,
        february: 1, februari: 1, feb: 1,
        march: 2, maret: 2, mar: 2,
        april: 3, apr: 3,
        may: 4, mei: 4,
        june: 5, juni: 5, jun: 5,
        july: 6, juli: 6, jul: 6,
        august: 7, agustus: 7, agu: 7, aug: 7,
        september: 8, sep: 8,
        october: 9, oktober: 9, okt: 9, oct: 9,
        november: 10, nov: 10,
        december: 11, desember: 11, des: 11, dec: 11,
      };
      const idx = monthMap[normalized];
      if (idx === undefined) return null;
      return new Date(year, idx, 1);
    };

    const normalizedInvoices = invoiceRows.map((row) => ({
      status: String(readString(row, "status") || "").toUpperCase(),
      tanggal: readString(row, "tanggal") || readString(row, "date") || "",
      paymentDate:
        readString(row, "tanggalBayar") ||
        readString(row, "paidAt") ||
        readString(row, "tanggal") ||
        readString(row, "date") ||
        "",
      customer: readString(row, "customer") || readString(row, "customerName") || "-",
      totalBayar: readNumber(row, "totalBayar") || readNumber(row, "totalAmount"),
      paidAmount: readNumber(row, "paidAmount"),
    }));

    const normalizedPos = poRows.map((row) => ({
      status: String(readString(row, "status") || "").toUpperCase(),
      tanggal: readString(row, "tanggal") || readString(row, "date") || "",
      supplier:
        readString(row, "supplier") ||
        readString(row, "vendor") ||
        readString(row, "vendorName") ||
        "-",
      total:
        readNumber(row, "total") ||
        readNumber(row, "totalAmount") ||
        readNumber(row, "grandTotal"),
    }));

    const normalizedPayrolls = payrolls.map((row) => ({
      month: row.month || "",
      year: row.year || 0,
      employeeName: row.employeeName || "All Employees",
      totalPayroll: row.totalPayroll || 0,
      status: row.status || "Pending",
    }));

    const normalizedVendorInv = vendorInvRows.map((row) => ({
      status: String(readString(row, "status") || "").toUpperCase(),
      paidAmount: readNumber(row, "paidAmount"),
    }));

    const inflow = normalizedInvoices
      .filter((inv) => inv.status === "PAID")
      .reduce((sum, inv) => sum + (inv.paidAmount || inv.totalBayar), 0);
    const outflowPurchases = normalizedPos
      .filter((po) => po.status === "COMPLETED" || po.status === "RECEIVED")
      .reduce((sum, po) => sum + po.total, 0);
    const outflowPayroll = normalizedPayrolls.reduce((sum, p) => sum + p.totalPayroll, 0);
    const totalOutflow = outflowPurchases + outflowPayroll;
    const netCashflow = inflow - totalOutflow;
    const outflowOther = normalizedVendorInv
      .filter((v) => v.status === "PAID" || v.status === "PARTIAL")
      .reduce((sum, v) => sum + v.paidAmount, 0);

    const monthKeys: string[] = [];
    const monthMap = new Map<string, { key: string; month: string; inflow: number; outflow: number }>();
    const monthLabel = (date: Date) =>
      date.toLocaleDateString("id-ID", { month: "short" }).replace(".", "");
    const keyFor = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const ensure = (date: Date) => {
      const key = keyFor(date);
      if (!monthMap.has(key)) {
        monthMap.set(key, { key, month: monthLabel(date), inflow: 0, outflow: 0 });
        monthKeys.push(key);
      }
      return monthMap.get(key)!;
    };

    normalizedInvoices
      .filter((inv) => inv.status === "PAID")
      .forEach((inv) => {
        const date = parseDate(inv.paymentDate);
        if (!date) return;
        const row = ensure(date);
        row.inflow += inv.paidAmount || inv.totalBayar;
      });

    normalizedPos
      .filter((po) => po.status === "COMPLETED" || po.status === "RECEIVED")
      .forEach((po) => {
        const date = parseDate(po.tanggal);
        if (!date) return;
        const row = ensure(date);
        row.outflow += po.total;
      });

    normalizedPayrolls.forEach((p) => {
      const date = parsePayrollDate(p.month, p.year || 0);
      if (!date) return;
      const row = ensure(date);
      row.outflow += p.totalPayroll;
    });

    const monthlyCashflow = monthKeys
      .map((key) => monthMap.get(key)!)
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6);

    const pieData = [
      { name: "Material Purchases", value: outflowPurchases, color: "#3b82f6" },
      { name: "Payroll/Labor", value: outflowPayroll, color: "#10b981" },
      { name: "Vendor/Other", value: outflowOther, color: "#f59e0b" },
    ].filter((x) => x.value > 0);

    const txRows: Array<{
      date: string;
      category: string;
      entity: string;
      amount: number;
      direction: "IN" | "OUT";
      status: string;
    }> = [];

    normalizedInvoices
      .filter((inv) => inv.status === "PAID")
      .forEach((inv) => {
        const date = parseDate(inv.paymentDate);
        if (!date) return;
        txRows.push({
          date: date.toISOString(),
          category: "Revenue / Invoice",
          entity: inv.customer,
          amount: inv.paidAmount || inv.totalBayar,
          direction: "IN",
          status: "Settled",
        });
      });

    normalizedPos
      .filter((po) => po.status === "COMPLETED" || po.status === "RECEIVED")
      .forEach((po) => {
        const date = parseDate(po.tanggal);
        if (!date) return;
        txRows.push({
          date: date.toISOString(),
          category: "Purchase / PO",
          entity: po.supplier,
          amount: po.total,
          direction: "OUT",
          status: po.status,
        });
      });

    normalizedPayrolls.forEach((p) => {
      const date = parsePayrollDate(p.month, p.year || 0);
      if (!date) return;
      txRows.push({
        date: date.toISOString(),
        category: "Payroll / Gaji",
        entity: p.employeeName,
        amount: p.totalPayroll,
        direction: "OUT",
        status: p.status,
      });
    });

    const transactionLog = txRows
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);

    return res.json({
      generatedAt: new Date().toISOString(),
      stats: {
        inflow,
        outflowPurchases,
        outflowPayroll,
        totalOutflow,
        netCashflow,
      },
      outflowOther,
      monthlyCashflow,
      pieData,
      transactionLog,
      lastUpdatedAt: maxDate([
        ...invoices.map((row) => row.updatedAt),
        ...purchaseOrders.map((row) => row.updatedAt),
        ...payrolls.map((row) => row.updatedAt),
        ...vendorInvoices.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-ar-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [invoices, customers] = await Promise.all([
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      prisma.customerRecord.findMany({
        select: { id: true, kodeCustomer: true, namaCustomer: true, alamat: true, kota: true, kontak: true, telepon: true, email: true, npwp: true, paymentTerms: true, rating: true, status: true, updatedAt: true },
      }),
    ]);

    const invoiceRows = invoices.map((row) => mapInvoiceDashboardPayload(row));
    const customerRows = customers.map((row) => ({
      id: row.id,
      kodeCustomer: row.kodeCustomer,
      namaCustomer: row.namaCustomer,
      alamat: row.alamat,
      kota: row.kota,
      kontak: row.kontak,
      telepon: row.telepon,
      email: row.email,
      npwp: row.npwp,
      paymentTerms: row.paymentTerms,
      rating: row.rating,
      status: row.status,
    }));

    const calcAging = (dueDateRaw: string | null, statusRaw: string) => {
      if (statusRaw.toUpperCase() === "PAID") return 0;
      const due = parseDate(dueDateRaw);
      if (!due) return 0;
      const diffTime = new Date().getTime() - due.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    };

    const normalizedInvoices = invoiceRows.map((payload, idx) => {
      const totalNominal =
        readNumber(payload, "totalBayar") ||
        readNumber(payload, "subtotal") ||
        readNumber(payload, "totalNominal") ||
        readNumber(payload, "totalAmount") ||
        readNumber(payload, "amount");
      const paidAmount = readNumber(payload, "paidAmount");
      const outstandingAmount = Math.max(
        0,
        readNumber(payload, "outstandingAmount") || totalNominal - paidAmount
      );
      return {
        id: readString(payload, "id") || `INV-${idx + 1}`,
        customerId: readString(payload, "customerId") || "",
        status: readString(payload, "status") || "Unpaid",
        dueDate: readString(payload, "dueDate") || readString(payload, "jatuhTempo") || "",
        totalNominal,
        paidAmount,
        outstandingAmount,
      };
    });

    const normalizedCustomers = customerRows.map((payload, idx) => ({
      id: readString(payload, "id") || `CST-${idx + 1}`,
      namaCustomer:
        readString(payload, "namaCustomer") || readString(payload, "name") || "Unknown Customer",
    }));

    const totalAR = normalizedInvoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0);
    const totalInvoiced = normalizedInvoices.reduce((sum, inv) => sum + inv.totalNominal, 0);
    const totalPaid = normalizedInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const activeInvoiceCount = normalizedInvoices.filter((inv) => inv.status.toUpperCase() !== "PAID").length;

    const overdueInvoices = normalizedInvoices.filter((inv) => {
      const days = calcAging(inv.dueDate, inv.status);
      return days > 0 && inv.status.toUpperCase() !== "PAID";
    });
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.outstandingAmount, 0);

    const aging0to30 = normalizedInvoices
      .filter((inv) => {
        const days = calcAging(inv.dueDate, inv.status);
        return days >= 0 && days <= 30 && inv.status.toUpperCase() !== "PAID";
      })
      .reduce((sum, inv) => sum + inv.outstandingAmount, 0);
    const aging31to60 = normalizedInvoices
      .filter((inv) => {
        const days = calcAging(inv.dueDate, inv.status);
        return days >= 31 && days <= 60 && inv.status.toUpperCase() !== "PAID";
      })
      .reduce((sum, inv) => sum + inv.outstandingAmount, 0);
    const aging61to90 = normalizedInvoices
      .filter((inv) => {
        const days = calcAging(inv.dueDate, inv.status);
        return days >= 61 && days <= 90 && inv.status.toUpperCase() !== "PAID";
      })
      .reduce((sum, inv) => sum + inv.outstandingAmount, 0);
    const agingOver90 = normalizedInvoices
      .filter((inv) => {
        const days = calcAging(inv.dueDate, inv.status);
        return days > 90 && inv.status.toUpperCase() !== "PAID";
      })
      .reduce((sum, inv) => sum + inv.outstandingAmount, 0);

    const topCustomers = normalizedCustomers
      .map((customer) => {
        const invs = normalizedInvoices.filter((inv) => inv.customerId === customer.id);
        const customerOutstanding = invs.reduce((sum, inv) => sum + inv.outstandingAmount, 0);
        const customerOverdue = invs.filter((inv) => calcAging(inv.dueDate, inv.status) > 0).length;
        return {
          id: customer.id,
          namaCustomer: customer.namaCustomer,
          totalOutstanding: customerOutstanding,
          invoiceCount: invs.length,
          overdueCount: customerOverdue,
        };
      })
      .filter((row) => row.totalOutstanding > 0)
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
      .slice(0, 5);

    return res.json({
      generatedAt: new Date().toISOString(),
      metrics: {
        totalAR,
        totalInvoiced,
        totalPaid,
        totalInvoiceCount: normalizedInvoices.length,
        activeInvoiceCount,
        overdueAmount,
        overdueCount: overdueInvoices.length,
        aging0to30,
        aging31to60,
        aging61to90,
        agingOver90,
      },
      topCustomers,
      lastUpdatedAt: maxDate([
        ...invoices.map((row) => row.updatedAt),
        ...customers.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-vendor-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [vendorExpenses, vendors] = await Promise.all([
      loadDashboardPayloadRows("vendor-expenses"),
      prisma.vendorRecord.findMany({
        select: { id: true, kodeVendor: true, namaVendor: true, kategori: true, alamat: true, kota: true, kontak: true, telepon: true, email: true, npwp: true, paymentTerms: true, rating: true, status: true, updatedAt: true },
      }),
    ]);

    const expenses = vendorExpenses.map((row) => asRecord(row.payload));
    const vendorRows = vendors.map((row) => ({
      id: row.id,
      kodeVendor: row.kodeVendor,
      namaVendor: row.namaVendor,
      kategori: row.kategori,
      alamat: row.alamat,
      kota: row.kota,
      kontak: row.kontak,
      telepon: row.telepon,
      email: row.email,
      npwp: row.npwp,
      paymentTerms: row.paymentTerms,
      rating: row.rating,
      status: row.status,
    }));

    const normalizedExpenses = expenses.map((payload, idx) => ({
      id: readString(payload, "id") || `EXP-${idx + 1}`,
      vendorId: readString(payload, "vendorId") || "",
      vendorName: readString(payload, "vendorName") || "Unknown Vendor",
      projectName: readString(payload, "projectName") || "",
      kategori: readString(payload, "kategori") || "Other",
      status: String(readString(payload, "status") || "Draft").toUpperCase(),
      totalNominal:
        readNumber(payload, "totalNominal") ||
        readNumber(payload, "amount") ||
        readNumber(payload, "nominal"),
    }));

    const totalExpenses = normalizedExpenses.reduce((sum, exp) => sum + exp.totalNominal, 0);
    const pendingExpenses = normalizedExpenses.filter((e) => e.status === "PENDING APPROVAL");
    const approvedExpenses = normalizedExpenses.filter((e) => e.status === "APPROVED");
    const paidExpenses = normalizedExpenses.filter((e) => e.status === "PAID");
    const totalPending = pendingExpenses.reduce((sum, exp) => sum + exp.totalNominal, 0);
    const totalApproved = approvedExpenses.reduce((sum, exp) => sum + exp.totalNominal, 0);
    const totalPaid = paidExpenses.reduce((sum, exp) => sum + exp.totalNominal, 0);

    const expenseByCategory = normalizedExpenses.reduce((acc, exp) => {
      acc[exp.kategori] = (acc[exp.kategori] || 0) + exp.totalNominal;
      return acc;
    }, {} as Record<string, number>);

    const expenseByProject = normalizedExpenses.reduce((acc, exp) => {
      if (!exp.projectName) return acc;
      acc[exp.projectName] = (acc[exp.projectName] || 0) + exp.totalNominal;
      return acc;
    }, {} as Record<string, number>);

    const topVendors = Object.entries(
      normalizedExpenses.reduce((acc, exp) => {
        acc[exp.vendorName] = (acc[exp.vendorName] || 0) + exp.totalNominal;
        return acc;
      }, {} as Record<string, number>)
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([vendorName, amount]) => ({ vendorName, amount }));

    const activeVendorCount = vendorRows.filter((payload) => {
      const status = String(readString(payload, "status") || "").toUpperCase();
      return status === "ACTIVE" || status === "AKTIF";
    }).length;

    return res.json({
      generatedAt: new Date().toISOString(),
      metrics: {
        totalExpenses,
        totalPending,
        totalApproved,
        totalPaid,
        pendingCount: pendingExpenses.length,
        approvedCount: approvedExpenses.length,
        paidCount: paidExpenses.length,
        vendorCount: vendors.length,
        activeVendorCount,
      },
      expenseByCategory,
      expenseByProject,
      topVendors,
      lastUpdatedAt: maxDate([
        ...vendorExpenses.map((row) => row.updatedAt),
        ...vendors.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-budget-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [projects, vendorExpenses] = await Promise.all([
      prisma.projectRecord.findMany({
        select: projectDashboardSelect,
      }),
      loadDashboardPayloadRows("vendor-expenses"),
    ]);

    const projectRows = projects.map((row) => asRecord(row.payload));
    const expenseRows = vendorExpenses.map((row) => asRecord(row.payload));

    const normalizedExpenses = expenseRows.map((payload) => ({
      projectId: readString(payload, "projectId") || "",
      rabItemId: readString(payload, "rabItemId") || "",
      totalNominal:
        readNumber(payload, "totalNominal") ||
        readNumber(payload, "totalAmount") ||
        readNumber(payload, "grandTotal") ||
        readNumber(payload, "amount") ||
        readNumber(payload, "nominal"),
    }));

    const projectAnalysis = projectRows
      .filter((project) => asArray(project.boq).length > 0)
      .map((project) => {
        const projectId = readString(project, "id") || "";
        const projectName = readString(project, "namaProject") || "Unknown Project";
        const boqItems = asArray(project.boq);

        const itemAnalysis = boqItems.map((boqItem) => {
          const itemKode = readString(boqItem, "itemKode") || readString(boqItem, "itemCode") || "";
          const itemName =
            readString(boqItem, "materialName") ||
            readString(boqItem, "itemName") ||
            "Unknown Item";
          const unit = readString(boqItem, "unit") || readString(boqItem, "satuan") || "";
          const qtyEstimate =
            readNumber(boqItem, "qtyEstimate") ||
            readNumber(boqItem, "qty") ||
            readNumber(boqItem, "quantity");
          const unitPrice =
            readNumber(boqItem, "unitPrice") ||
            readNumber(boqItem, "hargaSatuan") ||
            readNumber(boqItem, "price");
          const budgetAmount = qtyEstimate * unitPrice;

          const relatedExpenses = normalizedExpenses.filter(
            (exp) => exp.projectId === projectId && exp.rabItemId === itemKode
          );
          const actualAmount = relatedExpenses.reduce((sum, exp) => sum + exp.totalNominal, 0);
          const variance = actualAmount - budgetAmount;
          const variancePercent = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;

          return {
            itemKode,
            itemName,
            unit,
            qtyEstimate,
            unitPrice,
            budgetAmount,
            actualAmount,
            variance,
            variancePercent,
            expenseCount: relatedExpenses.length,
            status: variance > 0 ? "Over" : variance < 0 ? "Under" : "OnTrack",
          };
        });

        const totalBudget = itemAnalysis.reduce((sum, item) => sum + item.budgetAmount, 0);
        const totalActual = itemAnalysis.reduce((sum, item) => sum + item.actualAmount, 0);
        const totalVariance = totalActual - totalBudget;
        const utilizationPercent = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

        return {
          projectId,
          projectName,
          totalBudget,
          totalActual,
          totalVariance,
          utilizationPercent,
          itemAnalysis,
        };
      });

    const grandTotalBudget = projectAnalysis.reduce((sum, p) => sum + p.totalBudget, 0);
    const grandTotalActual = projectAnalysis.reduce((sum, p) => sum + p.totalActual, 0);
    const grandTotalVariance = grandTotalActual - grandTotalBudget;

    return res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        grandTotalBudget,
        grandTotalActual,
        grandTotalVariance,
      },
      projectAnalysis,
      lastUpdatedAt: maxDate([
        ...projects.map((row) => row.updatedAt),
        ...vendorExpenses.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-ap-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const vendorInvoices = await loadDashboardPayloadRows("vendor-invoices");
    const rows = vendorInvoices.map((row) => asRecord(row.payload));
    const { stats, topSuppliers } = buildFinanceApSummary(rows);

    return res.json({
      generatedAt: new Date().toISOString(),
      stats,
      topSuppliers,
      lastUpdatedAt: maxDate(vendorInvoices.map((row) => row.updatedAt)),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-ar-aging", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const invoices = await prisma.invoiceRecord.findMany({
      select: invoiceDashboardSelect,
    });

    const rows = invoices.map((row) => mapInvoiceDashboardPayload(row));
    const { agingList, totals } = buildFinanceArAgingSummary(rows);

    return res.json({
      generatedAt: new Date().toISOString(),
      agingList,
      totals,
      lastUpdatedAt: maxDate(invoices.map((row) => row.updatedAt)),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-general-ledger-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [archives, invoices, purchaseOrders] = await Promise.all([
      loadDashboardPayloadRows("archive-registry"),
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      loadDashboardPayloadRows("purchase-orders"),
    ]);

    const archiveRows = archives.map((row) => asRecord(row.payload));
    const invoiceRows = invoices.map((row) => mapInvoiceDashboardPayload(row));
    const poRows = purchaseOrders.map((row) => asRecord(row.payload));
    const { journalEntries, financialData, totals } = buildFinanceGeneralLedgerSummary(
      archiveRows,
      invoiceRows,
      poRows
    );

    return res.json({
      generatedAt: new Date().toISOString(),
      journalEntries,
      financialData,
      totals,
      lastUpdatedAt: maxDate([
        ...archives.map((row) => row.updatedAt),
        ...invoices.map((row) => row.updatedAt),
        ...purchaseOrders.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-revenue-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [invoices, quotations, vendorExpenses, projects] = await Promise.all([
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      prisma.quotation.findMany({
        select: quotationDashboardSelect,
      }),
      loadDashboardPayloadRows("vendor-expenses"),
      prisma.projectRecord.findMany({
        select: projectDashboardSelect,
      }),
    ]);

    const byProject = new Map<
      string,
      {
        projectName: string;
        customer: string;
        revenue: number;
        paid: number;
        outstanding: number;
        cost: number;
        quotationValue: number;
        margin: number;
      }
    >();

    for (const row of projects) {
      const payload = mapProjectDashboardPayload(row);
      const id = readString(payload, "id");
      if (!id) continue;
      byProject.set(id, {
        projectName:
          readString(payload, "namaProject") ||
          readString(payload, "projectName") ||
          "Unknown Project",
        customer:
          readString(payload, "customer") ||
          readString(payload, "customerName") ||
          "-",
        revenue: 0,
        paid: 0,
        outstanding: 0,
        cost: 0,
        quotationValue:
          readNumber(payload, "nilaiKontrak") ||
          readNumber(payload, "contractValue") ||
          readNumber(payload, "totalContractValue"),
        margin: 0,
      });
    }

    for (const row of invoices) {
      const payload = mapInvoiceDashboardPayload(row);
      const projectId = readString(payload, "projectId");
      const customerName =
        readString(payload, "customerName") ||
        readString(payload, "customer") ||
        "-";
      const key = projectId || `NO_PROJECT:${customerName}`;

      const current = byProject.get(key) || {
        projectName: readString(payload, "projectName") || "Tanpa Project",
        customer: customerName,
        revenue: 0,
        paid: 0,
        outstanding: 0,
        cost: 0,
        quotationValue: 0,
        margin: 0,
      };

      const totalNominal =
        readNumber(payload, "totalBayar") ||
        readNumber(payload, "subtotal") ||
        readNumber(payload, "totalNominal") ||
        readNumber(payload, "totalAmount") ||
        readNumber(payload, "amount");
      const paidAmount = readNumber(payload, "paidAmount");
      const outstandingAmount =
        readNumber(payload, "outstandingAmount") ||
        Math.max(0, totalNominal - paidAmount);

      current.revenue += totalNominal;
      current.paid += paidAmount;
      current.outstanding += outstandingAmount;
      byProject.set(key, current);
    }

    for (const row of vendorExpenses) {
      const payload = asRecord(row.payload);
      const status = String(readString(payload, "status") || "").toUpperCase();
      if (!["APPROVED", "PAID"].includes(status)) continue;

      const projectId = readString(payload, "projectId");
      const vendorName =
        readString(payload, "vendorName") ||
        readString(payload, "vendor") ||
        readString(payload, "supplier") ||
        "-";
      const key = projectId || `NO_PROJECT:${vendorName}`;
      const current = byProject.get(key) || {
        projectName: readString(payload, "projectName") || "Tanpa Project",
        customer: "-",
        revenue: 0,
        paid: 0,
        outstanding: 0,
        cost: 0,
        quotationValue: 0,
        margin: 0,
      };

      current.cost +=
        readNumber(payload, "totalNominal") ||
        readNumber(payload, "totalAmount") ||
        readNumber(payload, "grandTotal") ||
        readNumber(payload, "amount") ||
        readNumber(payload, "nominal");
      byProject.set(key, current);
    }

    for (const q of quotations) {
      const qPayload = asRecord(q.payload);
      const qProjectId = readString(qPayload, "projectId");
      if (!qProjectId) continue;
      const current = byProject.get(qProjectId);
      if (!current) continue;
      if (!current.quotationValue) {
        current.quotationValue = Number(q.grandTotal || 0);
      }
      byProject.set(qProjectId, current);
    }

    const rows = Array.from(byProject.values())
      .map((item) => ({
        ...item,
        margin: item.revenue > 0 ? ((item.revenue - item.cost) / item.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const totalInvoice = rows.reduce((sum, row) => sum + row.revenue, 0);
    const totalPaid = rows.reduce((sum, row) => sum + row.paid, 0);
    const totalOutstanding = rows.reduce((sum, row) => sum + row.outstanding, 0);
    const totalExpense = rows.reduce((sum, row) => sum + row.cost, 0);
    const grossMargin = totalInvoice > 0 ? ((totalInvoice - totalExpense) / totalInvoice) * 100 : 0;

    return res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalInvoice,
        totalPaid,
        totalOutstanding,
        totalExpense,
        grossMargin,
      },
      rows,
      lastUpdatedAt: maxDate([
        ...invoices.map((row) => row.updatedAt),
        ...vendorExpenses.map((row) => row.updatedAt),
        ...quotations.map((row) => row.updatedAt),
        ...projects.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-project-pl-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [projects, customerInvoices, vendorInvoices, vendorExpenses, stockMovements, stockItems, attendances] = await Promise.all([
      prisma.projectRecord.findMany({
        select: projectDashboardSelect,
      }),
      prisma.financeCustomerInvoice.findMany({
        select: {
          id: true,
          projectId: true,
          totalAmount: true,
          paidAmount: true,
          outstandingAmount: true,
          status: true,
          updatedAt: true,
        },
      }),
      prisma.financeVendorInvoice.findMany({
        select: {
          id: true,
          projectId: true,
          totalAmount: true,
          paidAmount: true,
          outstandingAmount: true,
          status: true,
          updatedAt: true,
        },
      }),
      prisma.financeVendorExpense.findMany({
        select: {
          id: true,
          projectId: true,
          totalNominal: true,
          status: true,
          updatedAt: true,
        },
      }),
      loadDashboardPayloadRows("stock-movements"),
      loadDashboardPayloadRows("stock-items"),
      prisma.attendanceRecord.findMany({
        select: { projectId: true, workHours: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const projectRows = projects.map((row) => mapProjectDashboardPayload(row));
    const stockMovementRows = stockMovements.map((row) => asRecord(row.payload));
    const stockItemRows = stockItems.map((row) => asRecord(row.payload));
    const stockPriceByKode = new Map<string, number>();
    for (const item of stockItemRows) {
      const kode = readString(item, "kode") || readString(item, "code") || readString(item, "itemKode");
      if (!kode) continue;
      stockPriceByKode.set(
        kode,
        readNumber(item, "hargaSatuan") ||
          readNumber(item, "unitPrice") ||
          readNumber(item, "price") ||
          readNumber(item, "costPrice") ||
          readNumber(item, "unitCost")
      );
    }

    const analysis = projectRows.map((project) => {
      const id = readString(project, "id") || "";
      const namaProject =
        readString(project, "namaProject") ||
        readString(project, "projectName") ||
        "Unknown Project";
      const customer =
        readString(project, "customer") ||
        readString(project, "customerName") ||
        "-";
      const nilaiKontrak =
        readNumber(project, "nilaiKontrak") ||
        readNumber(project, "contractValue") ||
        readNumber(project, "totalContractValue");
      const startDate = readString(project, "startDate");
      const endDate = readString(project, "endDate");

      const revenue = customerInvoices
        .filter((inv) => inv.projectId === id)
        .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

      const vendorInvoiceCost = vendorInvoices
        .filter((inv) => inv.projectId === id)
        .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

      const vendorExpenseCost = vendorExpenses
        .filter((exp) => exp.projectId === id)
        .reduce((sum, exp) => sum + Number(exp.totalNominal || 0), 0);

      const materialCost = stockMovementRows
        .filter((m) => {
          const type = String(readString(m, "type") || "").toUpperCase();
          if (type !== "OUT") return false;
          const projectId = readString(m, "projectId");
          const projectName = String(readString(m, "projectName") || "").toLowerCase();
          const refNo = readString(m, "refNo") || "";
          return projectId === id || projectName === namaProject.toLowerCase() || refNo.includes(id);
        })
        .reduce((sum, m) => {
          const kode = readString(m, "itemKode") || readString(m, "itemCode") || readString(m, "kode") || "";
          const qty = readNumber(m, "qty");
          const unitPrice = stockPriceByKode.get(kode) || 0;
          return sum + qty * unitPrice;
        }, 0);

      const boqItems = asArray(project.boq);
      const boqBudget = boqItems.reduce((sum, raw) => {
        const boqItem = asRecord(raw);
        const qtyEstimate =
          readNumber(boqItem, "qtyEstimate") ||
          readNumber(boqItem, "qty") ||
          readNumber(boqItem, "quantity");
        const unitPrice =
          readNumber(boqItem, "unitPrice") ||
          readNumber(boqItem, "hargaSatuan") ||
          readNumber(boqItem, "price") ||
          readNumber(boqItem, "totalCost");
        return sum + qtyEstimate * unitPrice;
      }, 0);

      const laborCost = attendances
        .filter((att) => att.projectId === id)
        .reduce((sum, att) => sum + (att.workHours ?? 0) * 25000, 0);

      const overheadCost = nilaiKontrak * 0.05;
      const externalCost = vendorInvoiceCost + vendorExpenseCost;
      const totalActualCost = materialCost + laborCost + overheadCost + externalCost;
      const netProfit = revenue - totalActualCost;
      const margin = revenue > 0 ? ((revenue - totalActualCost) / revenue) * 100 : 0;

      const startedAt = parseDate(startDate);
      const endedAt = parseDate(endDate);
      const elapsedDays = startedAt
        ? Math.max(
            1,
            Math.ceil((Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24))
          )
        : 30;
      const plannedDays = startedAt && endedAt
        ? Math.max(1, Math.ceil((endedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24)))
        : 90;
      const monthsActive = Math.max(1, Math.ceil(elapsedDays / 30));
      const burnPerMonth = totalActualCost / monthsActive;
      const budget = boqBudget > 0 ? boqBudget : nilaiKontrak;
      const projectedFinalSpend = burnPerMonth * Math.max(1, Math.ceil(plannedDays / 30));
      const burnRateStatus =
        totalActualCost > budget || projectedFinalSpend > budget
          ? "Critical"
          : totalActualCost > budget * 0.85 || projectedFinalSpend > budget * 0.85
          ? "Warning"
          : "Normal";

      return {
        id,
        namaProject,
        customer,
        nilaiKontrak,
        startDate,
        endDate,
        revenue,
        materialCost,
        laborCost,
        vendorInvoiceCost,
        vendorExpenseCost,
        externalCost,
        overheadCost,
        totalActualCost,
        netProfit,
        margin,
        boqBudget,
        budget,
        burnPerMonth,
        burnRateStatus,
        elapsedDays,
        plannedDays,
      };
    });

    const totals = {
      revenue: analysis.reduce((sum, row) => sum + row.revenue, 0),
      cost: analysis.reduce((sum, row) => sum + row.totalActualCost, 0),
      netProfit: analysis.reduce((sum, row) => sum + row.netProfit, 0),
      avgMargin:
        analysis.length > 0
          ? analysis.reduce((sum, row) => sum + row.margin, 0) / analysis.length
          : 0,
    };

    return res.json({
      generatedAt: new Date().toISOString(),
      rows: analysis.sort((a, b) => b.revenue - a.revenue),
      totals,
      lastUpdatedAt: maxDate([
        ...projects.map((row) => row.updatedAt),
        ...customerInvoices.map((row) => row.updatedAt),
        ...vendorInvoices.map((row) => row.updatedAt),
        ...vendorExpenses.map((row) => row.updatedAt),
        ...stockMovements.map((row) => row.updatedAt),
        ...stockItems.map((row) => row.updatedAt),
        ...attendances.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-year-end-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [invoices, vendorInvoices, purchaseOrders, payrolls] = await Promise.all([
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      loadDashboardPayloadRows("vendor-invoices"),
      loadDashboardPayloadRows("purchase-orders"),
      prisma.payrollRecord.findMany({
        select: { month: true, year: true, totalPayroll: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const invoiceRows = invoices.map((row) => mapInvoiceDashboardPayload(row));
    const vendorInvRows = vendorInvoices.map((row) => asRecord(row.payload));
    const poRows = purchaseOrders.map((row) => asRecord(row.payload));
    const totalRev = invoiceRows.reduce(
      (sum, inv) => sum + (readNumber(inv, "totalBayar") || readNumber(inv, "subtotal") || readNumber(inv, "totalAmount")),
      0
    );
    const totalVend = vendorInvRows.reduce((sum, v) => sum + readNumber(v, "paidAmount"), 0);
    const totalLabor = payrolls.reduce((sum, p) => sum + (p.totalPayroll || 0), 0);
    const totalMaterial = poRows
      .filter((po) => {
        const status = String(readString(po, "status") || "").toUpperCase();
        return status === "COMPLETED" || status === "RECEIVED";
      })
      .reduce((sum, po) => sum + (readNumber(po, "total") || readNumber(po, "totalAmount")), 0);

    const grossProfit = totalRev - (totalVend + totalLabor + totalMaterial);
    const overhead = totalRev * 0.05;
    const netProfit = grossProfit - overhead;
    const margin = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const monthly = monthNames.map((month, idx) => ({
      month,
      idx,
      rev: 0,
      outflow: 0,
      profit: 0,
    }));

    const parsePayrollDate = (month?: string | null, year?: number | null): Date | null => {
      if (!month || !year) return null;
      const normalized = String(month).trim().toLowerCase();
      const monthMap: Record<string, number> = {
        january: 0, januari: 0, jan: 0,
        february: 1, februari: 1, feb: 1,
        march: 2, maret: 2, mar: 2,
        april: 3, apr: 3,
        may: 4, mei: 4,
        june: 5, juni: 5, jun: 5,
        july: 6, juli: 6, jul: 6,
        august: 7, agustus: 7, agu: 7, aug: 7,
        september: 8, sep: 8,
        october: 9, oktober: 9, okt: 9, oct: 9,
        november: 10, nov: 10,
        december: 11, desember: 11, des: 11, dec: 11,
      };
      const idx = monthMap[normalized];
      if (idx === undefined) return null;
      return new Date(year, idx, 1);
    };

    for (const inv of invoiceRows) {
      const d = parseDate(readString(inv, "tanggal") || readString(inv, "date"));
      if (!d) continue;
      monthly[d.getMonth()].rev +=
        readNumber(inv, "totalBayar") || readNumber(inv, "subtotal") || readNumber(inv, "totalAmount");
    }

    for (const po of poRows) {
      const status = String(readString(po, "status") || "").toUpperCase();
      if (!["COMPLETED", "RECEIVED"].includes(status)) continue;
      const d = parseDate(readString(po, "tanggal") || readString(po, "date"));
      if (!d) continue;
      monthly[d.getMonth()].outflow += readNumber(po, "total") || readNumber(po, "totalAmount");
    }

    for (const p of payrolls) {
      const d = parsePayrollDate(p.month, p.year);
      if (!d) continue;
      monthly[d.getMonth()].outflow += p.totalPayroll || 0;
    }

    for (const v of vendorInvRows) {
      const d = parseDate(
        readString(v, "paidAt") ||
          readString(v, "tanggalBayar") ||
          readString(v, "paymentDate") ||
          readString(v, "date") ||
          readString(v, "tanggal") ||
          readString(v, "jatuhTempo") ||
          readString(v, "dueDate")
      );
      if (!d) continue;
      monthly[d.getMonth()].outflow += readNumber(v, "paidAmount");
    }

    for (const row of monthly) {
      const rowOverhead = row.rev * 0.05;
      row.profit = row.rev - row.outflow - rowOverhead;
    }

    const totalExpense = totalMaterial + totalLabor + totalVend + overhead;
    const pct = (n: number) => (totalExpense > 0 ? (n / totalExpense) * 100 : 0);
    const expenseAlloc = [
      { label: "COGS Material", value: totalMaterial, percent: pct(totalMaterial), color: "bg-blue-600" },
      { label: "COGS Labor", value: totalLabor, percent: pct(totalLabor), color: "bg-emerald-500" },
      { label: "COGS Vendor", value: totalVend, percent: pct(totalVend), color: "bg-violet-600" },
      { label: "Overhead", value: overhead, percent: pct(overhead), color: "bg-amber-500" },
    ];

    return res.json({
      generatedAt: new Date().toISOString(),
      annualSummary: {
        totalRev,
        totalVend,
        totalLabor,
        totalMaterial,
        overhead,
        grossProfit,
        netProfit,
        margin,
      },
      monthlyRevData: monthly,
      expenseAlloc,
      lastUpdatedAt: maxDate([
        ...invoices.map((row) => row.updatedAt),
        ...vendorInvoices.map((row) => row.updatedAt),
        ...purchaseOrders.map((row) => row.updatedAt),
        ...payrolls.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-payroll-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [employees, attendances, kasbons] = await Promise.all([
      prisma.employeeRecord.findMany({
        select: {
          id: true,
          employeeId: true,
          name: true,
          position: true,
          department: true,
          employmentType: true,
          salary: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.attendanceRecord.findMany({
        select: {
          employeeId: true,
          workHours: true,
          overtime: true,
          status: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.hrKasbon.findMany({
        select: {
          employeeId: true,
          amount: true,
          status: true,
          approved: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const payrollRows = employees.map((emp, idx) => {
      const employeeId = emp.id || `EMP-${idx + 1}`;
      const empAttendance = attendances.filter((a) => a.employeeId === employeeId);
      const totalHours = empAttendance.reduce((sum, a) => sum + (a.workHours ?? 0), 0);
      const totalOvertime = empAttendance.reduce((sum, a) => sum + (a.overtime ?? 0), 0);
      const presentCount = empAttendance.filter((a) => {
        const status = String(a.status || "").toUpperCase();
        return status === "PRESENT" || status === "H" || status === "HADIR" || status === "MASUK";
      }).length;

      const totalKasbon = kasbons
        .filter((k) => {
          const matchesEmployee = String(k.employeeId || "") === employeeId;
          const status = String(k.status || "").toUpperCase();
          return matchesEmployee && (k.approved || status === "APPROVED" || status === "PAID");
        })
        .reduce((sum, k) => sum + Number(k.amount || 0), 0);

      const baseSalary = emp.salary ?? 0;
      const hourlyRate = baseSalary > 0 ? baseSalary / 173 : 0;
      const overtimePay = totalOvertime * hourlyRate * 1.5;
      const mealAllowance = presentCount * 38000;
      const grossSalary = baseSalary + overtimePay + mealAllowance;
      const netSalary = grossSalary - totalKasbon;

      return {
        id: employeeId,
        employeeId: emp.employeeId || employeeId,
        name: emp.name || "Unknown Employee",
        position: emp.position || "-",
        department: emp.department || "-",
        employmentType: emp.employmentType || "-",
        salary: baseSalary,
        baseSalary,
        totalHours,
        totalOvertime,
        attendanceCount: empAttendance.length,
        totalKasbon,
        overtimePay,
        mealAllowance,
        grossSalary,
        netSalary,
      };
    });

    const totalNetPayroll = payrollRows.reduce((sum, r) => sum + r.netSalary, 0);
    const totalManHours = payrollRows.reduce((sum, r) => sum + r.totalHours, 0);
    const totalOvertime = payrollRows.reduce((sum, r) => sum + r.totalOvertime, 0);
    const totalKasbon = payrollRows.reduce((sum, r) => sum + r.totalKasbon, 0);

    return res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalNetPayroll,
        totalManHours,
        totalOvertime,
        totalKasbon,
        employeeCount: payrollRows.length,
      },
      rows: payrollRows.sort((a, b) => b.netSalary - a.netSalary),
      lastUpdatedAt: maxDate([
        ...employees.map((row) => row.updatedAt),
        ...attendances.map((row) => row.updatedAt),
        ...kasbons.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-ppn-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [invoices, vendorInvoices] = await Promise.all([
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      loadDashboardPayloadRows("vendor-invoices"),
    ]);

    const invoiceRows = invoices.map((row) => mapInvoiceDashboardPayload(row));
    const vendorRows = vendorInvoices.map((row) => asRecord(row.payload));
    const { summary, keluaran, masukan } = buildFinancePpnSummary(invoiceRows, vendorRows);

    return res.json({
      generatedAt: new Date().toISOString(),
      summary,
      keluaran,
      masukan,
      lastUpdatedAt: maxDate([
        ...invoices.map((row) => row.updatedAt),
        ...vendorInvoices.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-bank-recon-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [invoices, vendorInvoices, archives] = await Promise.all([
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      loadDashboardPayloadRows("vendor-invoices"),
      loadDashboardPayloadRows("archive-registry"),
    ]);

    const invoiceRows = invoices.map((row) => mapInvoiceDashboardPayload(row));
    const vendorRows = vendorInvoices.map((row) => asRecord(row.payload));
    const archiveRows = archives.map((row) => asRecord(row.payload));
    const { summary, transactions } = buildFinanceBankReconSummary(
      invoiceRows,
      vendorRows,
      archiveRows
    );

    return res.json({
      generatedAt: new Date().toISOString(),
      summary,
      transactions,
      lastUpdatedAt: maxDate([
        ...invoices.map((row) => row.updatedAt),
        ...vendorInvoices.map((row) => row.updatedAt),
        ...archives.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-petty-cash-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const pettyDelegate = (prisma as unknown as Record<string, unknown>)
      .financePettyCashTransactionRecord as DashboardPettyCashDelegate | undefined;
    if (!pettyDelegate || typeof pettyDelegate.findMany !== "function") {
      return res.status(500).json({ error: "Petty cash dedicated delegate unavailable" });
    }

    const transactions = await pettyDelegate.findMany({
      select: { id: true, payload: true, updatedAt: true },
    });
    const pettyTransactions = transactions.map((tx) => ({
      id: tx.id,
      payload: asRecord(tx.payload),
    }));
    const { summary, rows } = buildFinancePettyCashSummary(pettyTransactions);

    return res.json({
      generatedAt: new Date().toISOString(),
      summary,
      rows,
      lastUpdatedAt: maxDate(transactions.map((tx) => tx.updatedAt)),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-payment-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const [invoices, expenses] = await Promise.all([
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      loadDashboardPayloadRows("vendor-expenses"),
    ]);

    const arRows = invoices.map((row) => mapInvoiceDashboardPayload(row));
    const expRows = expenses.map((row) => asRecord(row.payload));
    const summary = buildFinancePaymentSummary(arRows, expRows);

    return res.json({
      generatedAt: new Date().toISOString(),
      summary,
      lastUpdatedAt: maxDate([
        ...invoices.map((row) => row.updatedAt),
        ...expenses.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-reconciliation-check", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const startDateRaw = typeof req.query.startDate === "string" ? req.query.startDate : "2026-01-01";
    const startDate = parseDate(startDateRaw) || new Date("2026-01-01");

    const [invoices, vendorExpenses] = await Promise.all([
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardSelect,
      }),
      loadDashboardPayloadRows("vendor-expenses"),
    ]);

    const pettyDelegate = (prisma as unknown as Record<string, unknown>)
      .financePettyCashTransactionRecord as DashboardPettyCashDelegate | undefined;
    const pettyTransactions = pettyDelegate && typeof pettyDelegate.findMany === "function"
      ? await pettyDelegate.findMany({
        select: { id: true, payload: true, updatedAt: true },
      })
      : [];

    const isOnOrAfterStart = (rawDate: string | null): boolean => {
      const d = parseDate(rawDate);
      return !!d && d >= startDate;
    };

    const invoiceRows = invoices
      .map((row) => mapInvoiceDashboardPayload(row))
      .filter((row) =>
        isOnOrAfterStart(
          readString(row, "tanggalBayar") || readString(row, "paidAt") || readString(row, "tanggal") || readString(row, "date")
        )
      );
    const expenseRows = vendorExpenses
      .map((row) => asRecord(row.payload))
      .filter((row) =>
        isOnOrAfterStart(
          readString(row, "paidAt") || readString(row, "tanggalBayar") || readString(row, "tanggal") || readString(row, "date")
        )
      );
    const pettyRows = pettyTransactions
      .map((tx) => ({ id: tx.id, payload: asRecord(tx.payload), updatedAt: tx.updatedAt }))
      .filter((tx) => {
        const d = parseDate(readString(tx.payload, "date"));
        return !!d && d >= startDate;
      });

    const { checks, recordCounts } = buildFinanceReconciliationCheck({
      invoiceRows,
      expenseRows,
      pettyRows: pettyRows.map((tx) => ({ id: tx.id, payload: tx.payload })),
      startDate,
    });

    return res.json({
      generatedAt: new Date().toISOString(),
      period: {
        startDate: startDate.toISOString().slice(0, 10),
      },
      checks,
      recordCounts,
      lastUpdatedAt: maxDate([
        ...invoices.map((row) => row.updatedAt),
        ...vendorExpenses.map((row) => row.updatedAt),
        ...pettyRows.map((row) => row.updatedAt),
      ]),
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function writeFinanceApprovalAuditLog(
  req: AuthRequest,
  action: string,
  documentType: string,
  documentId: string,
  metadata?: Record<string, unknown>
) {
  await prisma.auditLogEntry.create({
    data: {
      id: `LOG-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
      timestamp: new Date(),
      action,
      module: "FinanceApprovalCenter",
      details: `${documentType} ${documentId} - ${action}`,
      status: "Success",
      domain: "dashboard",
      resource: documentType,
      entityId: documentId,
      operation: action,
      actorUserId: req.user?.id ?? null,
      actorRole: req.user?.role ?? null,
      userId: req.user?.id ?? null,
      userName: null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

dashboardRouter.get("/dashboard/finance-approval-queue", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinanceApprovalQueue(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  try {
    const payload = await buildFinanceApprovalQueuePayload(req.user?.role);
    return res.json(payload);
  } catch {
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});

dashboardRouter.post("/dashboard/finance-approval-action", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const input = parseFinanceApprovalActionInput(req.body);
    const actor = await resolveActorSnapshot(req.user?.id, req.user?.role);
    const result = await executeFinanceApprovalAction({
      input,
      role: req.user?.role,
      userId: req.user?.id ?? null,
      actor,
      findFinanceResourceDoc,
      updateFinanceResourceDoc,
      findQuotation: async (quotationId) =>
        prisma.quotation.findUnique({
          where: { id: quotationId },
          select: { id: true, status: true, payload: true },
        }),
      updateQuotation: async (quotationId, status, payload) => {
        await prisma.quotation.update({
          where: { id: quotationId },
          data: {
            status,
            payload: payload as Prisma.InputJsonValue,
          },
        });
      },
      syncProjectFromQuotation: upsertProjectFromQuotationForApprovalSync,
      writeQuotationApprovalLog: writeQuotationApprovalLogSafe,
      writeAuditLog: async (action, documentType, documentId, metadata) =>
        writeFinanceApprovalAuditLog(req, action, documentType, documentId, metadata),
    });

    return res.json(result);
  } catch (error) {
    if (error instanceof FinanceApprovalActionError) {
      return sendError(res, error.status, {
        code: error.code,
        message: error.message,
        legacyError: error.legacyError,
      });
    }
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});
