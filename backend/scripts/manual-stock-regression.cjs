const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/routes/inventory.ts', 'utf8');
const code = source.slice(source.indexOf('async function updateResource('), source.indexOf('async function deleteResource('));
function setup() {
  let row = { id: 'item', code: 'MAT', name: 'Material', onHandQty: 12, reservedQty: 2, onOrderQty: 3, status: 'Active', updatedAt: new Date('2026-09-03T00:00:00Z') };
  let writes = 0;
  const context = {
    asTrimmedString: value => typeof value === 'string' ? value.trim() : undefined,
    toFiniteNumber: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    mapInventoryItem: value => ({ kode: value.code, nama: value.name, stok: value.onHandQty, updatedAt: value.updatedAt.toISOString() }),
    getResource: async () => row,
    inventoryTransaction: async work => {
      let staged = { ...row };
      await work({ inventoryItem: {
        findUniqueOrThrow: async () => staged,
        updateMany: async ({ where, data }) => {
          writes++;
          assert.equal(where.updatedAt, staged.updatedAt);
          staged = { ...staged, ...data };
          return { count: 1 };
        },
      } });
      row = staged;
    },
  };
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + '\nthis.update = updateResource;', context);
  return { update: context.update, row: () => row, writes: () => writes };
}
test('missing or stale version cannot overwrite stock', async () => {
  for (const updatedAt of [undefined, '2026-09-02T00:00:00Z']) {
    const app = setup();
    await assert.rejects(app.update('stock-items', 'item', { updatedAt, stok: 1 }), /STOCK_VERSION_CONFLICT/);
    assert.equal(app.writes(), 0);
  }
});
test('metadata-only patch preserves current stock and reservation', async () => {
  const app = setup();
  await app.update('stock-items', 'item', { updatedAt: app.row().updatedAt.toISOString(), nama: 'New name' });
  assert.equal(app.row().onHandQty, 12);
  assert.equal(app.row().reservedQty, 2);
  assert.equal(app.row().name, 'New name');
});
test('negative stock is rejected before writing', async () => {
  const app = setup();
  await assert.rejects(app.update('stock-items', 'item', { updatedAt: app.row().updatedAt.toISOString(), stok: -1 }), /tidak valid/);
  assert.equal(app.writes(), 0);
});
test('audit failure rolls back manual edit in transaction mock', async () => {
  const app = setup();
  await assert.rejects(app.update('stock-items', 'item', { updatedAt: app.row().updatedAt.toISOString(), stok: 9 }, async () => { throw new Error('audit failure'); }), /audit failure/);
  assert.equal(app.row().onHandQty, 12);
});
