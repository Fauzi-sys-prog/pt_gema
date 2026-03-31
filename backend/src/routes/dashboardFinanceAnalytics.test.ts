import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFinanceApSummary,
  buildFinanceArAgingSummary,
  buildFinanceGeneralLedgerSummary,
  buildFinancePpnSummary,
} from "./dashboardFinanceAnalytics";

test("buildFinanceApSummary computes outstanding, overdue, and top suppliers", () => {
  const summary = buildFinanceApSummary(
    [
      {
        id: "vinv-1",
        supplier: "Vendor Alpha",
        totalAmount: 1_000_000,
        paidAmount: 250_000,
        dueDate: "2026-03-10",
        status: "Unpaid",
      },
      {
        id: "vinv-2",
        vendorName: "Vendor Beta",
        grandTotal: 500_000,
        outstandingAmount: 500_000,
        jatuhTempo: "2026-04-10",
        status: "Approved",
      },
      {
        id: "vinv-3",
        supplier: "Vendor Alpha",
        totalNominal: 400_000,
        paidAmount: 400_000,
        dueDate: "2026-03-05",
        status: "Paid",
      },
    ],
    new Date("2026-03-31T00:00:00.000Z"),
  );

  assert.equal(summary.stats.totalPayable, 1_250_000);
  assert.equal(summary.stats.overdue, 750_000);
  assert.equal(summary.stats.paidThisMonth, 650_000);
  assert.equal(summary.stats.invoiceCount, 3);
  assert.equal(summary.stats.overdueCount, 1);
  assert.deepEqual(summary.topSuppliers[0], {
    supplier: "Vendor Alpha",
    outstanding: 750_000,
  });
  assert.deepEqual(summary.topSuppliers[1], {
    supplier: "Vendor Beta",
    outstanding: 500_000,
  });
});

test("buildFinanceArAgingSummary buckets outstanding receivables by age and aggregates by customer", () => {
  const summary = buildFinanceArAgingSummary(
    [
      {
        id: "inv-1",
        customerName: "PT Satu",
        totalBayar: 1_000_000,
        paidAmount: 250_000,
        dueDate: "2026-03-20",
      },
      {
        id: "inv-2",
        customerName: "PT Dua",
        totalAmount: 500_000,
        paidAmount: 0,
        dueDate: "2026-02-10",
      },
      {
        id: "inv-3",
        customerName: "PT Satu",
        totalNominal: 200_000,
        outstandingAmount: 200_000,
        jatuhTempo: "2026-04-05",
      },
      {
        id: "inv-4",
        customerName: "PT Tiga",
        amount: 900_000,
        paidAmount: 0,
        dueDate: "2025-12-01",
      },
      {
        id: "inv-5",
        customerName: "PT Lunas",
        totalBayar: 300_000,
        paidAmount: 300_000,
        dueDate: "2026-03-15",
      },
    ],
    new Date("2026-03-31T00:00:00.000Z"),
  );

  assert.equal(summary.agingList.length, 3);
  assert.deepEqual(summary.agingList[0], {
    id: "PT Satu",
    customer: "PT Satu",
    totalOutstanding: 950_000,
    current: 200_000,
    days30: 750_000,
    days60: 0,
    days90: 0,
    over90: 0,
  });
  assert.deepEqual(summary.agingList[1], {
    id: "PT Tiga",
    customer: "PT Tiga",
    totalOutstanding: 900_000,
    current: 0,
    days30: 0,
    days60: 0,
    days90: 0,
    over90: 900_000,
  });
  assert.equal(summary.totals.totalOutstanding, 2_350_000);
  assert.equal(summary.totals.current, 200_000);
  assert.equal(summary.totals.days30, 750_000);
  assert.equal(summary.totals.days60, 500_000);
  assert.equal(summary.totals.days90, 0);
  assert.equal(summary.totals.over90, 900_000);
});

test("buildFinanceGeneralLedgerSummary derives journal entries, monthly rollups, and receivable/payable totals", () => {
  const summary = buildFinanceGeneralLedgerSummary(
    [
      {
        id: "arc-1",
        date: "2026-01-15",
        ref: "GJ/001",
        source: "general-ledger|category=Revenue|debit=1000000|credit=0",
        description: "Invoice revenue",
      },
      {
        id: "arc-2",
        date: "2026-02-01",
        ref: "GJ/002",
        source: "general-ledger|category=Expense|debit=0|credit=250000",
        description: "Operating expense",
      },
      {
        id: "arc-3",
        date: "2026-02-20",
        ref: "BK/001",
        source: "petty-cash",
        description: "Ignored archive row",
      },
    ],
    [
      { id: "inv-1", status: "Unpaid", totalBayar: 600_000, paidAmount: 100_000 },
      { id: "inv-2", status: "Paid", totalAmount: 400_000, paidAmount: 400_000 },
    ],
    [{ id: "po-1", total: 350_000 }, { id: "po-2", totalAmount: 150_000 }],
  );

  assert.equal(summary.journalEntries.length, 2);
  assert.deepEqual(summary.journalEntries[0], {
    id: "arc-2",
    date: "2026-02-01",
    reference: "GJ/002",
    description: "Operating expense",
    category: "Expense",
    debit: 0,
    credit: 250_000,
    balance: 750_000,
    sourceId: "arc-2",
  });
  assert.equal(summary.journalEntries[1]?.balance, 1_000_000);
  assert.deepEqual(summary.financialData, [
    { month: "Jan", totalIncome: 1_000_000, totalExpense: 0, netProfit: 1_000_000 },
    { month: "Feb", totalIncome: 0, totalExpense: 250_000, netProfit: -250_000 },
  ]);
  assert.equal(summary.totals.income, 1_000_000);
  assert.equal(summary.totals.expense, 250_000);
  assert.equal(summary.totals.net, 750_000);
  assert.equal(summary.totals.health, 100);
  assert.equal(summary.totals.receivable, 500_000);
  assert.equal(summary.totals.payable, 500_000);
});

test("buildFinancePpnSummary derives fallback 11 percent PPN for output and input tax", () => {
  const summary = buildFinancePpnSummary(
    [
      {
        id: "out-1",
        noInvoice: "INV-001",
        tanggal: "2026-03-01",
        customer: "PT Customer",
        subtotal: 1_000_000,
      },
    ],
    [
      {
        id: "in-1",
        noInvoiceVendor: "VINV-001",
        tanggal: "2026-03-02",
        supplier: "Vendor A",
        totalAmount: 800_000,
      },
    ],
  );

  assert.equal(summary.keluaran[0]?.ppn, 110_000);
  assert.equal(summary.masukan[0]?.ppn, 88_000);
  assert.equal(summary.summary.totalKeluaran, 110_000);
  assert.equal(summary.summary.totalMasukan, 88_000);
  assert.equal(summary.summary.ppnKurangBayar, 22_000);
  assert.equal(summary.summary.ppnLebihBayar, 0);
});
