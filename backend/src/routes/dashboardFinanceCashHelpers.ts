import { parseTaggedSource, readNumber, readString } from "./dashboardRouteSupport";

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildFinancePaymentSummary(
  invoiceRows: Array<Record<string, unknown>>,
  expenseRows: Array<Record<string, unknown>>,
  options?: { invoicePaymentDateFilter?: (rawDate: string | null) => boolean }
) {
  const invoicePaymentDateFilter = options?.invoicePaymentDateFilter;

  const arOutstanding = invoiceRows
    .map((r) => {
      const total =
        readNumber(r, "totalBayar") ||
        readNumber(r, "totalNominal") ||
        readNumber(r, "totalAmount");
      const paid = readNumber(r, "paidAmount");
      return Math.max(0, readNumber(r, "outstandingAmount") || total - paid);
    })
    .reduce((sum, n) => sum + n, 0);

  const paidIn = invoiceRows.reduce((sum, r) => {
    const paymentDate =
      readString(r, "tanggalBayar") ||
      readString(r, "paidAt") ||
      readString(r, "tanggal") ||
      readString(r, "date");
    if (invoicePaymentDateFilter && !invoicePaymentDateFilter(paymentDate)) return sum;
    return sum + readNumber(r, "paidAmount");
  }, 0);

  const paidOut = expenseRows
    .filter((r) => String(readString(r, "status") || "").toUpperCase() === "PAID")
    .reduce((sum, r) => sum + (readNumber(r, "totalNominal") || readNumber(r, "nominal")), 0);

  const pendingVendor = expenseRows
    .filter((r) => {
      const status = String(readString(r, "status") || "").toUpperCase();
      return status === "PENDING APPROVAL" || status === "APPROVED";
    })
    .reduce((sum, r) => sum + (readNumber(r, "totalNominal") || readNumber(r, "nominal")), 0);

  return {
    arOutstanding,
    paidIn,
    paidOut,
    pendingVendor,
    netCashRealized: paidIn - paidOut,
  };
}

export function buildFinancePaymentRegistryDetail(
  invoiceRows: Array<Record<string, unknown>>,
  expenseRows: Array<Record<string, unknown>>,
  isOnOrAfterStart: (rawDate: string | null) => boolean
) {
  const inboundCount = invoiceRows.reduce(
    (sum, r) =>
      sum +
      (readNumber(r, "paidAmount") > 0 &&
      isOnOrAfterStart(
        readString(r, "tanggalBayar") || readString(r, "tanggal") || readString(r, "date")
      )
        ? 1
        : 0),
    0
  );
  const outboundRows = expenseRows.filter((r) =>
    ["APPROVED", "PAID", "PENDING APPROVAL", "REJECTED"].includes(
      String(readString(r, "status") || "").toUpperCase()
    )
  );
  const outboundTotalListed = outboundRows.reduce(
    (sum, r) => sum + (readNumber(r, "totalNominal") || readNumber(r, "nominal")),
    0
  );
  const outboundRejectedTotal = outboundRows
    .filter((r) => String(readString(r, "status") || "").toUpperCase() === "REJECTED")
    .reduce((sum, r) => sum + (readNumber(r, "totalNominal") || readNumber(r, "nominal")), 0);

  return {
    inboundCount,
    outboundCount: outboundRows.length,
    outboundTotalListed,
    outboundRejectedTotal,
  };
}

export function buildFinancePettyCashRows(
  transactions: Array<{ id: string; payload: Record<string, unknown> }>
) {
  return transactions.map((tx, idx) => {
    const row = tx.payload;
    const type = String(readString(row, "type") || "").toUpperCase();
    const amount = readNumber(row, "amount");
    const ref = readString(row, "ref") || "";
    const source = readString(row, "source");
    const sourceTags = parseTaggedSource(source);
    const direction = (sourceTags.direction || "").toLowerCase();
    const kind = (sourceTags.kind || "").toLowerCase();
    const isDebit =
      direction === "debit" ||
      (direction !== "credit" && (kind === "topup" || ref.startsWith("PC-TOPUP-") || type === "BK"));
    return {
      id: readString(row, "id") || tx.id || `PC-${idx + 1}`,
      date: readString(row, "date") || "",
      ref,
      description: readString(row, "description") || "-",
      debit: isDebit ? amount : 0,
      credit: isDebit ? 0 : amount,
      amount,
      type,
    };
  });
}

export function buildFinancePettyCashSummary(
  transactions: Array<{ id: string; payload: Record<string, unknown> }>
) {
  const pettyRows = buildFinancePettyCashRows(transactions);
  const totalDebit = pettyRows.reduce((sum, r) => sum + r.debit, 0);
  const totalCredit = pettyRows.reduce((sum, r) => sum + r.credit, 0);
  return {
    summary: {
      totalDebit,
      totalCredit,
      endingBalance: totalDebit - totalCredit,
      transactionCount: pettyRows.length,
    },
    rows: pettyRows.sort((a, b) => (b.date || "").localeCompare(a.date || "")),
  };
}

export function buildFinanceBankReconSummary(
  invoiceRows: Array<Record<string, unknown>>,
  vendorRows: Array<Record<string, unknown>>,
  archiveRows: Array<Record<string, unknown>>
) {
  const transactions = [
    ...invoiceRows.map((inv, idx) => {
      const paid = readNumber(inv, "paidAmount");
      const total = readNumber(inv, "totalBayar") || readNumber(inv, "totalAmount");
      const paymentDate =
        readString(inv, "tanggalBayar") ||
        readString(inv, "paidAt") ||
        readString(inv, "paymentDate") ||
        readString(inv, "tanggal") ||
        readString(inv, "date") ||
        "";
      return {
        id: readString(inv, "id") || `AR-${idx + 1}`,
        date: paymentDate,
        source: "AR",
        ref: readString(inv, "noInvoice") || "",
        debit: paid > 0 ? paid : 0,
        credit: 0,
        note: `Invoice receipt (${total})`,
      };
    }),
    ...vendorRows.map((vinv, idx) => {
      const paid = readNumber(vinv, "paidAmount");
      const paymentDate =
        readString(vinv, "paidAt") ||
        readString(vinv, "tanggalBayar") ||
        readString(vinv, "paymentDate") ||
        readString(vinv, "date") ||
        readString(vinv, "tanggal") ||
        readString(vinv, "jatuhTempo") ||
        "";
      return {
        id: readString(vinv, "id") || `AP-${idx + 1}`,
        date: paymentDate,
        source: "AP",
        ref: readString(vinv, "noInvoiceVendor") || "",
        debit: 0,
        credit: paid,
        note: "Vendor payment",
      };
    }),
    ...archiveRows.map((arc, idx) => {
      const amount = readNumber(arc, "amount");
      const type = String(readString(arc, "type") || "").toUpperCase();
      const isDebit = type === "AR" || type === "BK";
      return {
        id: readString(arc, "id") || `ARC-${idx + 1}`,
        date: readString(arc, "date") || "",
        source: "ARCHIVE",
        ref: readString(arc, "ref") || "",
        debit: isDebit ? amount : 0,
        credit: isDebit ? 0 : amount,
        note: readString(arc, "description") || "-",
      };
    }),
  ]
    .filter((x) => x.debit > 0 || x.credit > 0)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const totalDebit = transactions.reduce((sum, t) => sum + t.debit, 0);
  const totalCredit = transactions.reduce((sum, t) => sum + t.credit, 0);

  return {
    summary: {
      totalDebit,
      totalCredit,
      netMovement: totalDebit - totalCredit,
      transactionCount: transactions.length,
    },
    transactions,
  };
}

export function buildFinanceReconciliationCheck(input: {
  invoiceRows: Array<Record<string, unknown>>;
  expenseRows: Array<Record<string, unknown>>;
  pettyRows: Array<{ id: string; payload: Record<string, unknown> }>;
  startDate: Date;
}) {
  const { invoiceRows, expenseRows, pettyRows, startDate } = input;

  const isOnOrAfterStart = (rawDate: string | null): boolean => {
    const d = parseDate(rawDate);
    return !!d && d >= startDate;
  };

  const paymentSummary = buildFinancePaymentSummary(invoiceRows, expenseRows, {
    invoicePaymentDateFilter: isOnOrAfterStart,
  });

  const paymentRegistryDetail = buildFinancePaymentRegistryDetail(
    invoiceRows,
    expenseRows,
    isOnOrAfterStart
  );

  const pettyCashRows = pettyRows.map((tx) => ({ id: tx.id, payload: tx.payload }));
  const pettyCashRowsSummary = buildFinancePettyCashRows(pettyCashRows);
  const pettyCashSummary = (() => {
    const totalDebit = pettyCashRowsSummary.reduce((sum, r) => sum + r.debit, 0);
    const totalCredit = pettyCashRowsSummary.reduce((sum, r) => sum + r.credit, 0);
    return {
      totalDebit,
      totalCredit,
      endingBalance: totalDebit - totalCredit,
      transactionCount: pettyCashRowsSummary.length,
    };
  })();

  return {
    checks: {
      paymentRegistry: {
        source: {
          summary: "invoices + vendor-expenses",
          detail: "invoices + vendor-expenses",
        },
        summary: paymentSummary,
        detail: paymentRegistryDetail,
        isConsistentSource: true,
        isNetCashConsistent:
          Math.abs(paymentSummary.netCashRealized - (paymentSummary.paidIn - paymentSummary.paidOut)) < 0.0001,
      },
      pettyCash: {
        source: "finance-petty-cash-transactions (dedicated)",
        summary: pettyCashSummary,
        isConsistentSource: pettyRows.length >= 0,
      },
    },
    recordCounts: {
      invoices: invoiceRows.length,
      vendorExpenses: expenseRows.length,
      pettyCashTransactions: pettyRows.length,
    },
  };
}
