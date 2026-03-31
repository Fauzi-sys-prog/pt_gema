import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../prisma";
import {
  ensureStockItemSkuOnCreate,
  sanitizeWorkOrderPayload,
} from "./dataWorkOrderHelpers";
import { PayloadValidationError } from "./dataValidationUtils";

type StockItemFindManyRow = { payload: unknown };

function mockStockItemFindMany(rows: StockItemFindManyRow[]) {
  const delegate = prisma.stockItemRecord as unknown as {
    findMany: (args?: unknown) => Promise<StockItemFindManyRow[]>;
  };
  const original = delegate.findMany;
  delegate.findMany = async () => rows;
  return () => {
    delegate.findMany = original;
  };
}

test("ensureStockItemSkuOnCreate generates next sequential SKU", async () => {
  const restore = mockStockItemFindMany([
    { payload: { kode: "GTP-MTR-POM-001" } },
    { payload: { kode: "GTP-MTR-POM-004" } },
  ]);

  try {
    const payload = await ensureStockItemSkuOnCreate({ nama: "Pompa Air" });
    assert.equal(payload.kode, "GTP-MTR-POM-005");
  } finally {
    restore();
  }
});

test("ensureStockItemSkuOnCreate rejects duplicate requested SKU", async () => {
  const restore = mockStockItemFindMany([{ payload: { kode: "SKU-001" } }]);

  try {
    await assert.rejects(
      () => ensureStockItemSkuOnCreate({ nama: "Pompa Air", kode: "SKU-001" }),
      (error) =>
        error instanceof PayloadValidationError &&
        error.message.includes("kode SKU 'SKU-001' sudah dipakai"),
    );
  } finally {
    restore();
  }
});

test("sanitizeWorkOrderPayload normalizes BOM and filters non-material rows", async () => {
  const restore = mockStockItemFindMany([
    { payload: { kode: "SKU-001", nama: "Bearing", satuan: "pcs", stok: 12 } },
    { payload: { kode: "SKU-002", nama: "Bolt", satuan: "set", stok: 5 } },
  ]);

  try {
    const payload = await sanitizeWorkOrderPayload({
      bom: [
        { nama: "Mandor", qty: 2, unit: "orang" },
        { kode: "SKU-001", nama: "Bearing", qty: 3, unit: "pcs" },
        { materialName: "Bolt", qty: 4 },
        { nama: "Custom Part", qty: 1 },
        { nama: "Zero", qty: 0 },
      ],
    });

    assert.equal(Array.isArray(payload.bom), true);
    assert.equal((payload.bom as Array<unknown>).length, 3);

    const [knownByCode, knownByName, unknown] = payload.bom as Array<Record<string, unknown>>;
    assert.equal(knownByCode.kode, "SKU-001");
    assert.equal(knownByCode.needsProcurement, false);
    assert.equal(knownByCode.stockAvailable, 12);

    assert.equal(knownByName.kode, "SKU-002");
    assert.equal(knownByName.nama, "Bolt");
    assert.equal(knownByName.unit, "set");
    assert.equal(knownByName.needsProcurement, false);

    assert.equal(unknown.nama, "Custom Part");
    assert.equal(unknown.needsProcurement, true);
    assert.equal(unknown.stockAvailable, 0);
  } finally {
    restore();
  }
});

test("sanitizeWorkOrderPayload returns empty BOM when input BOM is empty", async () => {
  const restore = mockStockItemFindMany([]);

  try {
    const payload = await sanitizeWorkOrderPayload({ bom: [] }, { bom: [{ nama: "Old" }] });
    assert.deepEqual(payload.bom, []);
  } finally {
    restore();
  }
});
