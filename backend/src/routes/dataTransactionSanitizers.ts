import { asRecord, asTrimmedString, toFiniteNumber } from "./dataPayloadUtils";
import {
  PayloadValidationError,
  assertNoUnknownKeys,
  assertStatusInList,
} from "./dataValidationUtils";

export function sanitizeCustomerInvoicePayload(
  payload: unknown,
  existingPayload?: unknown,
): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "noInvoice",
      "tanggal",
      "dueDate",
      "customerId",
      "customerName",
      "projectId",
      "projectName",
      "perihal",
      "items",
      "subtotal",
      "ppn",
      "pph",
      "totalNominal",
      "paidAmount",
      "outstandingAmount",
      "status",
      "paymentHistory",
      "noKontrak",
      "noPO",
      "termin",
      "remark",
      "createdBy",
      "createdAt",
      "sentAt",
    ],
    "customer-invoices payload",
  );

  const itemsRaw = Array.isArray(merged.items) ? merged.items : [];
  const items = itemsRaw.map((row) => {
    const item = asRecord(row);
    assertNoUnknownKeys(
      item,
      ["id", "deskripsi", "qty", "satuan", "hargaSatuan", "jumlah"],
      "customer-invoices.items[]",
    );
    const qty = Math.max(0, toFiniteNumber(item.qty, 0));
    const hargaSatuan = Math.max(0, toFiniteNumber(item.hargaSatuan, 0));
    const jumlah = qty * hargaSatuan;
    return {
      ...item,
      qty,
      hargaSatuan,
      jumlah,
    };
  });

  const subtotalComputed = items.reduce(
    (sum, item) => sum + toFiniteNumber(item.jumlah, 0),
    0,
  );
  const subtotal = Math.max(0, subtotalComputed || toFiniteNumber(merged.subtotal, 0));
  const ppn = Math.max(0, toFiniteNumber(merged.ppn, 0));
  const pph = Math.max(0, toFiniteNumber(merged.pph, 0));
  const totalNominal = Math.max(0, subtotal + ppn - pph);

  const paidAmountRaw = Math.max(0, toFiniteNumber(merged.paidAmount, 0));
  const paidAmount = Math.min(totalNominal, paidAmountRaw);
  const outstandingAmount = Math.max(0, totalNominal - paidAmount);

  const incomingStatus =
    assertStatusInList(
      asTrimmedString(merged.status) || "Draft",
      ["Draft", "Sent", "Partial Paid", "Paid", "Overdue", "Cancelled"],
      "customer-invoices",
    ) || "Draft";
  let status = incomingStatus;
  if (incomingStatus.toUpperCase() !== "CANCELLED") {
    if (outstandingAmount <= 0 && totalNominal > 0) {
      status = "Paid";
    } else if (paidAmount > 0) {
      status = "Partial Paid";
    }
  }

  return {
    ...merged,
    customerId: asTrimmedString(merged.customerId) || undefined,
    projectId: asTrimmedString(merged.projectId) || undefined,
    items,
    subtotal,
    ppn,
    pph,
    totalNominal,
    paidAmount,
    outstandingAmount,
    paymentHistory: Array.isArray(merged.paymentHistory) ? merged.paymentHistory : [],
    status,
  };
}

export function sanitizeVendorExpensePayload(
  payload: unknown,
  existingPayload?: unknown,
): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "noExpense",
      "tanggal",
      "vendorId",
      "vendorName",
      "projectId",
      "projectName",
      "rabItemId",
      "rabItemName",
      "kategori",
      "keterangan",
      "nominal",
      "ppn",
      "totalNominal",
      "hasKwitansi",
      "kwitansiUrl",
      "noKwitansi",
      "metodeBayar",
      "status",
      "remark",
      "approvedBy",
      "approvedAt",
      "rejectedBy",
      "rejectedAt",
      "rejectReason",
      "paidAt",
      "createdBy",
      "createdAt",
    ],
    "vendor-expenses payload",
  );

  const nominal = Math.max(0, toFiniteNumber(merged.nominal, 0));
  const ppn = Math.max(0, toFiniteNumber(merged.ppn, 0));
  const totalNominal = Math.max(0, nominal + ppn);
  const status = assertStatusInList(
    asTrimmedString(merged.status),
    ["Draft", "Pending Approval", "Approved", "Rejected", "Paid"],
    "vendor-expenses",
  );

  return {
    ...merged,
    vendorId: asTrimmedString(merged.vendorId) || undefined,
    projectId: asTrimmedString(merged.projectId) || undefined,
    nominal,
    ppn,
    totalNominal,
    status: status || "Draft",
    hasKwitansi: Boolean(merged.hasKwitansi || asTrimmedString(merged.kwitansiUrl)),
  };
}

export function sanitizeVendorInvoicePayload(
  payload: unknown,
  existingPayload?: unknown,
): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "noInvoiceVendor",
      "supplier",
      "noPO",
      "purchaseOrderId",
      "totalAmount",
      "paidAmount",
      "outstandingAmount",
      "status",
      "jatuhTempo",
      "projectId",
      "ppn",
      "vendorId",
      "amount",
      "tanggal",
      "noInvoice",
      "vendorName",
    ],
    "vendor-invoices payload",
  );

  const totalAmount = Math.max(
    0,
    toFiniteNumber(merged.totalAmount ?? merged.amount, 0),
  );
  const paidAmountRaw = Math.max(0, toFiniteNumber(merged.paidAmount, 0));
  const paidAmount = Math.min(totalAmount, paidAmountRaw);
  const outstandingAmount = Math.max(0, totalAmount - paidAmount);
  const rawStatusUpper = String(asTrimmedString(merged.status) || "UNPAID").toUpperCase();
  const statusAlias: Record<string, string> = {
    SENT: "Unpaid",
    DRAFT: "Unpaid",
    APPROVED: "Unpaid",
    UNPAID: "Unpaid",
    PARTIAL: "Partial",
    PAID: "Paid",
    OVERDUE: "Overdue",
  };
  const incomingStatus =
    assertStatusInList(
      statusAlias[rawStatusUpper] || "Unpaid",
      ["Unpaid", "Partial", "Paid", "Overdue"],
      "vendor-invoices",
    ) || "Unpaid";

  let status = incomingStatus;
  if (outstandingAmount <= 0 && totalAmount > 0) {
    status = "Paid";
  } else if (paidAmount > 0) {
    status = "Partial";
  } else if (incomingStatus.toUpperCase() !== "OVERDUE") {
    status = "Unpaid";
  }

  return {
    id: asTrimmedString(merged.id),
    noInvoiceVendor:
      asTrimmedString(merged.noInvoiceVendor) ||
      asTrimmedString(merged.noInvoice) ||
      "",
    supplier:
      asTrimmedString(merged.supplier) ||
      asTrimmedString(merged.vendorName) ||
      "",
    noPO: asTrimmedString(merged.noPO) || "",
    jatuhTempo:
      asTrimmedString(merged.jatuhTempo) ||
      asTrimmedString(merged.tanggal) ||
      "",
    vendorId: asTrimmedString(merged.vendorId) || undefined,
    projectId: asTrimmedString(merged.projectId) || undefined,
    purchaseOrderId: asTrimmedString(merged.purchaseOrderId) || undefined,
    ppn: Math.max(0, toFiniteNumber(merged.ppn, 0)),
    totalAmount,
    paidAmount,
    outstandingAmount,
    status,
  };
}

export function sanitizePurchaseOrderPayload(
  payload: unknown,
  existingPayload?: unknown,
): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "noPO",
      "tanggal",
      "supplier",
      "vendorId",
      "total",
      "status",
      "projectId",
      "items",
      "ref",
      "supplierAddress",
      "supplierPhone",
      "supplierFax",
      "supplierContact",
      "attention",
      "notes",
      "ppn",
      "ppnRate",
      "top",
      "po",
      "deliveryDate",
      "signatoryName",
    ],
    "purchase-orders payload",
  );

  const itemsRaw = Array.isArray(merged.items) ? merged.items : [];
  const items = itemsRaw.map((row) => {
    const item = asRecord(row);
    assertNoUnknownKeys(
      item,
      [
        "id",
        "kode",
        "nama",
        "qty",
        "unit",
        "unitPrice",
        "total",
        "harga",
        "qtyReceived",
        "source",
        "sourceRef",
      ],
      "purchase-orders.items[]",
    );
    const qty = Math.max(0, toFiniteNumber(item.qty, 0));
    const qtyReceivedRaw = Math.max(0, toFiniteNumber(item.qtyReceived, 0));
    const qtyReceived = Math.min(qty, qtyReceivedRaw);
    const unitPrice = Math.max(0, toFiniteNumber(item.unitPrice ?? item.harga, 0));
    const totalProvided = Math.max(0, toFiniteNumber(item.total, Number.NaN));
    const totalCalculated = Math.max(0, qty * unitPrice);
    const total = Number.isFinite(totalProvided) ? totalProvided : totalCalculated;
    return {
      ...item,
      qty,
      qtyReceived,
      unitPrice,
      harga: unitPrice,
      total,
    };
  });

  const computedTotal = Math.max(
    0,
    items.reduce((sum, item) => sum + toFiniteNumber(item.total, 0), 0),
  );
  const providedTotal = Math.max(0, toFiniteNumber(merged.total, 0));
  const total = computedTotal > 0 ? computedTotal : providedTotal;
  const requestedStatus = assertStatusInList(
    asTrimmedString(merged.status),
    ["Draft", "Pending", "Sent", "Approved", "Partial", "Received", "Rejected", "Cancelled"],
    "purchase-orders",
  );
  const previousStatus = assertStatusInList(
    asTrimmedString(existing.status),
    ["Draft", "Pending", "Sent", "Approved", "Partial", "Received", "Rejected", "Cancelled"],
    "purchase-orders",
  );

  const hasItems = items.length > 0;
  const allReceived =
    hasItems &&
    items.every(
      (it) => toFiniteNumber(it.qtyReceived, 0) >= toFiniteNumber(it.qty, 0),
    );
  const someReceived = items.some((it) => toFiniteNumber(it.qtyReceived, 0) > 0);

  let status = requestedStatus || "Draft";
  if (allReceived) {
    status = "Received";
  } else if (someReceived) {
    status = "Partial";
  } else if (status === "Received" || status === "Partial") {
    throw new PayloadValidationError(
      "purchase-orders: status tidak boleh Partial/Received jika qtyReceived semua item masih 0",
    );
  }

  if (
    previousStatus &&
    ["Received", "Rejected", "Cancelled"].includes(previousStatus) &&
    status !== previousStatus
  ) {
    throw new PayloadValidationError(
      `purchase-orders: status terminal '${previousStatus}' tidak boleh diubah ke '${status}'`,
    );
  }
  if (
    previousStatus === "Partial" &&
    ["Draft", "Pending", "Sent", "Approved"].includes(status)
  ) {
    throw new PayloadValidationError(
      `purchase-orders: status tidak boleh mundur dari '${previousStatus}' ke '${status}'`,
    );
  }

  return {
    ...merged,
    supplier: asTrimmedString(merged.supplier) || "",
    vendorId: asTrimmedString(merged.vendorId) || undefined,
    projectId: asTrimmedString(merged.projectId) || undefined,
    ppn: Math.max(0, toFiniteNumber(merged.ppn ?? merged.ppnRate, 0)),
    ppnRate: Math.max(0, toFiniteNumber(merged.ppnRate ?? merged.ppn, 0)),
    top: Math.max(0, toFiniteNumber(merged.top, 0)),
    supplierAddress: asTrimmedString(merged.supplierAddress) || "",
    supplierPhone: asTrimmedString(merged.supplierPhone) || "",
    supplierFax: asTrimmedString(merged.supplierFax) || "",
    supplierContact: asTrimmedString(merged.supplierContact) || "",
    attention: asTrimmedString(merged.attention) || "",
    notes: asTrimmedString(merged.notes) || "",
    ref: asTrimmedString(merged.ref) || "",
    po: asTrimmedString(merged.po) || "",
    deliveryDate: asTrimmedString(merged.deliveryDate) || undefined,
    signatoryName: asTrimmedString(merged.signatoryName) || "",
    items,
    total,
    status,
  };
}

export function sanitizeStockInPayload(
  payload: unknown,
  existingPayload?: unknown,
): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "noStockIn",
      "noSuratJalan",
      "supplier",
      "projectId",
      "projectName",
      "tanggal",
      "type",
      "status",
      "createdBy",
      "items",
      "notes",
      "noPO",
      "poId",
    ],
    "stock-ins payload",
  );

  const itemsRaw = Array.isArray(merged.items) ? merged.items : [];
  const items = itemsRaw
    .map((row) => {
      const item = asRecord(row);
      assertNoUnknownKeys(
        item,
        ["kode", "nama", "qty", "satuan", "batchNo", "expiryDate"],
        "stock-ins.items[]",
      );
      const qty = Math.max(0, toFiniteNumber(item.qty, 0));
      return {
        ...item,
        qty,
        kode: asTrimmedString(item.kode) || "",
      };
    })
    .filter((item) => item.kode);

  const type =
    assertStatusInList(
      asTrimmedString(merged.type),
      ["Receiving", "Return", "Adjustment"],
      "stock-ins",
    ) || "Receiving";
  const poId = asTrimmedString(merged.poId) || undefined;
  if (type === "Receiving" && !poId) {
    throw new PayloadValidationError(
      "stock-ins: type 'Receiving' wajib menyertakan field 'poId'",
    );
  }

  return {
    ...merged,
    supplier: asTrimmedString(merged.supplier) || "",
    projectId: asTrimmedString(merged.projectId) || undefined,
    projectName: asTrimmedString(merged.projectName) || undefined,
    noPO: asTrimmedString(merged.noPO) || undefined,
    poId,
    type,
    status:
      assertStatusInList(asTrimmedString(merged.status), ["Posted", "Draft"], "stock-ins") ||
      "Draft",
    items,
  };
}

export function sanitizeReceivingPayload(
  payload: unknown,
  existingPayload?: unknown,
): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "noReceiving",
      "noSuratJalan",
      "fotoSuratJalan",
      "tanggal",
      "noPO",
      "poId",
      "supplier",
      "project",
      "projectId",
      "status",
      "lokasiGudang",
      "items",
      "notes",
    ],
    "receivings payload",
  );

  const poId = asTrimmedString(merged.poId);
  if (!poId) {
    throw new PayloadValidationError("receivings: field 'poId' wajib diisi");
  }

  const itemsRaw = Array.isArray(merged.items) ? merged.items : [];
  const items = itemsRaw
    .map((row) => {
      const item = asRecord(row);
      assertNoUnknownKeys(
        item,
        [
          "id",
          "itemKode",
          "itemName",
          "qtyOrdered",
          "qtyReceived",
          "qtyGood",
          "qtyDamaged",
          "qtyPreviouslyReceived",
          "unit",
          "condition",
          "batchNo",
          "expiryDate",
          "photoUrl",
          "notes",
        ],
        "receivings.items[]",
      );
      const qtyReceived = Math.max(
        0,
        toFiniteNumber(item.qtyReceived ?? item.qtyGood ?? item.qty, 0),
      );
      return {
        ...item,
        itemKode: asTrimmedString(item.itemKode) || "",
        itemName: asTrimmedString(item.itemName) || "",
        qtyOrdered: Math.max(0, toFiniteNumber(item.qtyOrdered, 0)),
        unit: asTrimmedString(item.unit) || "pcs",
        qtyReceived,
        qtyGood: Math.max(0, toFiniteNumber(item.qtyGood, qtyReceived)),
        qty: Math.max(0, toFiniteNumber(item.qty, qtyReceived)),
        qtyDamaged: Math.max(0, toFiniteNumber(item.qtyDamaged, 0)),
        qtyPreviouslyReceived: Math.max(
          0,
          toFiniteNumber(item.qtyPreviouslyReceived, 0),
        ),
        condition: asTrimmedString(item.condition) || undefined,
        batchNo: asTrimmedString(item.batchNo) || "",
        expiryDate: asTrimmedString(item.expiryDate) || undefined,
        photoUrl: asTrimmedString(item.photoUrl) || undefined,
        notes: asTrimmedString(item.notes) || "",
      };
    })
    .filter((item) => item.itemKode || item.itemName);

  if (items.length === 0) {
    throw new PayloadValidationError("receivings: minimal 1 item wajib diisi");
  }

  return {
    ...merged,
    poId,
    noPO: asTrimmedString(merged.noPO) || undefined,
    supplier: asTrimmedString(merged.supplier) || "",
    project: asTrimmedString(merged.project) || "",
    projectId: asTrimmedString(merged.projectId) || undefined,
    lokasiGudang: asTrimmedString(merged.lokasiGudang) || "",
    fotoSuratJalan: asTrimmedString(merged.fotoSuratJalan) || "",
    noReceiving: asTrimmedString(merged.noReceiving) || "",
    noSuratJalan: asTrimmedString(merged.noSuratJalan) || "",
    tanggal: asTrimmedString(merged.tanggal) || "",
    status:
      assertStatusInList(
        asTrimmedString(merged.status),
        ["Pending", "Partial", "Complete", "Rejected"],
        "receivings",
      ) || "Pending",
    notes: asTrimmedString(merged.notes) || "",
    items,
  };
}

export function sanitizeStockOutPayload(
  payload: unknown,
  existingPayload?: unknown,
): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "noStockOut",
      "noWorkOrder",
      "productionReportId",
      "projectId",
      "projectName",
      "penerima",
      "tanggal",
      "type",
      "status",
      "createdBy",
      "items",
      "notes",
    ],
    "stock-outs payload",
  );

  const itemsRaw = Array.isArray(merged.items) ? merged.items : [];
  const items = itemsRaw
    .map((row) => {
      const item = asRecord(row);
      assertNoUnknownKeys(
        item,
        ["kode", "nama", "qty", "satuan", "batchNo"],
        "stock-outs.items[]",
      );
      const qty = Math.max(0, toFiniteNumber(item.qty, 0));
      return {
        ...item,
        qty,
        kode: asTrimmedString(item.kode) || "",
      };
    })
    .filter((item) => item.kode);

  return {
    ...merged,
    productionReportId: asTrimmedString(merged.productionReportId) || undefined,
    projectId: asTrimmedString(merged.projectId) || undefined,
    projectName: asTrimmedString(merged.projectName) || undefined,
    type:
      assertStatusInList(
        asTrimmedString(merged.type),
        ["Project Issue", "Sales", "Adjustment"],
        "stock-outs",
      ) || "Project Issue",
    status:
      assertStatusInList(asTrimmedString(merged.status), ["Posted", "Draft"], "stock-outs") ||
      "Draft",
    items,
  };
}

export function sanitizeStockItemPayload(
  payload: unknown,
  existingPayload?: unknown,
): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "kode",
      "nama",
      "kategori",
      "satuan",
      "supplier",
      "stokAwal",
      "stok",
      "reserved",
      "minStock",
      "hargaSatuan",
      "lokasi",
      "lastUpdate",
      "expiryDate",
      "fefoBatch",
      "shelfLifeDays",
    ],
    "stock-items payload",
  );

  return {
    ...merged,
    kode: asTrimmedString(merged.kode) || "",
    nama: asTrimmedString(merged.nama) || "",
    kategori: asTrimmedString(merged.kategori) || "General",
    satuan: asTrimmedString(merged.satuan) || "pcs",
    supplier: asTrimmedString(merged.supplier) || "",
    stokAwal: Math.max(0, toFiniteNumber(merged.stokAwal, 0)),
    stok: Math.max(0, toFiniteNumber(merged.stok, 0)),
    reserved: Math.max(0, toFiniteNumber(merged.reserved, 0)),
    minStock: Math.max(0, toFiniteNumber(merged.minStock, 0)),
    hargaSatuan: Math.max(0, toFiniteNumber(merged.hargaSatuan, 0)),
    lokasi: asTrimmedString(merged.lokasi) || "Gudang Utama",
    lastUpdate: asTrimmedString(merged.lastUpdate) || undefined,
    expiryDate: asTrimmedString(merged.expiryDate) || undefined,
    fefoBatch: asTrimmedString(merged.fefoBatch) || undefined,
    shelfLifeDays: Math.max(0, toFiniteNumber(merged.shelfLifeDays, 0)),
  };
}

function qtyIsPositive(value: unknown): boolean {
  return toFiniteNumber(value, 0) > 0;
}

export function sanitizeMaterialRequestPayload(
  payload: unknown,
  existingPayload?: unknown,
): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };
  assertNoUnknownKeys(
    merged,
    [
      "id",
      "noRequest",
      "requestNo",
      "projectId",
      "projectName",
      "requestedBy",
      "requestedAt",
      "status",
      "items",
    ],
    "material-requests payload",
  );

  const itemsRaw = Array.isArray(merged.items) ? merged.items : [];
  const items = itemsRaw
    .map((row) => {
      const item = asRecord(row);
      assertNoUnknownKeys(
        item,
        ["id", "itemKode", "itemNama", "qty", "unit"],
        "material-requests.items[]",
      );
      const qty = Math.max(0, toFiniteNumber(item.qty, 0));
      return {
        ...item,
        qty,
      };
    })
    .filter((item) => qtyIsPositive(item.qty));

  return {
    ...merged,
    noRequest: asTrimmedString(merged.noRequest || merged.requestNo) || "",
    requestNo: asTrimmedString(merged.requestNo || merged.noRequest) || "",
    projectId: asTrimmedString(merged.projectId) || "",
    items,
    status:
      assertStatusInList(
        asTrimmedString(merged.status) || "Pending",
        ["Pending", "Approved", "Issued", "Rejected", "Ordered", "Delivered"],
        "material-requests",
      ) || "Pending",
  };
}

export function sanitizeSuratJalanPayload(
  payload: unknown,
  existingPayload?: unknown,
): Record<string, unknown> {
  const existing = asRecord(existingPayload);
  const incoming = asRecord(payload);
  const merged = { ...existing, ...incoming };

  const sjType =
    assertStatusInList(
      asTrimmedString(merged.sjType),
      ["Material Delivery", "Equipment Loan"],
      "surat-jalan",
    ) || "Material Delivery";

  const itemsRaw = Array.isArray(merged.items) ? merged.items : [];
  const items = itemsRaw
    .map((row) => {
      const item = asRecord(row);
      const jumlah = Math.max(0, toFiniteNumber(item.jumlah ?? item.qty, 0));
      return {
        ...item,
        namaItem:
          asTrimmedString(item.namaItem) || asTrimmedString(item.namaBarang) || "",
        itemKode: asTrimmedString(item.itemKode) || undefined,
        jumlah,
        satuan: asTrimmedString(item.satuan) || asTrimmedString(item.unit) || "pcs",
        batchNo: asTrimmedString(item.batchNo) || undefined,
        keterangan: asTrimmedString(item.keterangan) || undefined,
      };
    })
    .filter((item) => !!item.namaItem && item.jumlah > 0);

  const deliveryStatus =
    assertStatusInList(
      asTrimmedString(merged.deliveryStatus),
      ["Pending", "On Delivery", "In Transit", "Delivered", "Returned"],
      "surat-jalan",
    ) || "Pending";

  const normalizedWorkflowRaw = (
    asTrimmedString(merged.workflowStatus) ||
    asTrimmedString(merged.statusWorkflow) ||
    asTrimmedString(merged.status) ||
    deliveryStatus
  )
    ?.toUpperCase()
    .replace(/[\s-]+/g, "_");

  const workflowStatus =
    normalizedWorkflowRaw === "ISSUED" ||
    normalizedWorkflowRaw === "IN_TRANSIT" ||
    normalizedWorkflowRaw === "ON_DELIVERY"
      ? "ISSUED"
      : normalizedWorkflowRaw === "DELIVERED" ||
          normalizedWorkflowRaw === "COMPLETE" ||
          normalizedWorkflowRaw === "COMPLETED"
        ? "DELIVERED"
        : normalizedWorkflowRaw === "CLOSED" || normalizedWorkflowRaw === "RETURNED"
          ? "CLOSED"
          : "PREPARED";

  return {
    ...merged,
    id: asTrimmedString(merged.id) || undefined,
    noSurat: asTrimmedString(merged.noSurat) || "",
    tanggal: asTrimmedString(merged.tanggal) || "",
    sjType,
    tujuan: asTrimmedString(merged.tujuan) || "",
    alamat: asTrimmedString(merged.alamat) || "",
    upPerson: asTrimmedString(merged.upPerson) || undefined,
    noPO: asTrimmedString(merged.noPO) || undefined,
    projectId: asTrimmedString(merged.projectId) || undefined,
    assetId: asTrimmedString(merged.assetId) || undefined,
    sopir: asTrimmedString(merged.sopir) || undefined,
    noPolisi: asTrimmedString(merged.noPolisi) || undefined,
    pengirim: asTrimmedString(merged.pengirim) || undefined,
    expectedReturnDate: asTrimmedString(merged.expectedReturnDate) || undefined,
    actualReturnDate: asTrimmedString(merged.actualReturnDate) || undefined,
    returnStatus:
      assertStatusInList(
        asTrimmedString(merged.returnStatus),
        ["Pending", "Partial", "Complete"],
        "surat-jalan",
      ) || undefined,
    items,
    deliveryStatus,
    workflowStatus,
    status: workflowStatus,
  };
}
