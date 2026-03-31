import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import {
  invoiceDashboardDetailSelect,
  mapInvoiceDashboardPayload,
  mapProcurementPurchaseOrderDashboardPayload,
  mapProductionMaterialRequestDashboardPayload,
  maxDate,
  mergeFinanceRows,
  quotationDashboardSelect,
} from "./dashboardRouteSupport";
import {
  buildPendingInvoices,
  buildPendingMaterialRequests,
  buildPendingPurchaseOrders,
  buildPendingQuotations,
  buildQuotationActorMap,
  collectQuotationActorIds,
} from "./dashboardFinanceApprovalHelpers";

export async function buildFinanceApprovalQueuePayload(role?: Role) {
  const [poRows, poDedicatedRows, quotationRows, invoiceRows, invoiceDedicatedRows, mrRows, mrDedicatedRows] =
    await Promise.all([
      prisma.appEntity.findMany({
        where: { resource: "purchase-orders" },
        select: { entityId: true, payload: true, updatedAt: true },
      }),
      prisma.procurementPurchaseOrder.findMany({
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
      }),
      prisma.quotation.findMany({
        select: quotationDashboardSelect,
      }),
      prisma.appEntity.findMany({
        where: { resource: "invoices" },
        select: { entityId: true, payload: true, updatedAt: true },
      }),
      prisma.invoiceRecord.findMany({
        select: invoiceDashboardDetailSelect,
      }),
      prisma.appEntity.findMany({
        where: { resource: "material-requests" },
        select: { entityId: true, payload: true, updatedAt: true },
      }),
      prisma.productionMaterialRequest.findMany({
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
      }),
    ]);

  const poQueueRows = mergeFinanceRows(
    poRows,
    poDedicatedRows.map((row) => ({
      id: row.id,
      payload: mapProcurementPurchaseOrderDashboardPayload(row),
      updatedAt: row.updatedAt,
    })),
  );

  const invoiceQueueRows = mergeFinanceRows(
    invoiceRows,
    invoiceDedicatedRows.map((row) => ({
      id: row.id,
      payload: mapInvoiceDashboardPayload(row),
      updatedAt: row.updatedAt,
    })),
  );

  const mrQueueRows = mergeFinanceRows(
    mrRows,
    mrDedicatedRows.map((row) => ({
      id: row.id,
      payload: mapProductionMaterialRequestDashboardPayload(row),
      updatedAt: row.updatedAt,
    })),
  );

  const pendingPOs = buildPendingPurchaseOrders(poQueueRows, role);

  const quotationActorIds = collectQuotationActorIds(quotationRows);
  const quotationActors = quotationActorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: quotationActorIds } },
        select: { id: true, name: true, username: true, role: true },
      })
    : [];
  const quotationActorMap = buildQuotationActorMap(quotationActors);

  const pendingQuotations = buildPendingQuotations(quotationRows, quotationActorMap, role);
  const pendingInvoices = buildPendingInvoices(invoiceQueueRows, role);
  const pendingMaterialRequests = buildPendingMaterialRequests(mrQueueRows, role);

  return {
    generatedAt: new Date().toISOString(),
    stats: {
      total: pendingPOs.length + pendingQuotations.length + pendingInvoices.length + pendingMaterialRequests.length,
      highValue: pendingPOs.filter((po) => po.total > 10_000_000).length,
    },
    po: pendingPOs,
    quotations: pendingQuotations,
    invoices: pendingInvoices,
    materialRequests: pendingMaterialRequests,
    lastUpdatedAt: maxDate([
      poQueueRows[0]?.updatedAt,
      quotationRows[0]?.updatedAt,
      invoiceQueueRows[0]?.updatedAt,
      mrQueueRows[0]?.updatedAt,
    ]),
  };
}
