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
  mapDashboardLogisticsSuratJalanPayload,
  mapDashboardProofOfDeliveryPayload,
  getDashboardDedicatedDelegate,
  mergeFinanceRows,
} from "./dashboardRouteSupport";
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
import {
  buildHrSummaryPayload,
  buildOperationalSummaryPayload,
  buildProcurementSummaryPayload,
  buildProductionSummaryPayload,
  buildVendorSummaryPayload,
} from "./dashboardOperationalSupport";
import {
  buildFinanceApSummaryPayload,
  buildFinanceArAgingPayload,
  buildFinanceArSummaryPayload,
  buildFinanceBankReconSummaryPayload,
  buildFinanceBudgetSummaryPayload,
  buildFinanceCashflowPageSummaryPayload,
  buildFinanceCashflowSummaryPayload,
  buildFinanceGeneralLedgerSummaryPayload,
  buildFinancePaymentSummaryPayload,
  buildFinancePayrollSummaryPayload,
  buildFinancePettyCashSummaryPayload,
  buildFinancePpnSummaryPayload,
  buildFinanceProjectPlSummaryPayload,
  buildFinanceReconciliationCheckPayload,
  buildFinanceRevenueSummaryPayload,
  buildFinanceVendorSummaryPayload,
  buildFinanceYearEndSummaryPayload,
} from "./dashboardFinanceSummarySupport";

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

dashboardRouter.get("/dashboard/summary", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await buildOperationalSummaryPayload({
        loadDashboardPayloadRows,
      })
    );
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
    return res.json(
      await buildVendorSummaryPayload({
        loadDashboardPayloadRows,
      })
    );
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/production-summary", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await buildProductionSummaryPayload({
        loadDashboardPayloadRows,
      })
    );
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/procurement-summary", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    return res.json(
      await buildProcurementSummaryPayload({
        loadDashboardPayloadRows,
      })
    );
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/hr-summary", authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    return res.json(await buildHrSummaryPayload());
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-cashflow-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const payload = await buildFinanceCashflowSummaryPayload();
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-cashflow-page-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const payload = await buildFinanceCashflowPageSummaryPayload({ loadDashboardPayloadRows });
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-ar-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const payload = await buildFinanceArSummaryPayload();
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-vendor-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const payload = await buildFinanceVendorSummaryPayload({ loadDashboardPayloadRows });
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-budget-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const payload = await buildFinanceBudgetSummaryPayload({ loadDashboardPayloadRows });
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-ap-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const payload = await buildFinanceApSummaryPayload({ loadDashboardPayloadRows });
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-ar-aging", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const payload = await buildFinanceArAgingPayload();
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-general-ledger-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const payload = await buildFinanceGeneralLedgerSummaryPayload({ loadDashboardPayloadRows });
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-revenue-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const payload = await buildFinanceRevenueSummaryPayload({ loadDashboardPayloadRows });
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-project-pl-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const payload = await buildFinanceProjectPlSummaryPayload({ loadDashboardPayloadRows });
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-year-end-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const payload = await buildFinanceYearEndSummaryPayload({ loadDashboardPayloadRows });
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-payroll-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const payload = await buildFinancePayrollSummaryPayload();
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-ppn-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const payload = await buildFinancePpnSummaryPayload({ loadDashboardPayloadRows });
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-bank-recon-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const payload = await buildFinanceBankReconSummaryPayload({ loadDashboardPayloadRows });
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-petty-cash-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const payload = await buildFinancePettyCashSummaryPayload();
    return res.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "Petty cash dedicated delegate unavailable") {
      return res.status(500).json({ error: "Petty cash dedicated delegate unavailable" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

dashboardRouter.get("/dashboard/finance-payment-summary", authenticate, async (req: AuthRequest, res: Response) => {
  if (!canReadFinance(req.user?.role)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }
  try {
    const payload = await buildFinancePaymentSummaryPayload({ loadDashboardPayloadRows });
    return res.json(payload);
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
    const payload = await buildFinanceReconciliationCheckPayload({
      loadDashboardPayloadRows,
      startDateRaw,
    });
    return res.json(payload);
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
