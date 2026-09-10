import { Router, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate } from "../middlewares/auth";
import { AuthRequest } from "../types/auth";
import { sendError } from "../utils/http";
import { hasRoleAccess } from "../utils/roles";

export const salesAnalyticsRouter = Router();

const SALES_ANALYTICS_ROLES: Role[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "SALES",
  "FINANCE",
  "FINANCE_ACCOUNTING",
  "SALES_MARKETING",
  "OPERATIONAL_PRODUCTION",
  "HR",
  "HSE",
];

type RevenueEntry = { number: string; date: Date; subtotal: number };

function isRevenueStatus(status: string): boolean {
  return !["DRAFT", "REJECTED", "CANCELLED", "CANCELED", "VOID"].includes(status.toUpperCase());
}

salesAnalyticsRouter.get("/sales/analytics", authenticate, async (req: AuthRequest, res: Response) => {
  if (!hasRoleAccess(req.user?.role, SALES_ANALYTICS_ROLES)) {
    return sendError(res, 403, { code: "FORBIDDEN", message: "Forbidden", legacyError: "Forbidden" });
  }

  const requestedYear = Number(req.query.year);
  const currentYear = Number.isInteger(requestedYear) && requestedYear > 2000
    ? requestedYear
    : new Date().getFullYear();
  const previousYear = currentYear - 1;

  try {
    const [financeInvoices, legacyInvoices, projects, targets] = await Promise.all([
      prisma.financeCustomerInvoice.findMany({
        where: {
          tanggal: {
            gte: new Date(`${previousYear}-01-01T00:00:00.000Z`),
            lt: new Date(`${currentYear + 1}-01-01T00:00:00.000Z`),
          },
        },
        select: { number: true, tanggal: true, subtotal: true, status: true },
      }),
      prisma.invoiceRecord.findMany({
        where: { tanggal: { startsWith: String(previousYear) } },
        select: { noInvoice: true, tanggal: true, subtotal: true, status: true },
      }),
      prisma.projectRecord.findMany({
        select: { id: true, status: true, nilaiKontrak: true },
      }),
      prisma.salesTarget.findMany({
        where: { year: currentYear, targetType: "REVENUE" },
        select: { month: true, targetAmount: true },
      }),
    ]);

    const currentLegacyInvoices = await prisma.invoiceRecord.findMany({
      where: { tanggal: { startsWith: String(currentYear) } },
      select: { noInvoice: true, tanggal: true, subtotal: true, status: true },
    });

    const uniqueRevenue = new Map<string, RevenueEntry>();
    for (const invoice of [...legacyInvoices, ...currentLegacyInvoices]) {
      if (!isRevenueStatus(invoice.status)) continue;
      const date = new Date(invoice.tanggal);
      if (Number.isNaN(date.getTime())) continue;
      uniqueRevenue.set(invoice.noInvoice, { number: invoice.noInvoice, date, subtotal: invoice.subtotal });
    }
    for (const invoice of financeInvoices) {
      if (!isRevenueStatus(invoice.status)) continue;
      uniqueRevenue.set(invoice.number, { number: invoice.number, date: invoice.tanggal, subtotal: invoice.subtotal });
    }

    const currentMonthly = new Array<number>(12).fill(0);
    const previousMonthly = new Array<number>(12).fill(0);
    for (const invoice of uniqueRevenue.values()) {
      const year = invoice.date.getFullYear();
      const month = invoice.date.getMonth();
      if (year === currentYear) currentMonthly[month] += invoice.subtotal;
      if (year === previousYear) previousMonthly[month] += invoice.subtotal;
    }

    const monthlyTargets = new Array<number>(12).fill(0);
    let annualTarget = 0;
    for (const target of targets) {
      if (target.month && target.month >= 1 && target.month <= 12) {
        monthlyTargets[target.month - 1] += target.targetAmount;
      } else {
        annualTarget += target.targetAmount;
      }
    }
    if (annualTarget === 0) annualTarget = monthlyTargets.reduce((sum, value) => sum + value, 0);

    const activeStatuses = new Set(["PLANNING", "PENDING", "IN PROGRESS", "ON PROGRESS"]);
    const activeProjects = projects.filter((project) => activeStatuses.has(String(project.status || "").toUpperCase()));
    const pipelineValue = activeProjects.reduce((sum, project) => sum + (project.nilaiKontrak || 0), 0);

    return res.json({
      currentYear,
      previousYear,
      currentMonthly,
      previousMonthly,
      monthlyTargets,
      annualTarget,
      pipelineValue,
      activeProjectCount: activeProjects.length,
      invoiceCount: uniqueRevenue.size,
    });
  } catch (error) {
    console.error("GET /sales/analytics failed:", error);
    return sendError(res, 500, { code: "INTERNAL_ERROR", message: "Internal server error", legacyError: "Internal server error" });
  }
});
