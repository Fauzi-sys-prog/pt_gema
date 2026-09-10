const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, 'test-db');
assert.equal(target.pathname, '/payment_test');
assert.equal(process.env.NODE_ENV, 'test');
const { prisma } = require('../dist/prisma');
const { receiveCustomerInvoicePayment, payVendorInvoice } = require('../dist/services/financePaymentService');
before(async () => {
  assert.equal((await prisma.$queryRawUnsafe('SELECT current_database() AS name'))[0].name, 'payment_test');
  await prisma.$executeRawUnsafe(`CREATE FUNCTION test_payment_delay() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.2); RETURN NEW; END $$`);
  for (const table of ['FinanceCustomerInvoice', 'FinanceVendorInvoice']) {
    await prisma.$executeRawUnsafe(`CREATE TRIGGER test_payment_delay BEFORE UPDATE ON "${table}" FOR EACH ROW EXECUTE FUNCTION test_payment_delay()`);
  }
  await prisma.$executeRawUnsafe(`CREATE FUNCTION test_payment_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityId" LIKE 'rollback-%' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER test_payment_audit_failure BEFORE INSERT ON "AuditLogEntry" FOR EACH ROW EXECUTE FUNCTION test_payment_audit_failure()`);
});
after(async () => prisma.$disconnect());
for (const kind of ['customer', 'vendor']) {
  const invoice = () => kind === 'customer' ? prisma.financeCustomerInvoice : prisma.financeVendorInvoice;
  const payments = () => kind === 'customer' ? prisma.financeCustomerInvoicePayment : prisma.financeVendorInvoicePayment;
  const paymentWhere = id => kind === 'customer' ? { invoiceId: id } : { vendorInvoiceId: id };
  const pay = (id, nominal, proof) => kind === 'customer'
    ? receiveCustomerInvoicePayment(id, { nominal, proofNo: proof })
    : payVendorInvoice(id, { nominal, noBukti: proof });
  async function seed(id) {
    await invoice().create({ data: { id, number: id, tanggal: new Date(), totalAmount: 100, paidAmount: 0, outstandingAmount: 100, status: 'Unpaid', ...(kind === 'customer' ? { customerName: 'Dummy Customer' } : { supplierName: 'Dummy Vendor' }) } });
  }
  async function check(id, paid, count) {
    const row = await invoice().findUniqueOrThrow({ where: { id } });
    assert.equal(row.paidAmount, paid);
    assert.equal(row.outstandingAmount, 100 - paid);
    assert.equal(await payments().count({ where: paymentWhere(id) }), count);
    assert.equal(await prisma.auditLogEntry.count({ where: { entityId: id } }), count);
  }
  test(`${kind}: concurrent same-proof payments post only once, including replay after Paid`, async () => {
    const id = `${kind}-duplicate`;
    await seed(id);
    const results = await Promise.all([pay(id, 100, 'SAME'), pay(id, 100, 'SAME')]);
    assert.ok(results.every(row => row.status === 'Paid'));
    await pay(id, 100, 'SAME');
    await check(id, 100, 1);
  });
  test(`${kind}: concurrent distinct payments preserve both amounts`, async () => {
    const id = `${kind}-sum`;
    await seed(id);
    await Promise.all([pay(id, 30, 'FIRST'), pay(id, 40, 'SECOND')]);
    await check(id, 70, 2);
  });
  test(`${kind}: concurrent payments cannot exceed invoice total`, async () => {
    const id = `${kind}-overpay`;
    await seed(id);
    const results = await Promise.allSettled([pay(id, 60, 'FIRST'), pay(id, 60, 'SECOND')]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.match(results.find(result => result.status === 'rejected').reason.message, /melebihi/);
    await check(id, 60, 1);
  });
  test(`${kind}: concurrent same proof with different amounts rejects one`, async () => {
    const id = `${kind}-mismatch`;
    await seed(id);
    const results = await Promise.allSettled([pay(id, 30, 'SAME'), pay(id, 40, 'SAME')]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.match(results.find(result => result.status === 'rejected').reason.message, /nominal berbeda/);
    await check(id, results.find(result => result.status === 'fulfilled').value.paidAmount, 1);
  });
  test(`${kind}: actual audit insert failure rolls back payment and invoice`, async () => {
    const id = `rollback-${kind}`;
    await seed(id);
    await assert.rejects(pay(id, 40, 'FAIL'), /injected audit failure/);
    await check(id, 0, 0);
    assert.equal((await invoice().findUniqueOrThrow({ where: { id } })).status, 'Unpaid');
  });
}
