import assert from "node:assert/strict";
import test from "node:test";
import {
  sanitizeCustomerInvoicePayload,
  sanitizeMaterialRequestPayload,
  sanitizePurchaseOrderPayload,
  sanitizeReceivingPayload,
  sanitizeStockInPayload,
  sanitizeSuratJalanPayload,
  sanitizeVendorInvoicePayload,
} from "./dataTransactionSanitizers";
import { PayloadValidationError } from "./dataValidationUtils";

test("sanitizeCustomerInvoicePayload computes totals and paid status", () => {
  const payload = sanitizeCustomerInvoicePayload({
    noInvoice: "INV-001",
    customerId: "cust-1",
    items: [
      { deskripsi: "Pompa", qty: 2, hargaSatuan: 50000 },
      { deskripsi: "Jasa", qty: 1, hargaSatuan: 25000 },
    ],
    ppn: 8250,
    pph: 1250,
    paidAmount: 132000,
    status: "Sent",
  });

  assert.equal(payload.subtotal, 125000);
  assert.equal(payload.totalNominal, 132000);
  assert.equal(payload.outstandingAmount, 0);
  assert.equal(payload.status, "Paid");
});

test("sanitizeVendorInvoicePayload normalizes legacy approved invoice into partial state", () => {
  const payload = sanitizeVendorInvoicePayload({
    noInvoiceVendor: "VINV-001",
    supplier: "Vendor A",
    totalAmount: 100000,
    paidAmount: 40000,
    status: "APPROVED",
  });

  assert.equal(payload.totalAmount, 100000);
  assert.equal(payload.paidAmount, 40000);
  assert.equal(payload.outstandingAmount, 60000);
  assert.equal(payload.status, "Partial");
});

test("sanitizePurchaseOrderPayload derives received status from qtyReceived", () => {
  const payload = sanitizePurchaseOrderPayload({
    noPO: "PO-001",
    supplier: "Vendor A",
    items: [
      { kode: "SKU-1", nama: "Barang 1", qty: 5, unitPrice: 1000, qtyReceived: 5 },
      { kode: "SKU-2", nama: "Barang 2", qty: 2, unitPrice: 2500, qtyReceived: 2 },
    ],
  });

  assert.equal(payload.status, "Received");
  assert.equal(payload.total, 10000);
});

test("sanitizePurchaseOrderPayload rejects terminal status rollback", () => {
  assert.throws(
    () =>
      sanitizePurchaseOrderPayload(
        {
          noPO: "PO-001",
          supplier: "Vendor A",
          status: "Draft",
          items: [{ kode: "SKU-1", nama: "Barang 1", qty: 1, unitPrice: 1000, qtyReceived: 0 }],
        },
        {
          status: "Received",
          items: [{ kode: "SKU-1", nama: "Barang 1", qty: 1, unitPrice: 1000, qtyReceived: 1 }],
        },
      ),
    (error) =>
      error instanceof PayloadValidationError &&
      error.message.includes("status terminal 'Received' tidak boleh diubah"),
  );
});

test("sanitizeStockInPayload requires poId for receiving type", () => {
  assert.throws(
    () =>
      sanitizeStockInPayload({
        noStockIn: "SI-001",
        type: "Receiving",
        items: [{ kode: "SKU-1", nama: "Barang 1", qty: 2 }],
      }),
    (error) =>
      error instanceof PayloadValidationError &&
      error.message.includes("type 'Receiving' wajib menyertakan field 'poId'"),
  );
});

test("sanitizeReceivingPayload requires at least one valid item", () => {
  assert.throws(
    () =>
      sanitizeReceivingPayload({
        noReceiving: "RCV-001",
        poId: "po-1",
        items: [],
      }),
    (error) =>
      error instanceof PayloadValidationError &&
      error.message.includes("minimal 1 item wajib diisi"),
  );
});

test("sanitizeMaterialRequestPayload keeps only positive qty items", () => {
  const payload = sanitizeMaterialRequestPayload({
    noRequest: "MR-001",
    projectId: "proj-1",
    items: [
      { itemKode: "SKU-1", itemNama: "Barang 1", qty: 3, unit: "pcs" },
      { itemKode: "SKU-2", itemNama: "Barang 2", qty: 0, unit: "pcs" },
    ],
  });

  assert.equal(Array.isArray(payload.items), true);
  assert.equal((payload.items as Array<unknown>).length, 1);
});

test("sanitizeSuratJalanPayload normalizes delivery workflow status", () => {
  const payload = sanitizeSuratJalanPayload({
    noSurat: "SJ-001",
    tanggal: "2026-03-31",
    sjType: "Material Delivery",
    tujuan: "Site A",
    deliveryStatus: "On Delivery",
    items: [{ namaItem: "Barang 1", qty: 3, satuan: "pcs" }],
  });

  assert.equal(payload.deliveryStatus, "On Delivery");
  assert.equal(payload.workflowStatus, "ISSUED");
  assert.equal(payload.status, "ISSUED");
});
