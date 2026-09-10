import { readNumber, readString } from "./dashboardRouteSupport";

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildFinanceApSummary(
  vendorRows: Array<Record<string, unknown>>,
  now: Date = new Date()
) {
  const normalized = vendorRows.map((payload, idx) => {
    const totalAmount =
      readNumber(payload, "totalAmount") ||
      readNumber(payload, "totalNominal") ||
      readNumber(payload, "amount") ||
      readNumber(payload, "grandTotal");
    const paidAmount = readNumber(payload, "paidAmount");
    const status = readString(payload, "status") || "Unpaid";
    const dueDateRaw =
      readString(payload, "jatuhTempo") || readString(payload, "dueDate") || readString(payload, "due_date");
    const dueDate = parseDate(dueDateRaw);
    const outstanding = Math.max(
      0,
      readNumber(payload, "outstandingAmount") || totalAmount - paidAmount
    );
    const isOverdue =
      outstanding > 0 &&
      !!dueDate &&
      dueDate.getTime() < now.getTime() &&
      status.toUpperCase() !== "PAID";

    return {
      id: readString(payload, "id") || `VINV-${idx + 1}`,
      supplier:
        readString(payload, "supplier") ||
        readString(payload, "vendor") ||
        readString(payload, "vendorName") ||
        "Unknown Supplier",
      noInvoiceVendor: readString(payload, "noInvoiceVendor") || "",
      noPO: readString(payload, "noPO") || "",
      projectId: readString(payload, "projectId") || "",
      status,
      totalAmount,
      paidAmount,
      outstanding,
      isOverdue,
    };
  });

  const totalPayable = normalized.reduce((sum, inv) => sum + inv.outstanding, 0);
  const overdueAmount = normalized
    .filter((inv) => inv.isOverdue)
    .reduce((sum, inv) => sum + inv.outstanding, 0);
  const paidThisMonth = normalized
    .filter((inv) => inv.paidAmount > 0)
    .reduce((sum, inv) => sum + inv.paidAmount, 0);

  const topSuppliers = Object.entries(
    normalized.reduce((acc, inv) => {
      acc[inv.supplier] = (acc[inv.supplier] || 0) + inv.outstanding;
      return acc;
    }, {} as Record<string, number>)
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([supplier, outstanding]) => ({ supplier, outstanding }));

  return {
    stats: {
      totalPayable,
      overdue: overdueAmount,
      paidThisMonth,
      invoiceCount: normalized.length,
      overdueCount: normalized.filter((inv) => inv.isOverdue).length,
    },
    topSuppliers,
  };
}

export function buildFinanceArAgingSummary(
  invoiceRows: Array<Record<string, unknown>>,
  now: Date = new Date()
) {
  const byCustomer = new Map<
    string,
    {
      id: string;
      customer: string;
      totalOutstanding: number;
      current: number;
      days30: number;
      days60: number;
      days90: number;
      over90: number;
    }
  >();

  for (let i = 0; i < invoiceRows.length; i += 1) {
    const payload = invoiceRows[i];
    const totalNominal =
      readNumber(payload, "totalBayar") ||
      readNumber(payload, "subtotal") ||
      readNumber(payload, "totalNominal") ||
      readNumber(payload, "totalAmount") ||
      readNumber(payload, "amount");
    const paidAmount = readNumber(payload, "paidAmount");
    const outstanding = Math.max(
      0,
      readNumber(payload, "outstandingAmount") || totalNominal - paidAmount
    );
    if (outstanding <= 0) continue;

    const customer = readString(payload, "customerName") || "Unknown Customer";
    const dueDateRaw = readString(payload, "dueDate") || readString(payload, "jatuhTempo");
    const dueDate = parseDate(dueDateRaw);
    const agingDays = dueDate ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    const current =
      byCustomer.get(customer) || {
        id: customer,
        customer,
        totalOutstanding: 0,
        current: 0,
        days30: 0,
        days60: 0,
        days90: 0,
        over90: 0,
      };

    current.totalOutstanding += outstanding;
    if (agingDays <= 0) current.current += outstanding;
    else if (agingDays <= 30) current.days30 += outstanding;
    else if (agingDays <= 60) current.days60 += outstanding;
    else if (agingDays <= 90) current.days90 += outstanding;
    else current.over90 += outstanding;

    byCustomer.set(customer, current);
  }

  const agingList = Array.from(byCustomer.values()).sort(
    (a, b) => b.totalOutstanding - a.totalOutstanding
  );
  const totals = agingList.reduce(
    (acc, item) => {
      acc.totalOutstanding += item.totalOutstanding;
      acc.current += item.current;
      acc.days30 += item.days30;
      acc.days60 += item.days60;
      acc.days90 += item.days90;
      acc.over90 += item.over90;
      return acc;
    },
    {
      totalOutstanding: 0,
      current: 0,
      days30: 0,
      days60: 0,
      days90: 0,
      over90: 0,
    }
  );

  return { agingList, totals };
}

function parseGeneralLedgerSourceMeta(source?: string | null) {
  if (!source) return { category: "Operating", debit: 0, credit: 0 };
  const parts = source.split("|");
  if (parts[0] !== "general-ledger") return { category: "Operating", debit: 0, credit: 0 };
  const meta = Object.fromEntries(
    parts
      .slice(1)
      .map((p) => p.split("="))
      .filter((kv) => kv.length === 2)
      .map(([k, v]) => [k, decodeURIComponent(v)])
  );
  return {
    category: (meta.category as string) || "Operating",
    debit: Number(meta.debit || 0),
    credit: Number(meta.credit || 0),
  };
}

export function buildFinanceGeneralLedgerSummary(
  archiveRows: Array<Record<string, unknown>>,
  invoiceRows: Array<Record<string, unknown>>,
  poRows: Array<Record<string, unknown>>
) {
  const sorted = [...archiveRows].sort((a, b) => {
    const ad = readString(a, "date") || "";
    const bd = readString(b, "date") || "";
    return bd.localeCompare(ad);
  });

  let running = 0;
  const journalEntries = sorted
    .filter((row) => {
      const source = readString(row, "source") || "";
      const ref = readString(row, "ref") || "";
      return source.startsWith("general-ledger") || ref.startsWith("GJ/");
    })
    .reverse()
    .map((row, idx) => {
      const source = readString(row, "source") || "";
      const parsed = parseGeneralLedgerSourceMeta(source);
      const debit = parsed.debit;
      const credit = parsed.credit;
      running += debit - credit;
      return {
        id: readString(row, "id") || `GL-${idx + 1}`,
        date: readString(row, "date") || "",
        reference: readString(row, "ref") || "",
        description: readString(row, "description") || "-",
        category: parsed.category,
        debit,
        credit,
        balance: running,
        sourceId: readString(row, "id") || "",
      };
    })
    .reverse();

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const financialData = months
    .map((m, i) => {
      const monthEntries = journalEntries.filter((e) => {
        const d = parseDate(e.date);
        return !!d && d.getMonth() === i;
      });
      const totalIncome = monthEntries.reduce((sum, e) => sum + e.debit, 0);
      const totalExpense = monthEntries.reduce((sum, e) => sum + e.credit, 0);
      return {
        month: m,
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense,
      };
    })
    .filter((x) => x.totalIncome > 0 || x.totalExpense > 0);

  const income = journalEntries.reduce((sum, e) => sum + e.debit, 0);
  const expense = journalEntries.reduce((sum, e) => sum + e.credit, 0);
  const net = income - expense;
  const health = income > 0 ? Math.max(0, Math.min(100, (net / income) * 100 + 50)) : 100;
  const receivable = invoiceRows
    .filter((row) => (readString(row, "status") || "").toUpperCase() !== "PAID")
    .reduce((sum, row) => {
      const total =
        readNumber(row, "totalBayar") ||
        readNumber(row, "subtotal") ||
        readNumber(row, "totalAmount") ||
        readNumber(row, "amount");
      const paid = readNumber(row, "paidAmount");
      const outstanding = Math.max(
        0,
        readNumber(row, "outstandingAmount") || total - paid
      );
      return sum + outstanding;
    }, 0);
  const payable = poRows.reduce(
    (sum, row) =>
      sum +
      (readNumber(row, "total") ||
        readNumber(row, "totalAmount") ||
        readNumber(row, "grandTotal")),
    0
  );

  return {
    journalEntries,
    financialData,
    totals: {
      income,
      expense,
      net,
      health,
      receivable,
      payable,
    },
  };
}

export function buildFinancePpnSummary(
  invoiceRows: Array<Record<string, unknown>>,
  vendorRows: Array<Record<string, unknown>>
) {
  const keluaran = invoiceRows.map((row, idx) => {
    const dpp = readNumber(row, "subtotal") || readNumber(row, "dpp") || readNumber(row, "totalBayar");
    const ppn = readNumber(row, "ppn") || dpp * 0.11;
    return {
      id: readString(row, "id") || `OUT-${idx + 1}`,
      noInvoice: readString(row, "noInvoice") || "-",
      tanggal: readString(row, "tanggal") || readString(row, "date") || "",
      customer: readString(row, "customer") || readString(row, "customerName") || "-",
      dpp,
      ppn,
    };
  });

  const masukan = vendorRows.map((row, idx) => {
    const dpp =
      readNumber(row, "subtotal") ||
      readNumber(row, "dpp") ||
      readNumber(row, "totalAmount") ||
      readNumber(row, "grandTotal");
    const ppn = readNumber(row, "ppn") || dpp * 0.11;
    return {
      id: readString(row, "id") || `IN-${idx + 1}`,
      noInvoiceVendor: readString(row, "noInvoiceVendor") || "-",
      tanggal: readString(row, "tanggal") || readString(row, "date") || readString(row, "jatuhTempo") || "",
      supplier:
        readString(row, "supplier") ||
        readString(row, "vendor") ||
        readString(row, "vendorName") ||
        "-",
      dpp,
      ppn,
    };
  });

  const totalKeluaran = keluaran.reduce((sum, x) => sum + x.ppn, 0);
  const totalMasukan = masukan.reduce((sum, x) => sum + x.ppn, 0);

  return {
    summary: {
      totalKeluaran,
      totalMasukan,
      ppnKurangBayar: Math.max(0, totalKeluaran - totalMasukan),
      ppnLebihBayar: Math.max(0, totalMasukan - totalKeluaran),
    },
    keluaran,
    masukan,
  };
}
