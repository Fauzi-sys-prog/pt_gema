import { asTrimmedString } from "./dataPayloadUtils";

export function mapProcurementPurchaseOrderToLegacyPayload(row: {
  id: string;
  number: string;
  tanggal: Date;
  supplierName: string;
  projectId: string | null;
  vendorId: string | null;
  supplierAddress: string | null;
  supplierPhone: string | null;
  supplierFax: string | null;
  supplierContact: string | null;
  attention: string | null;
  notes: string | null;
  ppnRate: number;
  topDays: number;
  ref: string | null;
  poCode: string | null;
  deliveryDate: Date | null;
  signatoryName: string | null;
  totalAmount: number;
  status: string;
  items: Array<{
    id: string;
    itemCode: string | null;
    itemName: string;
    qty: number;
    unit: string;
    unitPrice: number;
    total: number;
    qtyReceived: number;
    source: string | null;
    sourceRef: string | null;
  }>;
}) {
  return {
    id: row.id,
    noPO: row.number,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    supplier: row.supplierName,
    vendorId: row.vendorId ?? undefined,
    projectId: row.projectId ?? undefined,
    supplierAddress: row.supplierAddress ?? "",
    supplierPhone: row.supplierPhone ?? "",
    supplierFax: row.supplierFax ?? "",
    supplierContact: row.supplierContact ?? "",
    attention: row.attention ?? "",
    notes: row.notes ?? "",
    ppn: row.ppnRate,
    ppnRate: row.ppnRate,
    top: row.topDays,
    ref: row.ref ?? "",
    po: row.poCode ?? "",
    deliveryDate: row.deliveryDate
      ? row.deliveryDate.toISOString().slice(0, 10)
      : undefined,
    signatoryName: row.signatoryName ?? "",
    total: row.totalAmount,
    status: row.status,
    items: row.items.map((item) => ({
      id: item.id,
      kode: item.itemCode ?? "",
      nama: item.itemName,
      qty: item.qty,
      unit: item.unit,
      unitPrice: item.unitPrice,
      harga: item.unitPrice,
      total: item.total,
      qtyReceived: item.qtyReceived,
      source: item.source ?? undefined,
      sourceRef: item.sourceRef ?? undefined,
    })),
  };
}

export function mapProcurementReceivingToLegacyPayload(row: {
  id: string;
  purchaseOrderId: string;
  projectId: string | null;
  number: string;
  suratJalanNo: string | null;
  suratJalanPhoto: string | null;
  tanggal: Date;
  purchaseOrderNo: string | null;
  supplierName: string;
  projectName: string | null;
  status: string;
  warehouseLocation: string | null;
  notes: string | null;
  items: Array<{
    id: string;
    itemCode: string | null;
    itemName: string;
    qtyOrdered: number;
    qtyReceived: number;
    qtyGood: number;
    qtyDamaged: number;
    qtyPreviouslyReceived: number;
    unit: string;
    condition: string | null;
    batchNo: string | null;
    expiryDate: Date | null;
    photoUrl: string | null;
    notes: string | null;
  }>;
}) {
  return {
    id: row.id,
    noReceiving: row.number,
    noSuratJalan: row.suratJalanNo ?? "",
    fotoSuratJalan: row.suratJalanPhoto ?? "",
    tanggal: row.tanggal.toISOString().slice(0, 10),
    noPO: row.purchaseOrderNo ?? undefined,
    poId: row.purchaseOrderId,
    supplier: row.supplierName,
    project: row.projectName ?? "",
    projectId: row.projectId ?? undefined,
    status: row.status,
    lokasiGudang: row.warehouseLocation ?? "",
    notes: row.notes ?? "",
    items: row.items.map((item) => ({
      id: item.id,
      itemKode: item.itemCode ?? "",
      itemName: item.itemName,
      qtyOrdered: item.qtyOrdered,
      qtyReceived: item.qtyReceived,
      qtyGood: item.qtyGood,
      qtyDamaged: item.qtyDamaged,
      qtyPreviouslyReceived: item.qtyPreviouslyReceived,
      unit: item.unit,
      condition: item.condition ?? undefined,
      batchNo: item.batchNo ?? "",
      expiryDate: item.expiryDate
        ? item.expiryDate.toISOString().slice(0, 10)
        : undefined,
      photoUrl: item.photoUrl ?? undefined,
      notes: item.notes ?? "",
      qty: item.qtyReceived,
    })),
  };
}

export function mapFinanceCustomerInvoiceToLegacyPayload(row: {
  id: string;
  customerId: string | null;
  projectId: string | null;
  number: string;
  tanggal: Date;
  dueDate: Date | null;
  customerName: string;
  projectName: string | null;
  perihal: string | null;
  subtotal: number;
  ppn: number;
  pph: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
  noKontrak: string | null;
  noPO: string | null;
  termin: string | null;
  remark: string | null;
  createdBy: string | null;
  createdAt: Date;
  sentAt: Date | null;
  items: Array<{
    id: string;
    description: string;
    qty: number;
    unit: string;
    unitPrice: number;
    amount: number;
  }>;
  payments: Array<{
    id: string;
    tanggal: Date;
    nominal: number;
    method: string;
    proofNo: string | null;
    bankName: string | null;
    remark: string | null;
    createdBy: string | null;
    paidAt: Date | null;
  }>;
}) {
  return {
    id: row.id,
    noInvoice: row.number,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : undefined,
    customerId: row.customerId ?? undefined,
    customerName: row.customerName,
    projectId: row.projectId ?? undefined,
    projectName: row.projectName ?? undefined,
    perihal: row.perihal ?? "",
    items: row.items.map((item) => ({
      id: item.id,
      deskripsi: item.description,
      qty: item.qty,
      satuan: item.unit,
      hargaSatuan: item.unitPrice,
      jumlah: item.amount,
    })),
    subtotal: row.subtotal,
    ppn: row.ppn,
    pph: row.pph,
    totalNominal: row.totalAmount,
    paidAmount: row.paidAmount,
    outstandingAmount: row.outstandingAmount,
    status: row.status,
    paymentHistory: row.payments.map((item) => ({
      id: item.id,
      tanggal: item.tanggal.toISOString().slice(0, 10),
      nominal: item.nominal,
      metodeBayar: item.method,
      noBukti: item.proofNo ?? undefined,
      bankName: item.bankName ?? undefined,
      remark: item.remark ?? undefined,
      createdBy: item.createdBy ?? undefined,
      createdAt: item.paidAt
        ? item.paidAt.toISOString()
        : item.tanggal.toISOString(),
    })),
    noKontrak: row.noKontrak ?? undefined,
    noPO: row.noPO ?? undefined,
    termin: row.termin ?? undefined,
    remark: row.remark ?? undefined,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt ? row.sentAt.toISOString() : undefined,
  };
}

export function mapFinanceVendorExpenseToLegacyPayload(row: {
  id: string;
  vendorId: string | null;
  projectId: string | null;
  number: string;
  tanggal: Date;
  vendorName: string;
  projectName: string | null;
  rabItemId: string | null;
  rabItemName: string | null;
  kategori: string | null;
  keterangan: string | null;
  nominal: number;
  ppn: number;
  totalNominal: number;
  hasKwitansi: boolean;
  kwitansiUrl: string | null;
  noKwitansi: string | null;
  metodeBayar: string | null;
  status: string;
  remark: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectReason: string | null;
  paidAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    noExpense: row.number,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    vendorId: row.vendorId ?? undefined,
    vendorName: row.vendorName,
    projectId: row.projectId ?? undefined,
    projectName: row.projectName ?? undefined,
    rabItemId: row.rabItemId ?? undefined,
    rabItemName: row.rabItemName ?? undefined,
    kategori: row.kategori ?? "",
    keterangan: row.keterangan ?? "",
    nominal: row.nominal,
    ppn: row.ppn,
    totalNominal: row.totalNominal,
    hasKwitansi: row.hasKwitansi,
    kwitansiUrl: row.kwitansiUrl ?? undefined,
    noKwitansi: row.noKwitansi ?? undefined,
    metodeBayar: row.metodeBayar ?? undefined,
    status: row.status,
    remark: row.remark ?? undefined,
    approvedBy: row.approvedBy ?? undefined,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : undefined,
    rejectedBy: row.rejectedBy ?? undefined,
    rejectedAt: row.rejectedAt ? row.rejectedAt.toISOString() : undefined,
    rejectReason: row.rejectReason ?? undefined,
    paidAt: row.paidAt ? row.paidAt.toISOString() : undefined,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapFinanceVendorInvoiceToLegacyPayload(row: {
  id: string;
  vendorId: string | null;
  projectId: string | null;
  purchaseOrderId: string | null;
  number: string;
  noPO: string | null;
  supplierName: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  ppn: number;
  status: string;
  tanggal: Date | null;
  dueDate: Date | null;
}) {
  return {
    id: row.id,
    vendorId: row.vendorId ?? undefined,
    projectId: row.projectId ?? undefined,
    noInvoiceVendor: row.number,
    noInvoice: row.number,
    supplier: row.supplierName,
    vendorName: row.supplierName,
    noPO: row.noPO ?? undefined,
    totalAmount: row.totalAmount,
    amount: row.totalAmount,
    paidAmount: row.paidAmount,
    outstandingAmount: row.outstandingAmount,
    ppn: row.ppn,
    status: row.status,
    tanggal: row.tanggal ? row.tanggal.toISOString().slice(0, 10) : undefined,
    jatuhTempo: row.dueDate
      ? row.dueDate.toISOString().slice(0, 10)
      : undefined,
    purchaseOrderId: row.purchaseOrderId ?? undefined,
  };
}

export function parsePettySource(source?: string | null) {
  const raw = String(source || "");
  const parts = raw.split("|");
  const map = Object.fromEntries(
    parts
      .slice(1)
      .map((part) => part.split("="))
      .filter((part) => part.length === 2),
  );
  return {
    accountCode: asTrimmedString(map.accountCode) || undefined,
    direction: map.direction === "debit" ? "debit" : "credit",
    kind: asTrimmedString(map.kind) || undefined,
  };
}

export function mapFinanceWorkingExpenseSheetToLegacyPayload(row: {
  id: string;
  client: string | null;
  projectId: string | null;
  projectName: string | null;
  location: string | null;
  date: Date;
  noHal: string;
  revisi: string | null;
  totalKas: number;
  status: string;
  createdBy: string | null;
  items: Array<{
    id: string;
    date: Date | null;
    description: string;
    nominal: number;
    hasNota: string | null;
    remark: string | null;
  }>;
}) {
  return {
    id: row.id,
    client: row.client ?? "",
    projectId: row.projectId ?? undefined,
    project: row.projectName ?? "",
    location: row.location ?? "",
    date: row.date.toISOString().slice(0, 10),
    noHal: row.noHal,
    revisi: row.revisi ?? "0",
    totalKas: row.totalKas,
    status: row.status,
    createdBy: row.createdBy ?? undefined,
    items: row.items.map((item) => ({
      id: item.id,
      date: item.date ? item.date.toISOString().slice(0, 10) : "",
      description: item.description,
      nominal: item.nominal,
      hasNota: item.hasNota ?? "",
      remark: item.remark ?? undefined,
    })),
  };
}

export function mapFinancePettyCashTransactionToLegacyPayload(row: {
  id: string;
  projectId: string | null;
  employeeId: string | null;
  date: Date;
  ref: string | null;
  description: string;
  amount: number;
  accountCode: string | null;
  direction: string;
  projectName: string | null;
  adminName: string | null;
  transactionType: string | null;
  sourceKind: string | null;
}) {
  return {
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    ref: row.ref ?? undefined,
    description: row.description,
    amount: row.amount,
    projectId: row.projectId ?? undefined,
    employeeId: row.employeeId ?? undefined,
    project: row.projectName ?? undefined,
    admin: row.adminName ?? undefined,
    type: row.transactionType ?? "PETTY",
    source: `petty|accountCode=${row.accountCode ?? "00000"}|direction=${row.direction}|kind=${row.sourceKind ?? "transaction"}`,
  };
}

export function mapFinanceBankReconciliationToLegacyPayload(row: {
  id: string;
  projectId: string | null;
  customerInvoiceId: string | null;
  vendorInvoiceId: string | null;
  date: Date;
  periodLabel: string | null;
  account: string | null;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
  status: string;
  matchedId: string | null;
  note: string | null;
}) {
  return {
    id: row.id,
    projectId: row.projectId ?? undefined,
    customerInvoiceId: row.customerInvoiceId ?? undefined,
    invoiceId: row.customerInvoiceId ?? undefined,
    vendorInvoiceId: row.vendorInvoiceId ?? undefined,
    date: row.date.toISOString().slice(0, 10),
    periodLabel: row.periodLabel ?? undefined,
    account: row.account ?? undefined,
    description: row.description ?? "",
    debit: row.debit,
    credit: row.credit,
    balance: row.balance,
    status: row.status as "Matched" | "Unmatched" | "Potential",
    matchedId: row.matchedId ?? undefined,
    note: row.note ?? undefined,
  };
}

export function mapHrKasbonToLegacyPayload(row: {
  id: string;
  employeeId: string | null;
  projectId: string | null;
  employeeName: string | null;
  date: Date;
  amount: number;
  status: string;
  approved: boolean;
  createdBy: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    employeeId: row.employeeId ?? undefined,
    projectId: row.projectId ?? undefined,
    employeeName: row.employeeName ?? undefined,
    date: row.date.toISOString().slice(0, 10),
    amount: row.amount,
    status: row.status,
    approved: row.approved,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapProjectLaborEntryToLegacyPayload(row: {
  id: string;
  projectId: string;
  employeeId: string | null;
  date: Date;
  workerType: string;
  workerName: string;
  role: string | null;
  qtyDays: number;
  checkIn: string | null;
  checkOut: string | null;
  hoursWorked: number;
  overtimeHours: number;
  rate: number;
  amount: number;
  source: string;
  notes: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    employeeId: row.employeeId ?? undefined,
    date: row.date.toISOString().slice(0, 10),
    workerType: row.workerType,
    workerName: row.workerName,
    role: row.role ?? undefined,
    qtyDays: row.qtyDays,
    checkIn: row.checkIn ?? undefined,
    checkOut: row.checkOut ?? undefined,
    hoursWorked: row.hoursWorked,
    overtimeHours: row.overtimeHours,
    rate: row.rate,
    amount: row.amount,
    source: row.source,
    notes: row.notes ?? undefined,
    createdByUserId: row.createdByUserId ?? undefined,
    createdByName: row.createdByName ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}
