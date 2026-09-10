const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function s(value) {
  if (value == null) return undefined;
  const out = String(value).trim();
  return out.length ? out : undefined;
}
function n(value, fallback = 0) {
  const out = Number(value);
  return Number.isFinite(out) ? out : fallback;
}
function d(value) {
  if (!value) return new Date();
  const out = new Date(value);
  return Number.isNaN(out.getTime()) ? new Date() : out;
}
function parsePettySource(source) {
  const raw = String(source || '');
  const parts = raw.split('|');
  const map = Object.fromEntries(parts.slice(1).map((part) => part.split('=')).filter((part) => part.length === 2));
  return {
    accountCode: s(map.accountCode) || '00000',
    direction: map.direction === 'debit' ? 'debit' : 'credit',
    kind: s(map.kind) || 'transaction',
  };
}

async function backfillWorkingExpense() {
  const rows = await prisma.workingExpenseSheetRecord.findMany();
  for (const row of rows) {
    const payload = asRecord(row.payload);
    await prisma.financeWorkingExpenseSheet.upsert({
      where: { id: row.id },
      update: {
        projectId: row.projectId || s(payload.projectId) || null,
        client: s(payload.client) || null,
        projectName: s(payload.project || payload.projectName) || null,
        location: s(payload.location) || null,
        date: d(payload.date),
        noHal: s(payload.noHal) || row.id,
        revisi: s(payload.revisi) || null,
        totalKas: n(payload.totalKas, 0),
        status: s(payload.status) || 'Draft',
        createdBy: s(payload.createdBy) || null,
        legacyPayload: payload,
        items: {
          deleteMany: {},
          create: (Array.isArray(payload.items) ? payload.items : []).map((raw, index) => {
            const item = asRecord(raw);
            return {
              id: s(item.id) || `${row.id}-ITEM-${String(index + 1).padStart(3, '0')}`,
              date: s(item.date) ? d(item.date) : undefined,
              description: s(item.description) || '',
              nominal: n(item.nominal, 0),
              hasNota: s(item.hasNota) || null,
              remark: s(item.remark) || null,
            };
          }).filter((item) => item.description),
        },
      },
      create: {
        id: row.id,
        projectId: row.projectId || s(payload.projectId),
        client: s(payload.client),
        projectName: s(payload.project || payload.projectName),
        location: s(payload.location),
        date: d(payload.date),
        noHal: s(payload.noHal) || row.id,
        revisi: s(payload.revisi),
        totalKas: n(payload.totalKas, 0),
        status: s(payload.status) || 'Draft',
        createdBy: s(payload.createdBy),
        legacyPayload: payload,
        items: {
          create: (Array.isArray(payload.items) ? payload.items : []).map((raw, index) => {
            const item = asRecord(raw);
            return {
              id: s(item.id) || `${row.id}-ITEM-${String(index + 1).padStart(3, '0')}`,
              date: s(item.date) ? d(item.date) : undefined,
              description: s(item.description) || '',
              nominal: n(item.nominal, 0),
              hasNota: s(item.hasNota) || null,
              remark: s(item.remark) || null,
            };
          }).filter((item) => item.description),
        },
      },
    });
  }
  return rows.length;
}

async function backfillPettyCash() {
  const rows = await prisma.financePettyCashTransactionRecord.findMany();
  for (const row of rows) {
    const payload = asRecord(row.payload);
    const meta = parsePettySource(payload.source);
    await prisma.financePettyCashTransaction.upsert({
      where: { id: row.id },
      update: {
        projectId: row.projectId || s(payload.projectId) || null,
        employeeId: row.employeeId || s(payload.employeeId) || null,
        date: d(payload.date),
        ref: s(payload.ref) || null,
        description: s(payload.description) || row.id,
        amount: n(payload.amount, 0),
        accountCode: meta.accountCode,
        direction: meta.direction,
        projectName: s(payload.project) || null,
        adminName: s(payload.admin) || null,
        transactionType: s(payload.type) || 'PETTY',
        sourceKind: meta.kind,
        legacyPayload: payload,
      },
      create: {
        id: row.id,
        projectId: row.projectId || s(payload.projectId),
        employeeId: row.employeeId || s(payload.employeeId),
        date: d(payload.date),
        ref: s(payload.ref),
        description: s(payload.description) || row.id,
        amount: n(payload.amount, 0),
        accountCode: meta.accountCode,
        direction: meta.direction,
        projectName: s(payload.project),
        adminName: s(payload.admin),
        transactionType: s(payload.type) || 'PETTY',
        sourceKind: meta.kind,
        legacyPayload: payload,
      },
    });
  }
  return rows.length;
}

async function backfillBankRecon() {
  const rows = await prisma.financeBankReconciliationRecord.findMany();
  for (const row of rows) {
    const payload = asRecord(row.payload);
    await prisma.financeBankReconciliation.upsert({
      where: { id: row.id },
      update: {
        projectId: row.projectId || s(payload.projectId) || null,
        customerInvoiceId: s(payload.customerInvoiceId || payload.invoiceId) || null,
        vendorInvoiceId: row.vendorInvoiceId || s(payload.vendorInvoiceId) || null,
        date: d(payload.date),
        periodLabel: s(payload.periodLabel) || null,
        account: s(payload.account) || null,
        description: s(payload.description) || null,
        debit: n(payload.debit, 0),
        credit: n(payload.credit, 0),
        balance: n(payload.balance, 0),
        status: s(payload.status) || 'Unmatched',
        matchedId: s(payload.matchedId) || null,
        note: s(payload.note) || null,
        legacyPayload: payload,
      },
      create: {
        id: row.id,
        projectId: row.projectId || s(payload.projectId),
        customerInvoiceId: s(payload.customerInvoiceId || payload.invoiceId),
        vendorInvoiceId: row.vendorInvoiceId || s(payload.vendorInvoiceId),
        date: d(payload.date),
        periodLabel: s(payload.periodLabel),
        account: s(payload.account),
        description: s(payload.description),
        debit: n(payload.debit, 0),
        credit: n(payload.credit, 0),
        balance: n(payload.balance, 0),
        status: s(payload.status) || 'Unmatched',
        matchedId: s(payload.matchedId),
        note: s(payload.note),
        legacyPayload: payload,
      },
    });
  }
  return rows.length;
}

async function backfillKasbon() {
  const rows = await prisma.kasbonRecord.findMany();
  for (const row of rows) {
    const payload = asRecord(row.payload);
    await prisma.hrKasbon.upsert({
      where: { id: row.id },
      update: {
        employeeId: row.employeeId || s(payload.employeeId) || null,
        projectId: row.projectId || s(payload.projectId) || null,
        employeeName: s(payload.employeeName) || null,
        date: d(payload.date),
        amount: n(payload.amount, 0),
        status: s(payload.status) || 'Pending',
        approved: Boolean(payload.approved),
        createdBy: s(payload.createdBy) || null,
        legacyPayload: payload,
      },
      create: {
        id: row.id,
        employeeId: row.employeeId || s(payload.employeeId),
        projectId: row.projectId || s(payload.projectId),
        employeeName: s(payload.employeeName),
        date: d(payload.date),
        amount: n(payload.amount, 0),
        status: s(payload.status) || 'Pending',
        approved: Boolean(payload.approved),
        createdBy: s(payload.createdBy),
        legacyPayload: payload,
      },
    });
  }
  return rows.length;
}

async function main() {
  const [workingExpenseSheets, pettyCashTransactions, bankReconciliations, kasbons] = await Promise.all([
    backfillWorkingExpense(),
    backfillPettyCash(),
    backfillBankRecon(),
    backfillKasbon(),
  ]);
  console.log(JSON.stringify({ workingExpenseSheets, pettyCashTransactions, bankReconciliations, kasbons }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
