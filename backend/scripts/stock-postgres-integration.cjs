const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
// Never allow this destructive fixture suite to use an application database.
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, 'test-db');
assert.equal(target.pathname, '/stock_test');
assert.equal(process.env.NODE_ENV, 'test');
const express = require('express');
const { prisma } = require('../dist/prisma');
const { inventoryRouter } = require('../dist/routes/inventory');
const { signAccessToken } = require('../dist/utils/token');
let server, base, token;
before(async () => {
  assert.equal((await prisma.$queryRawUnsafe('SELECT current_database() AS name'))[0].name, 'stock_test');
  const user = await prisma.user.create({ data: { id: 'test-owner', email: 'owner@test.invalid', username: 'test-owner', password: 'unused-test-only', role: 'OWNER' } });
  token = signAccessToken(user);
  // Force overlapping read/modify/write transactions using a real DB trigger.
  await prisma.$executeRawUnsafe(`CREATE FUNCTION test_stock_delay() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.15); RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER test_stock_delay BEFORE UPDATE ON "InventoryItem" FOR EACH ROW EXECUTE FUNCTION test_stock_delay()`);
  await prisma.$executeRawUnsafe(`CREATE FUNCTION test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityId" LIKE 'rollback-%' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER test_audit_failure BEFORE INSERT ON "AuditLogEntry" FOR EACH ROW EXECUTE FUNCTION test_audit_failure()`);
  const app = express();
  app.use(express.json());
  app.use(inventoryRouter);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); });
async function request(path, method = 'GET', body) {
  const result = await fetch(base + '/inventory/' + path, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: result.status, body: await result.json() };
}
async function item(id, qty = 10) {
  return prisma.inventoryItem.create({ data: { id, code: id, name: id, category: 'Test', unit: 'pcs', location: 'Test', onHandQty: qty, metadata: { stok: 999 } } });
}
const stockBody = (id, code, qty) => ({ id, noStockIn: id, noStockOut: id, tanggal: '2026-09-03', type: 'Adjustment', status: 'Posted', items: [{ kode: code, nama: code, qty, satuan: 'pcs' }] });
const balance = async id => (await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).onHandQty;

test('overlapping stock-outs cannot overspend: one succeeds, balance=3', async () => {
  await item('out-item');
  const results = await Promise.all(['out-a', 'out-b'].map(id => request('stock-outs', 'POST', stockBody(id, 'out-item', 7))));
  assert.deepEqual(results.map(r => r.status).sort(), [201, 400], JSON.stringify(results));
  assert.equal(await balance('out-item'), 3);
  assert.equal(await prisma.inventoryStockMovement.count({ where: { inventoryItemId: 'out-item' } }), 1);
  assert.equal(await prisma.inventoryStockOut.count({ where: { id: { in: ['out-a', 'out-b'] } } }), 1);
});
test('overlapping stock-ins preserve both increments: balance=22', async () => {
  await item('in-item');
  const results = await Promise.all([5, 7].map(qty => request('stock-ins', 'POST', stockBody(`in-${qty}`, 'in-item', qty))));
  assert.deepEqual(results.map(r => r.status), [201, 201], JSON.stringify(results));
  assert.equal(await balance('in-item'), 22);
  const movements = await prisma.inventoryStockMovement.findMany({ where: { inventoryItemId: 'in-item' }, orderBy: { stockBefore: 'asc' } });
  assert.equal(movements.length, 2);
  assert.equal(movements[0].stockBefore, 10);
  assert.equal(movements[0].stockAfter, movements[1].stockBefore);
  assert.equal(movements[1].stockAfter, 22);
  assert.equal((await request('items/in-item')).body.stok, 22);
});
test('repeated material rows in one stock-in accumulate', async () => {
  await item('repeat-item');
  const body = stockBody('repeat-in', 'repeat-item', 2);
  body.items.push({ ...body.items[0], qty: 3 });
  assert.equal((await request('stock-ins', 'POST', body)).status, 201);
  assert.equal(await balance('repeat-item'), 15);
});
test('two manual edits with the same version: one succeeds, one conflicts', async () => {
  await item('manual-item');
  const version = (await request('items/manual-item')).body.updatedAt;
  const results = await Promise.all([8, 9].map(stok => request('items/manual-item', 'PATCH', { updatedAt: version, stok })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409], JSON.stringify(results));
  const success = results.find(r => r.status === 200);
  assert.equal(await balance('manual-item'), success.body.stok);
  assert.equal(await prisma.auditLogEntry.count({ where: { entityId: 'manual-item' } }), 1);
});
test('old version after a stock transaction is rejected', async () => {
  await item('stale-item');
  const version = (await request('items/stale-item')).body.updatedAt;
  assert.equal((await request('stock-ins', 'POST', stockBody('stale-in', 'stale-item', 4))).status, 201);
  assert.equal((await request('items/stale-item', 'PATCH', { updatedAt: version, stok: 1 })).status, 409);
  assert.equal(await balance('stale-item'), 14);
});
test('actual audit insert failure rolls back stock-in, rows, movement, balance', async () => {
  await item('rollback-in-item');
  assert.equal((await request('stock-ins', 'POST', stockBody('rollback-in', 'rollback-in-item', 4))).status, 500);
  assert.equal(await balance('rollback-in-item'), 10);
  assert.equal(await prisma.inventoryStockIn.count({ where: { id: 'rollback-in' } }), 0);
  assert.equal(await prisma.inventoryStockMovement.count({ where: { stockInId: 'rollback-in' } }), 0);
  assert.equal(await prisma.inventoryStockInItem.count({ where: { stockInId: 'rollback-in' } }), 0);
});
test('actual audit insert failure rolls back manual edit', async () => {
  await item('rollback-manual');
  const version = (await request('items/rollback-manual')).body.updatedAt;
  assert.equal((await request('items/rollback-manual', 'PATCH', { updatedAt: version, stok: 4 })).status, 500);
  assert.equal(await balance('rollback-manual'), 10);
});
test('actual audit insert failure rolls back opname confirmation', async () => {
  await item('opname-item');
  await prisma.inventoryStockOpname.create({ data: { id: 'rollback-opname', number: 'rollback-opname', tanggal: new Date(), location: 'Test', status: 'Draft', items: { create: { id: 'opname-line', inventoryItemId: 'opname-item', itemCode: 'opname-item', itemName: 'opname-item', systemQty: 10, physicalQty: 6, differenceQty: -4 } } } });
  assert.equal((await request('stock-opnames/rollback-opname/confirm', 'POST', {})).status, 500);
  assert.equal(await balance('opname-item'), 10);
  assert.equal((await prisma.inventoryStockOpname.findUnique({ where: { id: 'rollback-opname' } })).status, 'Draft');
  assert.equal(await prisma.inventoryStockMovement.count({ where: { stockOpnameId: 'rollback-opname' } }), 0);
});
