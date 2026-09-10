const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/routes/inventory.ts', 'utf8');
const helpers = source.slice(source.indexOf('async function findInventoryItemByCodeOrName('), source.indexOf('async function reverseStockOutInventory('));
class KnownError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function load(prisma) {
  const context = { prisma, Prisma: { PrismaClientKnownRequestError: KnownError, TransactionIsolationLevel: { Serializable: 'Serializable' } } };
  vm.runInNewContext(ts.transpileModule(helpers, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + '\nthis.api = { inventoryTransaction, findInventoryItemByCodeOrName };', context);
  return context.api;
}

test('stock transactions request Serializable and retry the entire callback', async () => {
  let attempts = 0;
  let reads = 0;
  const api = load({ $transaction: async (work, options) => {
    assert.equal(options.isolationLevel, 'Serializable');
    const result = await work({ quantity: ++attempts });
    if (attempts < 3) throw new KnownError('P2034');
    return result;
  } });
  assert.equal(await api.inventoryTransaction(async (tx) => { reads++; return tx.quantity; }), 3);
  assert.equal(reads, 3);
});

test('conflict retries stop after three attempts', async () => {
  let attempts = 0;
  const api = load({ $transaction: async () => { attempts++; throw new KnownError('P2034'); } });
  await assert.rejects(api.inventoryTransaction(async () => {}), { code: 'P2034' });
  assert.equal(attempts, 3);
});

test('audit and other non-conflict errors are propagated without retry', async () => {
  let attempts = 0;
  const failure = new Error('audit failed');
  const api = load({ $transaction: async (work) => { attempts++; return work({}); } });
  await assert.rejects(api.inventoryTransaction(async () => { throw failure; }), (error) => error === failure);
  assert.equal(attempts, 1);
});

test('stock-in lookup reads current transaction state for repeated material rows', async () => {
  const api = load({ inventoryItem: { findUnique: () => { throw new Error('outside transaction'); } } });
  const row = { id: 'test-item', onHandQty: 10 };
  const tx = { inventoryItem: { findUnique: async () => ({ ...row }) } };
  row.onHandQty = (await api.findInventoryItemByCodeOrName(tx, 'MAT', '')).onHandQty + 2;
  row.onHandQty = (await api.findInventoryItemByCodeOrName(tx, 'MAT', '')).onHandQty + 3;
  assert.equal(row.onHandQty, 15);
});
