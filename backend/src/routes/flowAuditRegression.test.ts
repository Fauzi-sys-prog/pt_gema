import test from "node:test";
import assert from "node:assert/strict";
import { validateStockIn } from "./inventory";
import { validateReceiving } from "./procurement";
import { buildPendingPurchaseOrders } from "./dashboardFinanceApprovalHelpers";

const receiving = { id: "R1", status: "Partial", suratJalanNo: "SJ1", warehouseLocation: "Workshop", items: [{ itemCode: "A", qtyGood: 2 }] };
function inventoryDb(duplicate: unknown = null) {
  return { procurementReceiving: { findUnique: async () => receiving }, inventoryStockIn: { findFirst: async () => duplicate } } as any;
}
const stock = () => ({ type: "Receiving", receivingId: "R1", items: [{ kode: "A", qty: 2 }] });
test("stock rejects empty and zero-quantity postings", async () => {
  await assert.rejects(validateStockIn(inventoryDb(), { items: [] }, "S1"));
  await assert.rejects(validateStockIn(inventoryDb(), { items: [{ kode: "A", qty: 0 }] }, "S1"));
});
test("stock rejects duplicate receiving and excessive or partial quantities", async () => {
  await assert.rejects(validateStockIn(inventoryDb({ id: "S0" }), stock(), "S1"), /diposting ulang/);
  for (const qty of [1, 3]) await assert.rejects(validateStockIn(inventoryDb(), { ...stock(), items: [{ kode: "A", qty }] }, "S1"));
});
test("stock accepts exactly good quantity and derives warehouse from receipt", async () => {
  const payload: any = stock();
  await validateStockIn(inventoryDb(), payload, "S1");
  assert.equal(payload.warehouseLocation, "Workshop");
});
function procurementDb() {
  return { $queryRaw: async () => [], procurementPurchaseOrder: { findUnique: async () => ({ status: "Partial", items: [{ id: "P1", itemCode: "A", itemName: "Material", qty: 10, unit: "Sack" }] }) }, procurementReceiving: { findMany: async () => [{ items: [{ itemCode: "A", itemName: "Material", qtyReceived: 8 }] }] } } as any;
}
test("receiving rejects quantities above authoritative remainder", async () => {
  await assert.rejects(validateReceiving({ poId: "PO", items: [{ itemKode: "A", qtyReceived: 3 }] }, procurementDb(), "R2"));
});
test("receiving derives good quantity and status instead of trusting form", async () => {
  const payload: any = { poId: "PO", items: [{ itemKode: "A", qtyReceived: 2, qtyDamaged: 1, qtyGood: 999 }] };
  await validateReceiving(payload, procurementDb(), "R2");
  assert.equal(payload.items[0].qtyGood, 1);
  assert.equal(payload.items[0].qtyPreviouslyReceived, 8);
  assert.equal(payload.status, "Complete");
});
test("Pending PO enters approval queue with approve action", () => {
  const rows = buildPendingPurchaseOrders([{ entityId: "P", payload: { id: "P", status: "Pending", total: 200000 }, updatedAt: new Date() }] as any, "OWNER");
  assert.equal(rows.length, 1);
  assert.ok(rows[0].availableActions.includes("APPROVE"));
});
