import assert from "node:assert/strict";
import test from "node:test";
import {
  asRecord,
  asTrimmedString,
  customerNameFromPayload,
  inventoryDateString,
  projectNameFromPayload,
  toDedicatedContractPayload,
  toEntityRow,
  toFiniteNumber,
  toPayloadRows,
  vendorNameFromPayload,
  workOrderNumberFromPayload,
} from "./dataPayloadUtils";

test("asRecord returns object input and falls back for non-object input", () => {
  assert.deepEqual(asRecord({ id: "1" }), { id: "1" });
  assert.deepEqual(asRecord(null), {});
  assert.deepEqual(asRecord(["x"]), {});
});

test("toFiniteNumber handles number, numeric string, and fallback", () => {
  assert.equal(toFiniteNumber(12.5, 0), 12.5);
  assert.equal(toFiniteNumber("42", 0), 42);
  assert.equal(toFiniteNumber("abc", 7), 7);
});

test("asTrimmedString trims values and returns null for blank/non-string", () => {
  assert.equal(asTrimmedString("  hello "), "hello");
  assert.equal(asTrimmedString("   "), null);
  assert.equal(asTrimmedString(123), null);
});

test("inventoryDateString normalizes date-like values", () => {
  assert.equal(inventoryDateString("2026-03-31T10:22:00.000Z"), "2026-03-31");
  assert.equal(inventoryDateString(new Date("2026-03-31T10:22:00.000Z")), "2026-03-31");
  assert.equal(inventoryDateString("not-a-date"), "not-a-date");
});

test("payload name helpers resolve legacy aliases", () => {
  assert.equal(projectNameFromPayload({ payload: { namaProject: "Project A" } }), "Project A");
  assert.equal(vendorNameFromPayload({ payload: { vendorName: "Vendor A" } }), "Vendor A");
  assert.equal(customerNameFromPayload({ payload: { customerName: "Customer A" } }), "Customer A");
  assert.equal(workOrderNumberFromPayload({ payload: { woNumber: "WO-001" } }), "WO-001");
});

test("toPayloadRows and toEntityRow preserve row structure", () => {
  const createdAt = new Date("2026-03-31T00:00:00.000Z");
  const updatedAt = new Date("2026-03-31T01:00:00.000Z");
  const entityRow = toEntityRow("ent-1", { status: "Draft" }, createdAt, updatedAt);
  const rows = toPayloadRows([{ id: "ent-1", payload: { status: "Draft" }, createdAt, updatedAt }]);

  assert.equal(entityRow.entityId, "ent-1");
  assert.deepEqual(entityRow.payload, { status: "Draft" });
  assert.equal(rows[0]?.entityId, "ent-1");
  assert.deepEqual(rows[0]?.payload, { status: "Draft" });
});

test("toDedicatedContractPayload injects entity id when payload id is missing", () => {
  assert.deepEqual(
    toDedicatedContractPayload({ entityId: "dc-1", payload: { name: "Contract" } }),
    { id: "dc-1", name: "Contract" },
  );
  assert.equal(toDedicatedContractPayload(null), null);
});
