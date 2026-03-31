import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFinanceBankReconSummary,
  buildFinancePaymentRegistryDetail,
  buildFinancePaymentSummary,
  buildFinancePettyCashRows,
  buildFinancePettyCashSummary,
  buildFinanceReconciliationCheck,
} from "./dashboardFinanceCashHelpers";

test("buildFinancePaymentSummary computes realized cash with payment date filtering", () => {
  const summary = buildFinancePaymentSummary(
    [
      {
        id: "inv-1",
        totalBayar: 500_000,
        paidAmount: 200_000,
        outstandingAmount: 300_000,
        tanggalBayar: "2026-03-20",
      },
      {
        id: "inv-2",
        totalNominal: 300_000,
        paidAmount: 50_000,
        tanggal: "2026-02-20",
      },
    ],
    [
      { id: "exp-1", status: "Paid", totalNominal: 120_000 },
      { id: "exp-2", status: "Approved", nominal: 80_000 },
      { id: "exp-3", status: "Pending Approval", nominal: 40_000 },
    ],
    {
      invoicePaymentDateFilter: (rawDate) => rawDate === "2026-03-20",
    },
  );

  assert.equal(summary.arOutstanding, 550_000);
  assert.equal(summary.paidIn, 200_000);
  assert.equal(summary.paidOut, 120_000);
  assert.equal(summary.pendingVendor, 120_000);
  assert.equal(summary.netCashRealized, 80_000);
});

test("buildFinancePaymentRegistryDetail counts inbound and outbound finance rows", () => {
  const detail = buildFinancePaymentRegistryDetail(
    [
      { id: "inv-1", paidAmount: 100_000, tanggalBayar: "2026-03-10" },
      { id: "inv-2", paidAmount: 0, tanggal: "2026-03-11" },
      { id: "inv-3", paidAmount: 50_000, date: "2026-02-28" },
    ],
    [
      { id: "exp-1", status: "Approved", nominal: 40_000 },
      { id: "exp-2", status: "Rejected", totalNominal: 30_000 },
      { id: "exp-3", status: "Paid", totalNominal: 20_000 },
      { id: "exp-4", status: "Draft", totalNominal: 999_999 },
    ],
    (rawDate) => rawDate === "2026-03-10" || rawDate === "2026-03-11",
  );

  assert.equal(detail.inboundCount, 1);
  assert.equal(detail.outboundCount, 3);
  assert.equal(detail.outboundTotalListed, 90_000);
  assert.equal(detail.outboundRejectedTotal, 30_000);
});

test("buildFinancePettyCashSummary separates debit and credit rows from tagged sources", () => {
  const summary = buildFinancePettyCashSummary([
    {
      id: "pc-1",
      payload: {
        id: "pc-1",
        date: "2026-03-15",
        ref: "PC-TOPUP-001",
        description: "Topup kas kecil",
        amount: 300_000,
        source: "petty-cash|kind=topup",
      },
    },
    {
      id: "pc-2",
      payload: {
        id: "pc-2",
        date: "2026-03-16",
        ref: "PC-EXP-001",
        description: "Beli konsumsi",
        amount: 75_000,
        source: "petty-cash|direction=credit",
      },
    },
    {
      id: "pc-3",
      payload: {
        id: "pc-3",
        date: "2026-03-17",
        ref: "BK-001",
        description: "Setoran bank",
        amount: 50_000,
        type: "BK",
      },
    },
  ]);

  assert.equal(summary.summary.totalDebit, 350_000);
  assert.equal(summary.summary.totalCredit, 75_000);
  assert.equal(summary.summary.endingBalance, 275_000);
  assert.equal(summary.summary.transactionCount, 3);
  assert.equal(summary.rows[0]?.id, "pc-3");
  assert.equal(summary.rows[0]?.debit, 50_000);
  assert.equal(summary.rows[1]?.credit, 75_000);
});

test("buildFinancePettyCashRows keeps normalized row shape for ledger display", () => {
  const rows = buildFinancePettyCashRows([
    {
      id: "pc-1",
      payload: {
        date: "2026-03-10",
        ref: "PC-001",
        description: "Operasional",
        amount: 25_000,
        source: "petty-cash|direction=credit",
      },
    },
  ]);

  assert.deepEqual(rows, [
    {
      id: "pc-1",
      date: "2026-03-10",
      ref: "PC-001",
      description: "Operasional",
      debit: 0,
      credit: 25_000,
      amount: 25_000,
      type: "",
    },
  ]);
});

test("buildFinanceBankReconSummary merges AR, AP, and archive transactions", () => {
  const summary = buildFinanceBankReconSummary(
    [
      {
        id: "inv-1",
        noInvoice: "INV-001",
        paidAmount: 150_000,
        totalBayar: 200_000,
        paidAt: "2026-03-21",
      },
    ],
    [
      {
        id: "vinv-1",
        noInvoiceVendor: "VINV-001",
        paidAmount: 90_000,
        paymentDate: "2026-03-20",
      },
    ],
    [
      {
        id: "arc-1",
        date: "2026-03-19",
        type: "BK",
        amount: 40_000,
        ref: "BK-001",
        description: "Top up",
      },
      {
        id: "arc-2",
        date: "2026-03-18",
        type: "AP",
        amount: 10_000,
        ref: "AP-001",
        description: "Misc expense",
      },
    ],
  );

  assert.equal(summary.summary.totalDebit, 190_000);
  assert.equal(summary.summary.totalCredit, 100_000);
  assert.equal(summary.summary.netMovement, 90_000);
  assert.equal(summary.summary.transactionCount, 4);
  assert.equal(summary.transactions[0]?.id, "inv-1");
  assert.equal(summary.transactions[1]?.id, "vinv-1");
});

test("buildFinanceReconciliationCheck combines summary, detail, and petty cash consistency", () => {
  const check = buildFinanceReconciliationCheck({
    invoiceRows: [
      {
        id: "inv-1",
        totalBayar: 500_000,
        paidAmount: 200_000,
        outstandingAmount: 300_000,
        tanggalBayar: "2026-03-25",
      },
    ],
    expenseRows: [
      { id: "exp-1", status: "Paid", totalNominal: 150_000 },
      { id: "exp-2", status: "Approved", nominal: 25_000 },
    ],
    pettyRows: [
      {
        id: "pc-1",
        payload: {
          date: "2026-03-26",
          ref: "PC-TOPUP-001",
          amount: 100_000,
          source: "petty-cash|kind=topup",
        },
      },
      {
        id: "pc-2",
        payload: {
          date: "2026-03-27",
          ref: "PC-OUT-001",
          amount: 20_000,
          source: "petty-cash|direction=credit",
        },
      },
    ],
    startDate: new Date("2026-03-01T00:00:00.000Z"),
  });

  assert.equal(check.checks.paymentRegistry.summary.paidIn, 200_000);
  assert.equal(check.checks.paymentRegistry.summary.paidOut, 150_000);
  assert.equal(check.checks.paymentRegistry.detail.outboundCount, 2);
  assert.equal(check.checks.paymentRegistry.isConsistentSource, true);
  assert.equal(check.checks.paymentRegistry.isNetCashConsistent, true);
  assert.equal(check.checks.pettyCash.summary.totalDebit, 100_000);
  assert.equal(check.checks.pettyCash.summary.totalCredit, 20_000);
  assert.equal(check.recordCounts.invoices, 1);
  assert.equal(check.recordCounts.vendorExpenses, 2);
  assert.equal(check.recordCounts.pettyCashTransactions, 2);
});
