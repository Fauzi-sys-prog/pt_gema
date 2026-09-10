const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function fixture(failCash = false) {
  let state = { loan: { id: 'loan', memberName: 'Test', amount: 100, installmentAmount: 50, installmentCount: 2, paidInstallments: 0, status: 'Active', requestDate: new Date() }, cash: [] };
  let queue = Promise.resolve();
  const prisma = { $transaction(fn) {
    const task = queue.then(async () => {
      const draft = structuredClone(state);
      const result = await fn({
        $executeRaw: async () => 1,
        $queryRaw: async () => [{ id: 'loan' }],
        koperasiPinjaman: {
          findUnique: async () => draft.loan,
          update: async ({ data }) => Object.assign(draft.loan, data),
        },
        koperasiCashTransaction: {
          findUnique: async ({ where }) => draft.cash.find(row => row.id === where.id),
          createMany: async ({ data }) => {
            if (failCash) throw new Error('cash failure');
            draft.cash.push(...data);
          },
        },
      });
      state = draft;
      return result;
    });
    queue = task.catch(() => {});
    return task;
  } };
  const routes = new Map();
  const router = Object.fromEntries(['get', 'post', 'patch'].map(method => [method, (path, ...handlers) => routes.set(`${method}:${path}`, handlers.at(-1))]));
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync('/app/dist/routes/koperasi.js', 'utf8'), {
    module, exports: module.exports, Date, Error,
    require: name => {
      if (name === 'express') return { Router: () => router };
      if (name === '../prisma') return { prisma };
      if (name === '../middlewares/auth') return { authenticate() {} };
      if (name === '../utils/roles') return { hasRoleAccess: () => true };
      if (name === '../utils/http') return { sendError: (res, status, body) => res.status(status).json(body) };
      if (name === '../schemas/koperasi') return {};
      return require(name);
    },
  });
  async function post(number) {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await routes.get('post:/koperasi/pinjaman/:id/installments')({ user: { id: 'test', role: 'OWNER' }, params: { id: 'loan' }, body: number === undefined ? {} : { installmentNumber: number } }, res);
    return res;
  }
  return { post, state: () => state };
}

test('parallel same-number requests post once (serialized transaction mock)', async () => {
  const f = fixture();
  const results = await Promise.all([f.post(1), f.post(1)]);
  assert.deepEqual(results.map(r => r.code), [200, 200]);
  assert.equal(f.state().loan.paidInstallments, 1);
  assert.equal(f.state().cash.length, 1);
});
test('replay after settlement does not add another installment', async () => {
  const f = fixture();
  await f.post(1); await f.post(2);
  assert.equal((await f.post(2)).code, 200);
  assert.equal(f.state().loan.status, 'Settled');
  assert.equal(f.state().cash.length, 2);
});
test('missing and out-of-order installment numbers rejected', async () => {
  const f = fixture();
  assert.equal((await f.post()).code, 400);
  assert.equal((await f.post(2)).code, 409);
  assert.equal(f.state().cash.length, 0);
});
test('cash failure leaves loan unchanged in transaction mock', async () => {
  const f = fixture(true);
  assert.notEqual((await f.post(1)).code, 200);
  assert.equal(f.state().loan.paidInstallments, 0);
});
