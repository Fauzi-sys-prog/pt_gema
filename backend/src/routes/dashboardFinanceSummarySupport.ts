import { prisma } from "../prisma";
import {
  asRecord,
  invoiceDashboardSelect,
  mapInvoiceDashboardPayload,
  mapProjectDashboardPayload,
  maxDate,
  projectDashboardSelect,
  quotationDashboardSelect,
  readNumber,
  readString,
  type DashboardPettyCashDelegate,
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

type DashboardPayloadRow = {
  entityId: string;
  payload: unknown;
  updatedAt: Date;
};

type DashboardPayloadLoader = (resource: string) => Promise<DashboardPayloadRow[]>;

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

function parsePayrollDate(month?: string | null, year?: number | null): Date | null {
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
}

export async function buildFinanceCashflowSummaryPayload() {
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
      select: {
        id: true,
        kodeVendor: true,
        namaVendor: true,
        kategori: true,
        alamat: true,
        kota: true,
        kontak: true,
        telepon: true,
        email: true,
        npwp: true,
        paymentTerms: true,
        rating: true,
        status: true,
        updatedAt: true,
      },
    }),
    prisma.customerRecord.findMany({
      select: {
        id: true,
        kodeCustomer: true,
        namaCustomer: true,
        alamat: true,
        kota: true,
        kontak: true,
        telepon: true,
        email: true,
        npwp: true,
        paymentTerms: true,
        rating: true,
        status: true,
        updatedAt: true,
      },
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
    outstandingAmount: Math.max(
      0,
      Number(row.outstandingAmount || Number(row.totalAmount || 0) - Number(row.paidAmount || 0))
    ),
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

  return {
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
  };
}

export async function buildFinanceCashflowPageSummaryPayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
}) {
  const { loadDashboardPayloadRows } = params;
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

  normalizedPayrolls.forEach((row) => {
    const date = parsePayrollDate(row.month, row.year || 0);
    if (!date) return;
    const entry = ensure(date);
    entry.outflow += row.totalPayroll;
  });

  const monthlyCashflow = monthKeys
    .map((key) => monthMap.get(key)!)
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-6);

  const pieData = [
    { name: "Material Purchases", value: outflowPurchases, color: "#3b82f6" },
    { name: "Payroll/Labor", value: outflowPayroll, color: "#10b981" },
    { name: "Vendor/Other", value: outflowOther, color: "#f59e0b" },
  ].filter((item) => item.value > 0);

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

  normalizedPayrolls.forEach((row) => {
    const date = parsePayrollDate(row.month, row.year || 0);
    if (!date) return;
    txRows.push({
      date: date.toISOString(),
      category: "Payroll / Gaji",
      entity: row.employeeName,
      amount: row.totalPayroll,
      direction: "OUT",
      status: row.status,
    });
  });

  const transactionLog = txRows
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  return {
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
  };
}

export async function buildFinanceArSummaryPayload() {
  const [invoices, customers] = await Promise.all([
    prisma.invoiceRecord.findMany({
      select: invoiceDashboardSelect,
    }),
    prisma.customerRecord.findMany({
      select: {
        id: true,
        kodeCustomer: true,
        namaCustomer: true,
        alamat: true,
        kota: true,
        kontak: true,
        telepon: true,
        email: true,
        npwp: true,
        paymentTerms: true,
        rating: true,
        status: true,
        updatedAt: true,
      },
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

  return {
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
  };
}

export async function buildFinanceVendorSummaryPayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
}) {
  const { loadDashboardPayloadRows } = params;
  const [vendorExpenses, vendors] = await Promise.all([
    loadDashboardPayloadRows("vendor-expenses"),
    prisma.vendorRecord.findMany({
      select: {
        id: true,
        kodeVendor: true,
        namaVendor: true,
        kategori: true,
        alamat: true,
        kota: true,
        kontak: true,
        telepon: true,
        email: true,
        npwp: true,
        paymentTerms: true,
        rating: true,
        status: true,
        updatedAt: true,
      },
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
  const pendingExpenses = normalizedExpenses.filter((item) => item.status === "PENDING APPROVAL");
  const approvedExpenses = normalizedExpenses.filter((item) => item.status === "APPROVED");
  const paidExpenses = normalizedExpenses.filter((item) => item.status === "PAID");
  const totalPending = pendingExpenses.reduce((sum, item) => sum + item.totalNominal, 0);
  const totalApproved = approvedExpenses.reduce((sum, item) => sum + item.totalNominal, 0);
  const totalPaid = paidExpenses.reduce((sum, item) => sum + item.totalNominal, 0);

  const expenseByCategory = normalizedExpenses.reduce((acc, item) => {
    acc[item.kategori] = (acc[item.kategori] || 0) + item.totalNominal;
    return acc;
  }, {} as Record<string, number>);

  const expenseByProject = normalizedExpenses.reduce((acc, item) => {
    if (!item.projectName) return acc;
    acc[item.projectName] = (acc[item.projectName] || 0) + item.totalNominal;
    return acc;
  }, {} as Record<string, number>);

  const topVendors = Object.entries(
    normalizedExpenses.reduce((acc, item) => {
      acc[item.vendorName] = (acc[item.vendorName] || 0) + item.totalNominal;
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

  return {
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
  };
}

export async function buildFinanceBudgetSummaryPayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
}) {
  const { loadDashboardPayloadRows } = params;
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

  const grandTotalBudget = projectAnalysis.reduce((sum, item) => sum + item.totalBudget, 0);
  const grandTotalActual = projectAnalysis.reduce((sum, item) => sum + item.totalActual, 0);
  const grandTotalVariance = grandTotalActual - grandTotalBudget;

  return {
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
  };
}

export async function buildFinanceApSummaryPayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
}) {
  const { loadDashboardPayloadRows } = params;
  const vendorInvoices = await loadDashboardPayloadRows("vendor-invoices");
  const rows = vendorInvoices.map((row) => asRecord(row.payload));
  const { stats, topSuppliers } = buildFinanceApSummary(rows);

  return {
    generatedAt: new Date().toISOString(),
    stats,
    topSuppliers,
    lastUpdatedAt: maxDate(vendorInvoices.map((row) => row.updatedAt)),
  };
}

export async function buildFinanceArAgingPayload() {
  const invoices = await prisma.invoiceRecord.findMany({
    select: invoiceDashboardSelect,
  });

  const rows = invoices.map((row) => mapInvoiceDashboardPayload(row));
  const { agingList, totals } = buildFinanceArAgingSummary(rows);

  return {
    generatedAt: new Date().toISOString(),
    agingList,
    totals,
    lastUpdatedAt: maxDate(invoices.map((row) => row.updatedAt)),
  };
}

export async function buildFinanceGeneralLedgerSummaryPayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
}) {
  const { loadDashboardPayloadRows } = params;
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

  return {
    generatedAt: new Date().toISOString(),
    journalEntries,
    financialData,
    totals,
    lastUpdatedAt: maxDate([
      ...archives.map((row) => row.updatedAt),
      ...invoices.map((row) => row.updatedAt),
      ...purchaseOrders.map((row) => row.updatedAt),
    ]),
  };
}

export async function buildFinanceRevenueSummaryPayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
}) {
  const { loadDashboardPayloadRows } = params;
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

  for (const row of quotations) {
    const payload = asRecord(row.payload);
    const projectId = readString(payload, "projectId");
    if (!projectId) continue;
    const current = byProject.get(projectId);
    if (!current) continue;
    if (!current.quotationValue) {
      current.quotationValue = Number(row.grandTotal || 0);
    }
    byProject.set(projectId, current);
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

  return {
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
  };
}

export async function buildFinanceProjectPlSummaryPayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
}) {
  const { loadDashboardPayloadRows } = params;
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

  const rows = projectRows.map((project) => {
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
      .filter((movement) => {
        const type = String(readString(movement, "type") || "").toUpperCase();
        if (type !== "OUT") return false;
        const projectId = readString(movement, "projectId");
        const projectName = String(readString(movement, "projectName") || "").toLowerCase();
        const refNo = readString(movement, "refNo") || "";
        return projectId === id || projectName === namaProject.toLowerCase() || refNo.includes(id);
      })
      .reduce((sum, movement) => {
        const kode =
          readString(movement, "itemKode") ||
          readString(movement, "itemCode") ||
          readString(movement, "kode") ||
          "";
        const qty = readNumber(movement, "qty");
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
    revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    cost: rows.reduce((sum, row) => sum + row.totalActualCost, 0),
    netProfit: rows.reduce((sum, row) => sum + row.netProfit, 0),
    avgMargin:
      rows.length > 0
        ? rows.reduce((sum, row) => sum + row.margin, 0) / rows.length
        : 0,
  };

  return {
    generatedAt: new Date().toISOString(),
    rows: rows.sort((a, b) => b.revenue - a.revenue),
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
  };
}

export async function buildFinanceYearEndSummaryPayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
}) {
  const { loadDashboardPayloadRows } = params;
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
  const totalVend = vendorInvRows.reduce((sum, item) => sum + readNumber(item, "paidAmount"), 0);
  const totalLabor = payrolls.reduce((sum, item) => sum + (item.totalPayroll || 0), 0);
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

  for (const inv of invoiceRows) {
    const date = parseDate(readString(inv, "tanggal") || readString(inv, "date"));
    if (!date) continue;
    monthly[date.getMonth()].rev +=
      readNumber(inv, "totalBayar") || readNumber(inv, "subtotal") || readNumber(inv, "totalAmount");
  }

  for (const po of poRows) {
    const status = String(readString(po, "status") || "").toUpperCase();
    if (!["COMPLETED", "RECEIVED"].includes(status)) continue;
    const date = parseDate(readString(po, "tanggal") || readString(po, "date"));
    if (!date) continue;
    monthly[date.getMonth()].outflow += readNumber(po, "total") || readNumber(po, "totalAmount");
  }

  for (const payroll of payrolls) {
    const date = parsePayrollDate(payroll.month, payroll.year);
    if (!date) continue;
    monthly[date.getMonth()].outflow += payroll.totalPayroll || 0;
  }

  for (const vendor of vendorInvRows) {
    const date = parseDate(
      readString(vendor, "paidAt") ||
        readString(vendor, "tanggalBayar") ||
        readString(vendor, "paymentDate") ||
        readString(vendor, "date") ||
        readString(vendor, "tanggal") ||
        readString(vendor, "jatuhTempo") ||
        readString(vendor, "dueDate")
    );
    if (!date) continue;
    monthly[date.getMonth()].outflow += readNumber(vendor, "paidAmount");
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

  return {
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
  };
}

export async function buildFinancePayrollSummaryPayload() {
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
    const empAttendance = attendances.filter((item) => item.employeeId === employeeId);
    const totalHours = empAttendance.reduce((sum, item) => sum + (item.workHours ?? 0), 0);
    const totalOvertime = empAttendance.reduce((sum, item) => sum + (item.overtime ?? 0), 0);
    const presentCount = empAttendance.filter((item) => {
      const status = String(item.status || "").toUpperCase();
      return status === "PRESENT" || status === "H" || status === "HADIR" || status === "MASUK";
    }).length;

    const totalKasbon = kasbons
      .filter((item) => {
        const matchesEmployee = String(item.employeeId || "") === employeeId;
        const status = String(item.status || "").toUpperCase();
        return matchesEmployee && (item.approved || status === "APPROVED" || status === "PAID");
      })
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

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

  const totalNetPayroll = payrollRows.reduce((sum, row) => sum + row.netSalary, 0);
  const totalManHours = payrollRows.reduce((sum, row) => sum + row.totalHours, 0);
  const totalOvertime = payrollRows.reduce((sum, row) => sum + row.totalOvertime, 0);
  const totalKasbon = payrollRows.reduce((sum, row) => sum + row.totalKasbon, 0);

  return {
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
  };
}

export async function buildFinancePpnSummaryPayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
}) {
  const { loadDashboardPayloadRows } = params;
  const [invoices, vendorInvoices] = await Promise.all([
    prisma.invoiceRecord.findMany({
      select: invoiceDashboardSelect,
    }),
    loadDashboardPayloadRows("vendor-invoices"),
  ]);

  const invoiceRows = invoices.map((row) => mapInvoiceDashboardPayload(row));
  const vendorRows = vendorInvoices.map((row) => asRecord(row.payload));
  const { summary, keluaran, masukan } = buildFinancePpnSummary(invoiceRows, vendorRows);

  return {
    generatedAt: new Date().toISOString(),
    summary,
    keluaran,
    masukan,
    lastUpdatedAt: maxDate([
      ...invoices.map((row) => row.updatedAt),
      ...vendorInvoices.map((row) => row.updatedAt),
    ]),
  };
}

export async function buildFinanceBankReconSummaryPayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
}) {
  const { loadDashboardPayloadRows } = params;
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

  return {
    generatedAt: new Date().toISOString(),
    summary,
    transactions,
    lastUpdatedAt: maxDate([
      ...invoices.map((row) => row.updatedAt),
      ...vendorInvoices.map((row) => row.updatedAt),
      ...archives.map((row) => row.updatedAt),
    ]),
  };
}

export async function buildFinancePettyCashSummaryPayload() {
  const pettyDelegate = (prisma as unknown as Record<string, unknown>)
    .financePettyCashTransactionRecord as DashboardPettyCashDelegate | undefined;
  if (!pettyDelegate || typeof pettyDelegate.findMany !== "function") {
    throw new Error("Petty cash dedicated delegate unavailable");
  }

  const transactions = await pettyDelegate.findMany({
    select: { id: true, payload: true, updatedAt: true },
  });
  const pettyTransactions = transactions.map((tx) => ({
    id: tx.id,
    payload: asRecord(tx.payload),
  }));
  const { summary, rows } = buildFinancePettyCashSummary(pettyTransactions);

  return {
    generatedAt: new Date().toISOString(),
    summary,
    rows,
    lastUpdatedAt: maxDate(transactions.map((tx) => tx.updatedAt)),
  };
}

export async function buildFinancePaymentSummaryPayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
}) {
  const { loadDashboardPayloadRows } = params;
  const [invoices, expenses] = await Promise.all([
    prisma.invoiceRecord.findMany({
      select: invoiceDashboardSelect,
    }),
    loadDashboardPayloadRows("vendor-expenses"),
  ]);

  const arRows = invoices.map((row) => mapInvoiceDashboardPayload(row));
  const expRows = expenses.map((row) => asRecord(row.payload));
  const summary = buildFinancePaymentSummary(arRows, expRows);

  return {
    generatedAt: new Date().toISOString(),
    summary,
    lastUpdatedAt: maxDate([
      ...invoices.map((row) => row.updatedAt),
      ...expenses.map((row) => row.updatedAt),
    ]),
  };
}

export async function buildFinanceReconciliationCheckPayload(params: {
  loadDashboardPayloadRows: DashboardPayloadLoader;
  startDateRaw?: string;
}) {
  const { loadDashboardPayloadRows, startDateRaw = "2026-01-01" } = params;
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
    const date = parseDate(rawDate);
    return !!date && date >= startDate;
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
      const date = parseDate(readString(tx.payload, "date"));
      return !!date && date >= startDate;
    });

  const { checks, recordCounts } = buildFinanceReconciliationCheck({
    invoiceRows,
    expenseRows,
    pettyRows: pettyRows.map((tx) => ({ id: tx.id, payload: tx.payload })),
    startDate,
  });

  return {
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
  };
}
