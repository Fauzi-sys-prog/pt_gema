import assert from "node:assert/strict";
import test from "node:test";
import {
  mapCustomerToDedicatedPayload,
  mapFleetHealthEntryToDedicatedPayload,
  mapVendorToDedicatedPayload,
  productionTrackerIdFromWorkOrderId,
} from "./dataRelationHelpers";

test("productionTrackerIdFromWorkOrderId prefixes work order ids", () => {
  assert.equal(productionTrackerIdFromWorkOrderId("wo-123"), "TRK-wo-123");
});

test("mapFleetHealthEntryToDedicatedPayload computes total cost and project name", () => {
  const payload = mapFleetHealthEntryToDedicatedPayload({
    id: "fh-1",
    assetId: "asset-1",
    projectId: "proj-1",
    tanggal: new Date("2026-03-31T10:00:00.000Z"),
    equipmentName: "Excavator",
    hoursUsed: 8,
    operatorName: "Budi",
    fuelConsumption: 20,
    costPerHour: 150000,
    status: "Operational",
    notes: "OK",
    asset: { assetCode: "EX-001" },
    project: { payload: { projectName: "Project A" } },
  });

  assert.equal(payload.assetCode, "EX-001");
  assert.equal(payload.projectName, "Project A");
  assert.equal(payload.totalCost, 1200000);
  assert.equal(payload.date, "2026-03-31");
});

test("mapVendorToDedicatedPayload applies defaults for nullable fields", () => {
  const payload = mapVendorToDedicatedPayload({
    id: "vendor-1",
    kodeVendor: "V-001",
    namaVendor: "Vendor A",
    kategori: null,
    alamat: null,
    kota: null,
    kontak: null,
    telepon: null,
    email: null,
    npwp: null,
    paymentTerms: null,
    rating: null,
    status: null,
    createdAt: new Date("2026-03-31T10:00:00.000Z"),
  });

  assert.equal(payload.status, "Active");
  assert.equal(payload.rating, 0);
  assert.equal(payload.kategori, "");
  assert.equal(payload.createdAt, "2026-03-31T10:00:00.000Z");
});

test("mapCustomerToDedicatedPayload applies defaults for nullable fields", () => {
  const payload = mapCustomerToDedicatedPayload({
    id: "customer-1",
    kodeCustomer: "C-001",
    namaCustomer: "Customer A",
    alamat: null,
    kota: null,
    kontak: null,
    telepon: null,
    email: null,
    npwp: null,
    paymentTerms: null,
    rating: null,
    status: null,
    createdAt: new Date("2026-03-31T10:00:00.000Z"),
  });

  assert.equal(payload.status, "Active");
  assert.equal(payload.rating, 0);
  assert.equal(payload.namaCustomer, "Customer A");
  assert.equal(payload.createdAt, "2026-03-31T10:00:00.000Z");
});
