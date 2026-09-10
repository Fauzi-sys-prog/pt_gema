const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function fixture(kind, failAudit = false) {
  const state = { invoice: { id: 'test', totalAmount: 100, paidAmount: 0 }, payments: [], audits: [] };
  const events = [];
  const prisma = { async $transaction(fn) {
    const draft = structuredClone(state);
    const tx = {
      async $executeRaw() { events.push('advisory'); },
      async $queryRaw() { events.push('row-lock'); return [{ id: 'test' }]; },
      auditLogEntry: { async create({ data }) {
        if (failAudit) throw Object.assign(new Error('audit failure'), { code: 'P2002' });
        draft.audits.push(data);
      } },
    };
    tx[kind === 'customer' ? 'financeCustomerInvoice' : 'financeVendorInvoice'] = {
      async findUnique() { events.push('read'); return draft.invoice; },
      async update({ data }) { Object.assign(draft.invoice, data); return draft.invoice; },
    };
    tx[kind === 'customer' ? 'financeCustomerInvoicePayment' : 'financeVendorInvoicePayment'] = {
      async findFirst({ where }) { return draft.payments.find(p => Object.entries(where).every(([k,v]) => p[k] === v)); },
      async create({ data }) { draft.payments.push(data); },
    };
    const result = await fn(tx);
    Object.assign(state, draft);
    return result;
  } };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync('/app/dist/services/financePaymentService.js', 'utf8'), {
    exports: module.exports, module,
    require: name => name === '../prisma' ? { prisma } : require(name),
    Date, Number, Error,
  });
  const call = kind === 'customer' ? module.exports.receiveCustomerInvoicePayment : module.exports.payVendorInvoice;
  const pay = nominal => call('test', { nominal, proofNo: 'proof', noBukti: 'proof' });
  return { state, events, pay };
}

for (const kind of ['customer', 'vendor']) {
  test(`${kind}: lock before balance read; same proof posts once`, async () => {
    const f = fixture(kind);
    await f.pay(40); await f.pay(40);
    assert.deepEqual(f.events.slice(0, 3), ['advisory', 'row-lock', 'read']);
    assert.equal(f.state.invoice.paidAmount, 40);
    assert.equal(f.state.payments.length, 1);
    assert.equal(f.state.audits.length, 1);
  });
  test(`${kind}: changed amount for same proof rejected`, async () => {
    const f = fixture(kind);
    await f.pay(40);
    await assert.rejects(f.pay(50), /nominal berbeda/);
    assert.equal(f.state.invoice.paidAmount, 40);
  });
  test(`${kind}: audit unique error is not reported as successful payment`, async () => {
    const f = fixture(kind, true);
    await assert.rejects(f.pay(40), /audit failure/);
    assert.equal(f.state.invoice.paidAmount, 0);
    assert.equal(f.state.payments.length, 0);
  });
  test(`${kind}: overpayment rejected`, async () => {
    const f = fixture(kind);
    await assert.rejects(f.pay(101), /melebihi/);
    assert.equal(f.state.payments.length, 0);
  });
}
