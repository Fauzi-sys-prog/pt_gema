import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInvoiceItemCreateManyData,
  buildInvoiceRecordWriteData,
  mapInvoiceRecord,
  sanitizeInvoicePayload,
} from "./dataInvoiceHelpers";

test("sanitizeInvoicePayload computes totals and promotes paid status", () => {
  const payload = sanitizeInvoicePayload("inv-1", {
    noInvoice: "INV-1",
    customer: "PT Example",
    items: [
      { deskripsi: "Barang", qty: 2, hargaSatuan: 50000 },
      { deskripsi: "Jasa", qty: 1, hargaSatuan: 25000 },
    ],
    ppn: 10,
    paidAmount: 137500,
    status: "SENT",
  });

  assert.equal(payload.subtotal, 125000);
  assert.equal(payload.totalBayar, 137500);
  assert.equal(payload.outstandingAmount, 0);
  assert.equal(payload.status, "Paid");
});

test("mapInvoiceRecord exposes undefined instead of nullable optional fields", () => {
  const mapped = mapInvoiceRecord({
    id: "inv-1",
    projectId: null,
    customerId: null,
    noInvoice: "INV-1",
    tanggal: "2026-03-31",
    jatuhTempo: "2026-04-07",
    customer: "PT Example",
    customerName: null,
    alamat: "",
    noPO: "",
    subtotal: 1000,
    ppn: 0,
    totalBayar: 1000,
    paidAmount: 0,
    outstandingAmount: 1000,
    status: "Unpaid",
    projectName: null,
    noFakturPajak: null,
    perihal: null,
    termin: null,
    buktiTransfer: null,
    noKwitansi: null,
    tanggalBayar: null,
    items: [{ deskripsi: "Item", qty: 1, unit: "pcs", hargaSatuan: 1000, total: 1000, sourceRef: null, batchNo: null }],
  });

  assert.equal(mapped.projectId, undefined);
  assert.equal(mapped.customerId, undefined);
  assert.equal(mapped.customerName, "PT Example");
  assert.equal(mapped.items[0]?.sourceRef, undefined);
});

test("buildInvoiceRecordWriteData respects fallback customer id", () => {
  const writeData = buildInvoiceRecordWriteData(
    {
      id: "inv-1",
      projectId: null,
      customerId: null,
      noInvoice: "INV-1",
      tanggal: "2026-03-31",
      jatuhTempo: "2026-04-07",
      customer: "PT Example",
      customerName: null,
      alamat: "",
      noPO: "",
      subtotal: 1000,
      ppn: 0,
      totalBayar: 1000,
      paidAmount: 0,
      outstandingAmount: 1000,
      status: "Unpaid",
      projectName: null,
      noFakturPajak: null,
      perihal: null,
      termin: null,
      buktiTransfer: null,
      noKwitansi: null,
      tanggalBayar: null,
    },
    "cust-fallback",
  );

  assert.equal(writeData.customerId, "cust-fallback");
  assert.equal(writeData.noInvoice, "INV-1");
});

test("buildInvoiceItemCreateManyData creates deterministic item ids", () => {
  const items = buildInvoiceItemCreateManyData("inv-1", [
    {
      deskripsi: "Barang",
      qty: 2,
      unit: "pcs",
      hargaSatuan: 50000,
      total: 100000,
      sourceRef: "SJ-1",
      batchNo: "B1",
    },
  ]);

  assert.equal(items[0]?.id, "inv-1-item-1");
  assert.equal(items[0]?.invoiceId, "inv-1");
  assert.equal(items[0]?.sourceRef, "SJ-1");
});
