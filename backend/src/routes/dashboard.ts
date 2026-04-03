import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import {
  canReadCoverage,
  canReadFinance,
  resolveActorSnapshot,
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
import {
  findFinanceResourceDoc,
  loadDashboardPayloadRows,
  loadDashboardWorkflowRows,
  updateFinanceResourceDoc,
} from "./dashboardDataAccess";

export const dashboardRouter = Router();

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
