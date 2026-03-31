import assert from "node:assert/strict";
import test from "node:test";
import {
  PayloadValidationError,
  assertNoUnknownKeys,
  assertStatusInList,
} from "./dataValidationUtils";

test("assertNoUnknownKeys passes when all keys are allowed", () => {
  assert.doesNotThrow(() =>
    assertNoUnknownKeys({ id: "1", status: "Draft" }, ["id", "status"], "ctx"),
  );
});

test("assertNoUnknownKeys throws descriptive error for unknown fields", () => {
  assert.throws(
    () => assertNoUnknownKeys({ id: "1", rogue: true }, ["id"], "customer"),
    (error) =>
      error instanceof PayloadValidationError &&
      error.message.includes("customer: field tidak dikenal -> rogue"),
  );
});

test("assertStatusInList returns null for empty status", () => {
  assert.equal(assertStatusInList(null, ["A", "B"], "ctx"), null);
});

test("assertStatusInList returns matched status", () => {
  assert.equal(assertStatusInList("Approved", ["Approved", "Rejected"], "ctx"), "Approved");
});

test("assertStatusInList throws for invalid status", () => {
  assert.throws(
    () => assertStatusInList("Broken", ["Approved", "Rejected"], "purchase-orders"),
    (error) =>
      error instanceof PayloadValidationError &&
      error.message.includes("purchase-orders: status 'Broken' tidak valid"),
  );
});
