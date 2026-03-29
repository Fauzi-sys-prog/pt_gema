// AppContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { toast } from "sonner@2.0.3";
import api from "../services/api";
import { subscribeDataSync } from "../services/dataSyncBus";
import { hasRoleAccess, isOwnerLike } from "../utils/roles";
import { normalizeEntityRows } from "../utils/normalizeEntityRows";
import { sanitizeRichHtml } from "../utils/sanitizeRichHtml";

const AUTH_STATE_CHANGE_EVENT = "app-auth-state-changed";

const safeGetLocalStorageItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetLocalStorageItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage access failures in app context.
  }
};

const safeRemoveLocalStorageItem = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage access failures in app context.
  }
};

const sanitizeSuratKeluarRecord = <T extends Partial<SuratKeluar>>(record: T): T => {
  if (typeof record.isiSurat !== "string") return record;
  return {
    ...record,
    isiSurat: sanitizeRichHtml(record.isiSurat),
  } as T;
};

const sanitizeBeritaAcaraRecord = <T extends Partial<BeritaAcara>>(record: T): T => {
  if (typeof record.contentHTML !== "string") return record;
  return {
    ...record,
    contentHTML: sanitizeRichHtml(record.contentHTML),
  } as T;
};

const normalizeAuthUser = (raw: any): User => {
  const displayName = raw?.fullName || raw?.name || raw?.username || "User";

  return {
    ...raw,
    fullName: displayName,
    role: raw?.role ?? "ADMIN",
    isActive: raw?.isActive ?? true,
  } as User;
};

const canReadQuotations = (role?: UserRole | null): boolean =>
  hasRoleAccess(role, QUOTATION_READ_ROLES);

const canReadDataCollections = (role?: UserRole | null): boolean =>
  hasRoleAccess(role, DATA_COLLECTION_READ_ROLES);

const persistAuthUser = (user: User | null) => {
  if (!user) {
    safeRemoveLocalStorageItem("user");
    return;
  }
  safeSetLocalStorageItem("user", JSON.stringify(user));
};

const readPersistedAuthUser = (): User | null => {
  try {
    const raw = safeGetLocalStorageItem("user");
    if (!raw) return null;
    return normalizeAuthUser(JSON.parse(raw));
  } catch {
    safeRemoveLocalStorageItem("user");
    return null;
  }
};

/**
 * =========================
 *  TYPES (DEDUPED + CLEAN)
 * =========================
 */

export type UserRole =
  | "OWNER"
  | "SPV"
  | "ADMIN"
  | "MANAGER"
  | "HR"
  | "PURCHASING"
  | "USER"
  | "PRODUKSI"
  | "SALES"
  | "FINANCE"
  | "SUPPLY_CHAIN"
  | "WAREHOUSE"
  | "OPERATIONS";
export type ActiveStatus = "Active" | "Inactive";
export type DocStatus = "Draft" | "Sent" | "Approved" | "Rejected" | "Revised" | "Final" | "Review" | "Cancelled";
export type InvoiceStatus =
  | "Draft"
  | "Sent"
  | "Partial Paid"
  | "Paid"
  | "Overdue"
  | "Cancelled";

export type PaymentMethod = "Cash" | "Transfer" | "Cheque" | "Giro";

const PRIVILEGED_DATA_READ_ROLES: UserRole[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
];

const PROJECT_READ_ROLES: UserRole[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "SALES",
  "FINANCE",
  "SUPPLY_CHAIN",
  "PRODUKSI",
  "OPERATIONS",
  "WAREHOUSE",
  "PURCHASING",
  "HR",
];

const PROCUREMENT_READ_ROLES: Record<"purchase-orders" | "receivings", UserRole[]> = {
  "purchase-orders": ["OWNER", "SPV", "ADMIN", "MANAGER", "PURCHASING", "WAREHOUSE", "FINANCE", "PRODUKSI"],
  receivings: ["OWNER", "SPV", "ADMIN", "MANAGER", "PURCHASING", "WAREHOUSE", "FINANCE", "PRODUKSI"],
};

const OPERATION_READ_ROLES: UserRole[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "PRODUKSI",
  "OPERATIONS",
  "SUPPLY_CHAIN",
  "PURCHASING",
  "WAREHOUSE",
  "FINANCE",
  "SALES",
];

const HR_READ_ROLES: UserRole[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "HR",
  "FINANCE",
  "PRODUKSI",
  "SUPPLY_CHAIN",
  "SALES",
];

const QUOTATION_READ_ROLES: UserRole[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "SALES",
  "FINANCE",
];

const DATA_COLLECTION_READ_ROLES: UserRole[] = [
  "OWNER",
  "SPV",
  "ADMIN",
  "MANAGER",
  "SALES",
  "HR",
];

const INVENTORY_READ_ROLES: Record<
  "stock-items" | "stock-ins" | "stock-outs" | "stock-movements" | "stock-opnames",
  UserRole[]
> = {
  "stock-items": ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI", "FINANCE"],
  "stock-ins": ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI"],
  "stock-outs": ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI"],
  "stock-movements": ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI", "FINANCE"],
  "stock-opnames": ["OWNER", "ADMIN", "SUPPLY_CHAIN", "PRODUKSI", "FINANCE"],
};

const FINANCE_OPS_READ_ROLES: Record<
  "customer-invoices" | "vendor-expenses" | "vendor-invoices",
  UserRole[]
> = {
  "customer-invoices": ["OWNER", "SPV", "ADMIN", "MANAGER", "SALES", "FINANCE"],
  "vendor-expenses": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE"],
  "vendor-invoices": ["OWNER", "SPV", "ADMIN", "MANAGER", "FINANCE", "SUPPLY_CHAIN"],
};

const GENERIC_DATA_READ_ROLES: Partial<Record<string, UserRole[]>> = {
  invoices: ["OWNER", "ADMIN", "FINANCE", "SALES"],
  "surat-jalan": ["OWNER", "ADMIN", "WAREHOUSE", "SALES", "PRODUKSI"],
  "berita-acara": ["OWNER", "ADMIN", "HR", "SALES", "WAREHOUSE", "FINANCE", "PRODUKSI"],
  "surat-masuk": ["OWNER", "ADMIN", "HR", "SALES", "WAREHOUSE", "FINANCE", "PRODUKSI"],
  "surat-keluar": ["OWNER", "ADMIN", "HR", "SALES", "WAREHOUSE", "FINANCE", "PRODUKSI"],
  "template-surat": ["OWNER", "ADMIN", "HR", "SALES", "WAREHOUSE", "FINANCE", "PRODUKSI"],
  assets: ["OWNER", "ADMIN", "FINANCE", "WAREHOUSE", "PRODUKSI"],
  maintenances: ["OWNER", "ADMIN", "PRODUKSI", "WAREHOUSE"],
  payrolls: ["OWNER", "ADMIN", "FINANCE"],
  "archive-registry": ["OWNER", "ADMIN", "FINANCE", "SALES", "SUPPLY_CHAIN", "PRODUKSI"],
  "audit-logs": ["OWNER", "ADMIN", "FINANCE", "SALES", "SUPPLY_CHAIN", "PRODUKSI"],
  vendors: ["OWNER", "ADMIN", "FINANCE", "SUPPLY_CHAIN"],
  customers: ["OWNER", "ADMIN", "SALES", "FINANCE"],
};

const SPECIAL_RESOURCE_READ_ROLES: Partial<Record<string, UserRole[]>> = {
  projects: PROJECT_READ_ROLES,
  "purchase-orders": PROCUREMENT_READ_ROLES["purchase-orders"],
  receivings: PROCUREMENT_READ_ROLES.receivings,
  "work-orders": OPERATION_READ_ROLES,
  "material-requests": OPERATION_READ_ROLES,
  "production-reports": OPERATION_READ_ROLES,
  "production-trackers": OPERATION_READ_ROLES,
  "qc-inspections": OPERATION_READ_ROLES,
  employees: HR_READ_ROLES,
  attendances: HR_READ_ROLES,
  "stock-items": INVENTORY_READ_ROLES["stock-items"],
  "stock-ins": INVENTORY_READ_ROLES["stock-ins"],
  "stock-outs": INVENTORY_READ_ROLES["stock-outs"],
  "stock-movements": INVENTORY_READ_ROLES["stock-movements"],
  "stock-opnames": INVENTORY_READ_ROLES["stock-opnames"],
  "customer-invoices": FINANCE_OPS_READ_ROLES["customer-invoices"],
  "vendor-expenses": FINANCE_OPS_READ_ROLES["vendor-expenses"],
  "vendor-invoices": FINANCE_OPS_READ_ROLES["vendor-invoices"],
  quotations: QUOTATION_READ_ROLES,
  "data-collections": DATA_COLLECTION_READ_ROLES,
};

const isAccessDeniedError = (error: unknown): boolean =>
  Number((error as any)?.response?.status) === 403;

const canReadGenericDataResource = (resource: string, role?: UserRole | null): boolean => {
  if (hasRoleAccess(role, PRIVILEGED_DATA_READ_ROLES)) {
    return true;
  }

  const allowedRoles = GENERIC_DATA_READ_ROLES[resource];
  return Array.isArray(allowedRoles) ? hasRoleAccess(role, allowedRoles) : false;
};

const canReadAppResource = (resource: string, role?: UserRole | null): boolean => {
  const specialAllowedRoles = SPECIAL_RESOURCE_READ_ROLES[resource];
  if (Array.isArray(specialAllowedRoles)) {
    return hasRoleAccess(role, specialAllowedRoles);
  }

  if (Object.prototype.hasOwnProperty.call(GENERIC_DATA_READ_ROLES, resource)) {
    return canReadGenericDataResource(resource, role);
  }

  return true;
};
export type StockDirection = "IN" | "OUT";

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  name?: string | null; // backend
  isActive: boolean; // backend
  createdAt?: string;

  // UI-only
  fullName?: string;
  status?: ActiveStatus;
  phone?: string;
  department?: string;
  lastLogin?: string | null;
}

export interface ProductionTracker {
  id: string;
  customer: string;
  itemType: string;
  qty: number;
  startDate: string;
  finishDate: string;
  status: string;
  machineId?: string;
}

export interface WorkOrder {
  id: string;
  woNumber: string;
  projectId: string;
  projectName: string;
  itemToProduce: string;
  targetQty: number;
  completedQty?: number;
  status: "Draft" | "In Progress" | "QC" | "Completed";
  priority: "Low" | "Normal" | "Urgent";
  deadline: string;
  leadTechnician: string;
  machineId?: string;

  // BOM items must include kode/nama/unit/qty
  bom?: Array<{
    id?: string;
    kode?: string;
    nama?: string;
    materialName?: string;
    qty: number;
    completedQty?: number;
    unit?: string;
  }>;

  startDate?: string;
  endDate?: string;
}

export interface DimensionMeasurement {
  parameter: string;
  specification: string;
  sample1: string;
  sample2: string;
  sample3: string;
  sample4: string;
  result: "OK" | "NG";
}

export interface QCInspection {
  id: string;
  projectId?: string;
  workOrderId?: string;
  woId?: string;
  drawingAssetId?: string;
  tanggal: string;
  batchNo: string;
  itemNama: string;
  qtyInspected: number;
  qtyPassed: number;
  qtyRejected: number;
  inspectorName: string;
  status: "Passed" | "Rejected" | "Partial";
  notes?: string;
  visualCheck: boolean;
  dimensionCheck: boolean;
  materialCheck: boolean;
  photoUrl?: string;
  woNumber?: string;

  // Inspection report fields
  customerName?: string;
  drawingUrl?: string;
  remark?: string;
  dimensions?: DimensionMeasurement[];
}

export interface FieldAttendanceRecord {
  id: string;
  projectId: string;
  workerId: string;
  workerName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: "H" | "A" | "I" | "S";
}

export interface WorkingExpenseRecord {
  id: string;
  projectId: string;
  date: string;
  description: string;
  nominal: number;
  hasNota: boolean;
  remark?: string;
  category: string;
}

export interface MaterialUsageReportItem {
  id: string;
  materialName: string;
  unit: string;
  pengambilan: number;
  terpasang: number;
  sisa: number;
  keterangan?: string;
}

export interface MaterialUsageReport {
  id: string;
  projectId: string;
  reportNumber: string;
  spkNumber: string;
  date: string;
  location: string;
  customerName: string;
  items: MaterialUsageReportItem[];
  preparedBy: string;
  checkedBy: string;
  approvedBy: string;
}

export interface EquipmentUsage {
  id: string;
  projectId: string;
  equipmentId: string;
  equipmentName: string;
  date: string;
  hoursUsed: number;
  operatorName: string;
  fuelConsumption?: number;
  costPerHour: number;
}

export interface ProjectBOQItem {
  materialName: string;
  itemKode?: string;
  qtyEstimate: number;
  qtyActual: number;
  unit: string;
  unitPrice: number;
  supplier?: string;
  status?: string;
}

export interface Project {
  id: string;
  kodeProject?: string;
  namaProject: string;
  customer: string; // UI label. (Relational version would use customerId)
  nilaiKontrak: number;
  status: string;
  progress: number;
  endDate: string;

  budget?: any;
  boq?: ProjectBOQItem[];
  milestones?: any[];

  quotationId?: string;

  fieldAttendance?: FieldAttendanceRecord[];
  workingExpenses?: WorkingExpenseRecord[];
  materialUsageReports?: MaterialUsageReport[];
  equipmentUsage?: EquipmentUsage[];

  materialRequests?: MaterialRequest[];

  approvalStatus?: string;
  approvedBy?: string;
  approvedAt?: string;
  spvApprovedBy?: string;
  spvApprovedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  quotationSnapshot?: {
    id?: string;
    noPenawaran?: string;
    tanggal?: string;
    status?: string;
    kepada?: string;
    perusahaan?: string;
    perihal?: string;
    grandTotal?: number;
    marginPercent?: number;
    paymentTerms?: any;
    commercialTerms?: {
      scopeOfWork?: string[];
      exclusions?: string[];
      [key: string]: any;
    };
    pricingConfig?: any;
    pricingItems?: any;
    sourceType?: string;
    [key: string]: any;
  };
  quotationSnapshotAt?: string;
  quotationSnapshotBy?: string;
}

export interface PurchaseOrder {
  id: string;
  noPO: string;
  tanggal: string;
  supplier: string;
  total: number;
  status: "Draft" | "Pending" | "Sent" | "Approved" | "Partial" | "Received" | "Rejected" | "Cancelled";
  projectId?: string;
  items: Array<{
    id: string;
    kode: string;
    nama: string;
    qty: number;
    unit: string;
    unitPrice: number;
    total: number;
    // legacy compat from old PO UI
    harga?: number;
    qtyReceived?: number;
    source?: string;
    sourceRef?: string;
  }>;
}

/**
 * QUOTATION (SINGLE VERSION)
 * - Keep the enterprise-ish structure (sections)
 * - If you need the old "materials/manpower/equipment" style, you can store it inside sections or a raw payload field.
 */
export interface QuotationSectionItem {
  id: string;
  keterangan: string;
  satuan: string;
  hargaUnit: number;
  jumlah: number; // qty
  total: number;
}

export interface QuotationSection {
  id: string;
  label: string; // I, II, III...
  title: string;
  items: QuotationSectionItem[];
  subtotal: number;
}

export interface Quotation {
  id: string;
  noPenawaran: string; // e.g. 11/A,PEN/GMT/IV/2025
  revisi: string; // A, B, C...
  tanggal: string;
  jenisQuotation: "Jasa" | "Material";

  kepada: string; // company name
  lokasi: string;
  up?: string;

  lampiran?: string;
  perihal: string;

  sections: QuotationSection[];

  totalSebelumDiskon: number;
  diskonPersen: number;
  diskonNominal: number;
  grandTotal: number;

  terms: string[];

  status: DocStatus;
  createdBy: string;
  createdAt: string;
  sentAt?: string;
  approvedAt?: string;

  projectId?: string;
  convertedToPO?: boolean;
  poId?: string;

  sectionsHTML?: string;

  // optional linkage from Survey/DataCollection
  dataCollectionId?: string;
  terminology?: "RAB" | "SOW";
  type?: "Direct" | "Project";

  // legacy UI compatibility fields (old sales pages)
  nomorQuotation?: string;
  customer?: { nama?: string; alamat?: string; pic?: string };
  materials?: any[];
  manpower?: any[];
  equipment?: any[];
  consumables?: any[];
  schedule?: any[];
  ppn?: number;
  notes?: string[];
  kategori?: string;
  tipePekerjaan?: string;
  jenisKontrak?: string;
  dataCollectionRef?: string;
}

export interface StockItem {
  id: string;
  kode: string;
  nama: string;
  stok: number;
  satuan: string;
  kategori: string;
  minStock: number;
  hargaSatuan: number;
  supplier?: string;
  lokasi: string;
  lastUpdate?: string;
  expiryDate?: string;
}

export interface StockInItem {
  kode: string;
  nama: string;
  qty: number;
  satuan: string;
  batchNo?: string;
  expiryDate?: string;
}

export interface StockIn {
  id: string;
  noStockIn: string;
  noSuratJalan?: string;
  supplier?: string;
  projectId?: string;
  projectName?: string;
  tanggal: string;
  type: "Receiving" | "Return" | "Adjustment";
  status: "Posted" | "Draft";
  createdBy: string;
  items: StockInItem[];
  notes?: string;
  noPO?: string;
  poId?: string;
}

export interface StockOutItem {
  kode: string;
  nama: string;
  qty: number;
  satuan: string;
  batchNo?: string;
}

export interface StockOut {
  id: string;
  noStockOut: string;
  noWorkOrder?: string;
  workOrderId?: string;
  productionReportId?: string;
  projectId?: string;
  projectName?: string;
  penerima: string;
  tanggal: string;
  type: "Project Issue" | "Sales" | "Adjustment";
  status: "Posted" | "Draft";
  createdBy: string;
  items: StockOutItem[];
  notes?: string;
}

export interface StockMovement {
  id: string;
  tanggal: string;
  type: StockDirection;
  refNo: string;
  refType: string;
  itemKode: string;
  itemNama: string;
  qty: number;
  unit: string;
  lokasi: string;
  stockBefore: number;
  stockAfter: number;
  createdBy: string;
  productionReportId?: string;
  projectName?: string;
  projectId?: string;
  batchNo?: string;
  expiryDate?: string;
  supplier?: string;
  noPO?: string;
}

export interface StockOpnameItem {
  itemId?: string;
  itemKode: string;
  itemNama: string;
  systemQty: number;
  physicalQty: number;
  difference: number;
  notes?: string;
}

export interface StockOpname {
  id: string;
  noOpname: string;
  tanggal: string;
  lokasi: string;
  status: "Draft" | "Confirmed";
  createdBy: string;
  items: StockOpnameItem[];
  notes?: string;
  confirmedAt?: string;
  confirmedBy?: string;
}

export interface Receiving {
  id: string;
  noReceiving: string;
  noSuratJalan: string;
  tanggal: string;
  noPO: string;
  poId: string;
  supplier: string;
  project: string;
  projectId?: string;
  status: "Pending" | "Partial" | "Complete" | "Rejected";
  items: Array<{
    id?: string;
    itemKode: string;
    itemName: string;
    unit: string;
    qtyReceived?: number;
    qtyGood?: number;
    qty?: number;
  }>;
}

export interface SuratJalan {
  id: string;
  noSurat: string;
  tanggal: string;

  sjType: "Material Delivery" | "Equipment Loan";

  tujuan: string;
  alamat: string;
  upPerson?: string;
  noPO?: string;
  projectId?: string;
  assetId?: string;
  sopir?: string;
  noPolisi?: string;
  pengirim?: string;

  deliveryStatus?: "Pending" | "On Delivery" | "Delivered" | "In Transit" | "Returned";
  podName?: string;
  podTime?: string;
  podPhoto?: string;
  podSignature?: string;

  items: Array<{
    namaItem: string;
    itemKode?: string;
    jumlah: number;
    satuan: string;
    batchNo?: string;
    keterangan?: string;
  }>;

  expectedReturnDate?: string;
  actualReturnDate?: string;
  returnStatus?: "Pending" | "Partial" | "Complete";

  createdAt?: string;
}

export interface BeritaAcara {
  id: string;
  noBA: string;
  tanggal: string;
  jenisBA:
    | "Serah Terima Barang"
    | "Penerimaan Pekerjaan"
    | "Inspeksi"
    | "Rapat"
    | "Pengembalian Alat"
    | "Custom";

  pihakPertama: string;
  pihakPertamaJabatan?: string;
  pihakKedua: string;
  pihakKeduaJabatan?: string;
  lokasi?: string;

  contentHTML: string;

  refSuratJalan?: string;
  refProject?: string;

  ttdPihakPertama?: string;
  ttdPihakKedua?: string;
  saksi1?: string;
  saksi2?: string;

  createdBy?: string;
  createdAt?: string;
  pihakPertamaNama?: string;
  pihakKeduaNama?: string;

  status?: "Draft" | "Final" | "Disetujui";
  projectId?: string;
  projectName?: string;
  noPO?: string;
  tanggalPO?: string;
  tanggalPelaksanaanMulai?: string;
  tanggalPelaksanaanSelesai?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface Invoice {
  id: string;
  noInvoice: string;
  tanggal: string;
  jatuhTempo: string;
  customer: string;
  alamat: string;
  noPO: string;
  items: Array<{
    deskripsi: string;
    qty: number;
    unit: string;
    hargaSatuan: number;
    total: number;
    sourceRef?: string;
    batchNo?: string;
  }>;
  subtotal: number;
  ppn: number;
  totalBayar: number;
  status: "Unpaid" | "Partial" | "Paid";
  projectId?: string;
  buktiTransfer?: string;
  noKwitansi?: string;
  tanggalBayar?: string;
}

export interface ProductionReport {
  id: string;
  tanggal: string;
  shift: string;
  workshop: string;
  workerName: string;
  activity: string;
  machineNo?: string;
  startTime: string;
  endTime: string;
  outputQty: number;
  unit: string;
  remarks?: string;
  photoUrl?: string;
  photoAssetId?: string;
  woNumber?: string;
  woId?: string;
  selectedItem?: string;
}

/**
 * MATERIAL REQUEST (SINGLE VERSION)
 * - Your old code had conflicting structures. This is the cleaned version.
 */
export interface MaterialRequestItem {
  id: string;
  itemKode: string;
  itemNama: string;
  qty: number;
  unit: string;
}

export interface MaterialRequest {
  id: string;
  noRequest: string;
  projectId: string;
  projectName: string;
  requestedBy: string;
  requestedAt: string;
  status: "Pending" | "Approved" | "Issued" | "Rejected" | "Ordered" | "Delivered";
  items: MaterialRequestItem[];
}

export interface MaintenanceRecord {
  id: string;
  assetId?: string;
  projectId?: string;
  maintenanceNo: string;
  equipmentName: string;
  assetCode: string;
  maintenanceType: "Routine" | "Repair" | "Overhaul";
  scheduledDate?: string;
  completedDate?: string;
  status: "Scheduled" | "In Progress" | "Completed";
  cost: number;
  performedBy: string;
  notes?: string;
}

export interface DataCollection {
  id: string;
  noKoleksi: string;
  namaResponden: string;
  kategori: string;
  tanggalPengumpulan: string;
  lokasi: string;
  namaKolektor: string;
  tipePekerjaan: string;
  jenisKontrak: string;
  dataFields?: any[];
  materials?: any[];
  manpower?: any[];
  schedule?: any[];
  consumables?: any[];
  equipment?: any[];
  scopeOfWork?: string[];
  exclusions?: string[];
  status: "Draft" | "Verified" | "Completed";
  notes?: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  tags?: string[];
  signature?: string;
}

export interface Payroll {
  id: string;
  month: string;
  year: number;
  totalPayroll: number;
  status: "Pending" | "Approved" | "Disbursed";
  employeeCount: number;
  employeeName?: string;
  employeeId?: string;
  baseSalary?: number;
  totalOutput?: number;
  incentiveTotal?: number;
  allowanceTotal?: number;
  totalGaji?: number;
}

export interface VendorInvoice {
  id: string;
  noInvoiceVendor: string;
  supplier: string;
  noPO: string;
  totalAmount: number;
  paidAmount: number;
  status: "Unpaid" | "Partial" | "Paid" | "Overdue";
  jatuhTempo: string;
  projectId?: string;
  purchaseOrderId?: string;
  vendorId?: string;
  ppn?: number;
}

export interface SuratMasuk {
  id: string;
  noSurat: string;
  tanggalTerima: string;
  tanggalSurat: string;
  pengirim: string;
  perihal: string;
  jenisSurat: string;
  prioritas: "Low" | "Normal" | "High" | "Urgent";
  status: "Baru" | "Disposisi" | "Proses" | "Selesai";
  penerima: string;
  kategori: string;
  disposisiKe?: string;
  catatan?: string;
  projectId?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface SuratKeluar {
  id: string;
  noSurat: string;
  tanggalSurat: string;
  tujuan: string;
  perihal: string;
  jenisSurat: string;
  pembuat: string;
  status: "Draft" | "Review" | "Approved" | "Sent";
  kategori: string;
  isiSurat?: string;
  projectId?: string;
  approvedBy?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  tglKirim?: string;
  notes?: string;
  templateId?: string;
}

export interface TemplateSurat {
  id: string;
  nama: string;
  jenisSurat: string;
  content: string;
  variables?: string[];
}

export interface Vendor {
  id: string;
  kodeVendor: string;
  namaVendor: string;
  kategori: "Material" | "Equipment" | "Service" | "Subcontractor";
  alamat?: string;
  kontak?: string;
  telepon?: string;
  email?: string;
  npwp?: string;
  paymentTerms?: string;
  status: ActiveStatus;
  rating: number; // 1-5
  createdAt: string;
}

export interface VendorExpense {
  id: string;
  noExpense: string;
  tanggal: string;
  vendorId: string;
  vendorName: string;
  projectId?: string;
  projectName?: string;
  rabItemId?: string;
  rabItemName?: string;
  kategori:
    | "Material"
    | "Equipment"
    | "Service"
    | "Transport"
    | "Manpower"
    | "Tools"
    | "Consumables"
    | "Other";
  keterangan: string;
  nominal: number;
  ppn?: number;
  totalNominal: number;
  hasKwitansi: boolean;
  kwitansiUrl?: string;
  noKwitansi?: string;
  metodeBayar: PaymentMethod;
  status: "Draft" | "Pending Approval" | "Approved" | "Rejected" | "Paid";
  remark?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectReason?: string;
  paidAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  kodeCustomer: string;
  namaCustomer: string;
  alamat: string;
  kota: string;
  kontak: string;
  telepon: string;
  email: string;
  npwp?: string;
  paymentTerms: string;
  rating: number;
  status: ActiveStatus;
  createdAt: string;
}

export interface InvoicePayment {
  id: string;
  tanggal: string;
  nominal: number;
  metodeBayar: PaymentMethod;
  noBukti?: string;
  bankName?: string;
  remark?: string;
  createdBy: string;
  createdAt: string;
}

export interface CustomerInvoice {
  id: string;
  noInvoice: string;
  tanggal: string;
  dueDate: string;
  customerId: string;
  customerName: string;
  projectId?: string;
  projectName?: string;
  perihal: string;
  items: Array<{
    id: string;
    deskripsi: string;
    qty: number;
    satuan: string;
    hargaSatuan: number;
    jumlah: number;
  }>;
  subtotal: number;
  ppn: number;
  pph: number;
  totalNominal: number;
  paidAmount: number;
  outstandingAmount: number;
  status: InvoiceStatus;
  paymentHistory: InvoicePayment[];
  noKontrak?: string;
  noPO?: string;
  termin?: string;
  remark?: string;
  createdBy: string;
  createdAt: string;
  sentAt?: string;
}

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  identityType?: "KTP" | "SIM" | "PASSPORT" | "OTHER";
  identityNumber?: string;
  familyStatusCode?: string; // e.g. K/0, K/1, TK/0
  gender?: "L" | "P";
  birthDate?: string;
  birthPlace?: string;
  motherName?: string;
  occupationTypeCode?: string;
  occupationName?: string;
  alternativeOccupationName?: string;
  startWorkDate?: string;
  position: string;
  department: string;
  employmentType: "Permanent" | "Contract" | "THL" | "Internship";
  joinDate: string;
  endDate?: string;
  email: string;
  phone: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  salary: number;
  status: "Active" | "Inactive" | "Resigned";
  bank?: string;
  bankAccount?: string;
  npwp?: string;
  bpjsKesehatan?: string;
  bpjsKetenagakerjaan?: string;
  leaveQuota?: number;
}

export interface Attendance {
  id: string;
  employeeId: string;
  projectId?: string;
  employeeName: string;
  date: string;
  status: "Present" | "Late" | "Absent" | "Leave" | "Sick" | "Permission";
  checkIn?: string;
  checkOut?: string;
  workHours?: number;
  overtime?: number;
  location?: string;
  notes?: string;
}

export interface Asset {
  id: string;
  projectId?: string;
  assetCode: string;
  name: string;
  category: string;
  location: string;
  status: "Available" | "Under Maintenance" | "In Use" | "Scrapped";
  condition: "Good" | "Fair" | "Poor";
  purchaseDate?: string;
  purchasePrice?: number;
  rentalPrice?: number;
  lastMaintenance?: string;
  nextMaintenance?: string;
  operatorName?: string;
  projectName?: string;
  rentedTo?: string;
  notes?: string;
}

export interface ArchiveEntry {
  id: string;
  date: string;
  ref: string;
  description: string;
  amount: number;
  project: string;
  admin: string;
  type: "AR" | "AP" | "PETTY" | "BK";
  source: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  details: string;
  status: "Success" | "Failed" | "Warning";
  domain?: string;
  resource?: string;
  entityId?: string;
  operation?: string;
  actorUserId?: string;
  actorRole?: string;
  metadata?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppContextType {
  projectList: Project[];
  invoiceList: Invoice[];
  stockItemList: StockItem[];
  employeeList: Employee[];
  attendanceList: Attendance[];
  workOrderList: WorkOrder[];
  productionReportList: ProductionReport[];
  productionTrackerList: ProductionTracker[];
  qcInspectionList: QCInspection[];
  stockInList: StockIn[];
  stockOutList: StockOut[];
  stockOpnameList: StockOpname[];
  stockMovementList: StockMovement[];
  receivingList: Receiving[];
  suratJalanList: SuratJalan[];
  assetList: Asset[];
  quotationList: Quotation[];
  poList: PurchaseOrder[];
  vendorInvoiceList: VendorInvoice[];
  userList: User[];
  materialRequestList: MaterialRequest[];
  maintenanceList: MaintenanceRecord[];
  dataCollectionList: DataCollection[];
  payrollList: Payroll[];
  suratMasukList: SuratMasuk[];
  suratKeluarList: SuratKeluar[];
  beritaAcaraList: BeritaAcara[];
  templateSuratList: TemplateSurat[];
  archiveRegistry: ArchiveEntry[];
  auditLogs: AuditLog[];
  vendorList: Vendor[];
  expenseList: VendorExpense[];
  customerList: Customer[];
  customerInvoiceList: CustomerInvoice[];
  currentUser: User | null;

  alerts: any[];
  markAlertAsRead: (id: string) => void;

  login: (username: string, password: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  resetAllData: () => void;

  addAuditLog: (log: Omit<AuditLog, "id" | "timestamp" | "userId" | "userName">) => void;

  updateUser: (id: string, updates: Partial<User>) => void;
  updateProject: (id: string, updates: Partial<Project>) => Promise<boolean>;

  addEmployee: (e: Employee) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;

  addAttendance: (a: Attendance) => Promise<boolean>;
  addAttendanceBulk: (a: Attendance[]) => Promise<boolean>;
  updateAttendance: (id: string, updates: Partial<Attendance>) => void;
  deleteAttendance: (id: string) => void;

  recordProduction: (woId: string, qty: number) => Promise<void>;
  addQCInspection: (inspection: QCInspection) => void;

  addWorkOrder: (wo: WorkOrder) => Promise<void>;
  updateWorkOrder: (id: string, updates: Partial<WorkOrder>) => Promise<void>;
  deleteWorkOrder: (id: string) => Promise<void>;

  createStockOut: (so: StockOut) => Promise<void>;
  createStockIn: (si: StockIn) => Promise<void>;
  addStockIn: (si: StockIn) => Promise<void>;
  addStockOut: (so: StockOut) => Promise<void>;
  addStockOpname: (opname: StockOpname) => Promise<void>;
  confirmStockOpname: (id: string) => Promise<void>;

  addReceiving: (rcv: Receiving) => Promise<void>;

  addInvoice: (inv: Invoice) => Promise<void>;
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  addPO: (po: PurchaseOrder) => Promise<void>;

  addProductionReport: (report: ProductionReport) => void;
  handleProductionOutput: (
    woId: string,
    qty: number,
    workerName: string,
    options?: { selectedItem?: string; productionReportId?: string }
  ) => void;

  updatePO: (id: string, updates: Partial<PurchaseOrder>) => Promise<void>;
  approveProject: (id: string, ownerName: string) => Promise<void>;
  rejectProject: (id: string, ownerName: string, reason?: string) => Promise<void>;
  unlockProject: (id: string, reason?: string) => Promise<void>;
  relockProject: (id: string) => Promise<void>;

  updateMaterialRequest: (id: string, updates: Partial<MaterialRequest>) => Promise<void>;
  issueMaterialRequest: (id: string, issuedBy: string) => void;

  addDataCollection: (dc: DataCollection) => void;
  updateDataCollection: (id: string, updates: Partial<DataCollection>) => void;
  deleteDataCollection: (id: string) => void;

  addProject: (p: Project) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;

  addQuotation: (q: Quotation) => Promise<void>;
  updateQuotation: (id: string, updates: Partial<Quotation>) => Promise<void>;
  deleteQuotation: (id: string) => void;

  addVendorInvoice: (inv: VendorInvoice) => Promise<boolean>;
  updateVendorInvoice: (id: string, updates: Partial<VendorInvoice>) => Promise<boolean>;

  generatePayroll: (month: string, year: string) => void;

  addSuratMasuk: (s: SuratMasuk) => Promise<boolean>;
  updateSuratMasuk: (id: string, updates: Partial<SuratMasuk>) => Promise<boolean>;
  deleteSuratMasuk: (id: string) => Promise<boolean>;

  addSuratKeluar: (s: SuratKeluar) => Promise<boolean>;
  updateSuratKeluar: (id: string, updates: Partial<SuratKeluar>) => Promise<boolean>;
  deleteSuratKeluar: (id: string) => Promise<boolean>;

  addBeritaAcara: (ba: BeritaAcara) => Promise<boolean>;
  updateBeritaAcara: (id: string, updates: Partial<BeritaAcara>) => Promise<boolean>;
  deleteBeritaAcara: (id: string) => Promise<boolean>;

  addSuratJalan: (sj: SuratJalan) => Promise<boolean>;
  updateSuratJalan: (id: string, updates: Partial<SuratJalan>) => Promise<boolean>;
  deleteSuratJalan: (id: string) => Promise<boolean>;

  addAsset: (a: Asset) => Promise<void>;
  addMaintenance: (m: MaintenanceRecord) => Promise<void>;
  updateAsset: (id: string, updates: Partial<Asset>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;

  addArchiveEntry: (entry: Omit<ArchiveEntry, "id">) => Promise<ArchiveEntry>;
  addEquipmentUsage: (usage: EquipmentUsage) => void;

  addMaterialRequest: (request: MaterialRequest) => void;
  updateMaterialRequestStatus: (
    projectId: string,
    requestId: string,
    status: MaterialRequest["status"]
  ) => void;

  applyTemplate: (templateId: string, variables: Record<string, string>) => string;

  updateReservedStock: (materials: Array<{ kode: string; qty: number }>, type: "reserve" | "release") => void;

  setStockItemList: React.Dispatch<React.SetStateAction<StockItem[]>>;
  setStockMovementList: React.Dispatch<React.SetStateAction<StockMovement[]>>;
  setPoList: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;

  convertDataCollectionToQuotation: (dcId: string) => void;
  convertQuotationToProject: (quoId: string) => void;

  addVendor: (vendor: Vendor) => Promise<boolean>;
  updateVendor: (id: string, updates: Partial<Vendor>) => Promise<boolean>;
  deleteVendor: (id: string) => Promise<boolean>;

  addExpense: (expense: VendorExpense) => Promise<boolean>;
  updateExpense: (id: string, updates: Partial<VendorExpense>) => Promise<boolean>;
  deleteExpense: (id: string) => Promise<boolean>;
  approveExpense: (id: string, approver: string) => Promise<boolean>;
  rejectExpense: (id: string, reason: string) => Promise<boolean>;

  addCustomer: (customer: Customer) => Promise<boolean>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<boolean>;
  deleteCustomer: (id: string) => Promise<boolean>;

  addCustomerInvoice: (invoice: CustomerInvoice) => Promise<boolean>;
  updateCustomerInvoice: (id: string, updates: Partial<CustomerInvoice>) => Promise<boolean>;
  deleteCustomerInvoice: (id: string) => Promise<boolean>;
  addInvoicePayment: (invoiceId: string, payment: InvoicePayment) => Promise<boolean>;
}

/**
 * =========================
 *  CONTEXT
 * =========================
 */

const AppContext = createContext<AppContextType | undefined>(undefined);

const uid = (prefix = "ID") => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const todayISO = () => new Date().toISOString().split("T")[0];
const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const normalizeQuotationStatus = (value: unknown): DocStatus => {
  const raw = String(value || "").toUpperCase();
  if (raw === "DRAFT") return "Draft";
  if (raw === "SENT") return "Sent";
  if (raw === "APPROVED") return "Approved";
  if (raw === "REJECTED") return "Rejected";
  if (raw === "REVISED") return "Revised";
  if (raw === "FINAL") return "Final";
  if (raw === "REVIEW") return "Review";
  if (raw === "CANCELLED") return "Cancelled";
  return "Draft";
};

const normalizeQuotationForUi = (input: unknown): Quotation => {
  const src =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, any>)
      : {};

  const id = typeof src.id === "string" && src.id.trim() ? src.id : uid("QUO");
  const noPenawaranRaw = typeof src.noPenawaran === "string" && src.noPenawaran.trim()
    ? src.noPenawaran
    : typeof src.nomorQuotation === "string" && src.nomorQuotation.trim()
      ? src.nomorQuotation
      : `QUO/GTP/${new Date().getFullYear()}/${String(Date.now()).slice(-4)}`;

  const customer =
    src.customer && typeof src.customer === "object" && !Array.isArray(src.customer)
      ? (src.customer as Record<string, any>)
      : {};

  const customerNama =
    (typeof customer.nama === "string" && customer.nama.trim()) ||
    (typeof src.kepada === "string" && src.kepada.trim()) ||
    (typeof src.perusahaan === "string" && src.perusahaan.trim()) ||
    "";
  const customerAlamat =
    (typeof customer.alamat === "string" && customer.alamat.trim()) ||
    (typeof src.lokasi === "string" && src.lokasi.trim()) ||
    "";
  const customerPic =
    (typeof customer.pic === "string" && customer.pic.trim()) ||
    (typeof src.up === "string" && src.up.trim()) ||
    "";

  return {
    ...src,
    id,
    noPenawaran: noPenawaranRaw,
    nomorQuotation:
      (typeof src.nomorQuotation === "string" && src.nomorQuotation.trim()) || noPenawaranRaw,
    revisi: (typeof src.revisi === "string" && src.revisi.trim()) || "A",
    tanggal: (typeof src.tanggal === "string" && src.tanggal.trim()) || todayISO(),
    jenisQuotation: src.jenisQuotation === "Material" ? "Material" : "Jasa",
    kepada: (typeof src.kepada === "string" && src.kepada.trim()) || customerNama,
    perusahaan: (typeof src.perusahaan === "string" && src.perusahaan.trim()) || customerNama,
    lokasi: (typeof src.lokasi === "string" && src.lokasi.trim()) || customerAlamat,
    up: (typeof src.up === "string" && src.up.trim()) || customerPic,
    perihal: (typeof src.perihal === "string" && src.perihal.trim()) || "",
    sections: Array.isArray(src.sections) ? src.sections : [],
    totalSebelumDiskon: toFiniteNumber(src.totalSebelumDiskon ?? src.subtotal, 0),
    diskonPersen: toFiniteNumber(src.diskonPersen ?? src.discount, 0),
    diskonNominal: toFiniteNumber(src.diskonNominal, 0),
    grandTotal: toFiniteNumber(src.grandTotal ?? src.totalBayar ?? src.subtotal, 0),
    terms: Array.isArray(src.terms) ? src.terms : [],
    status: normalizeQuotationStatus(src.status),
    createdBy:
      (typeof src.createdBy === "string" && src.createdBy.trim()) || "System",
    createdAt:
      (typeof src.createdAt === "string" && src.createdAt.trim()) || new Date().toISOString(),
    customer: {
      nama: customerNama,
      alamat: customerAlamat,
      pic: customerPic,
    },
    materials: Array.isArray(src.materials) ? src.materials : [],
    manpower: Array.isArray(src.manpower) ? src.manpower : [],
    equipment: Array.isArray(src.equipment) ? src.equipment : [],
    consumables: Array.isArray(src.consumables) ? src.consumables : [],
    schedule: Array.isArray(src.schedule) ? src.schedule : [],
    ppn: toFiniteNumber(src.ppn, 11),
    notes: Array.isArray(src.notes) ? src.notes : [],
    kategori: (typeof src.kategori === "string" && src.kategori.trim()) || "",
    tipePekerjaan: (typeof src.tipePekerjaan === "string" && src.tipePekerjaan.trim()) || "",
    jenisKontrak: (typeof src.jenisKontrak === "string" && src.jenisKontrak.trim()) || "",
    dataCollectionId:
      (typeof src.dataCollectionId === "string" && src.dataCollectionId.trim()) ||
      (typeof src.dataCollectionRef === "string" && src.dataCollectionRef.trim()) ||
      undefined,
    dataCollectionRef:
      (typeof src.dataCollectionRef === "string" && src.dataCollectionRef.trim()) ||
      (typeof src.dataCollectionId === "string" && src.dataCollectionId.trim()) ||
      undefined,
  } as Quotation;
};

const normalizeQuotationForApi = (input: unknown): Record<string, unknown> => {
  const q = normalizeQuotationForUi(input);
  return {
    ...q,
    noPenawaran: q.noPenawaran || q.nomorQuotation || "",
    nomorQuotation: q.nomorQuotation || q.noPenawaran || "",
    customer: q.customer || { nama: q.kepada || "", alamat: q.lokasi || "", pic: q.up || "" },
    kepada: q.kepada || q.customer?.nama || "",
    perusahaan: q.perusahaan || q.customer?.nama || "",
    lokasi: q.lokasi || q.customer?.alamat || "",
    up: q.up || q.customer?.pic || "",
    dataCollectionId: q.dataCollectionId || q.dataCollectionRef || undefined,
    dataCollectionRef: q.dataCollectionRef || q.dataCollectionId || undefined,
  };
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  /**
   * =========================
   *  STATE
   * =========================
   */
  const [currentUser, setCurrentUser] = useState<User | null>(() => readPersistedAuthUser());
  const [userList, setUserList] = useState<User[]>([]);

  const [projectList, setProjectList] = useState<Project[]>([]);
  const [invoiceList, setInvoiceList] = useState<Invoice[]>([]);
  const [quotationList, setQuotationList] = useState<Quotation[]>([]);
  const [poList, setPoList] = useState<PurchaseOrder[]>([]);
  const [receivingList, setReceivingList] = useState<Receiving[]>([]);

  const [stockItemList, setStockItemList] = useState<StockItem[]>([]);
  const [stockMovementList, setStockMovementList] = useState<StockMovement[]>([]);
  const [stockInList, setStockInList] = useState<StockIn[]>([]);
  const [stockOutList, setStockOutList] = useState<StockOut[]>([]);
  const [stockOpnameList, setStockOpnameList] = useState<StockOpname[]>([]);

  const [workOrderList, setWorkOrderList] = useState<WorkOrder[]>([]);
  const [productionReportList, setProductionReportList] = useState<ProductionReport[]>([]);
  const [productionTrackerList, setProductionTrackerList] = useState<ProductionTracker[]>([]);
  const [qcInspectionList, setQcInspectionList] = useState<QCInspection[]>([]);

  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);

  const [suratJalanList, setSuratJalanList] = useState<SuratJalan[]>([]);
  const [beritaAcaraList, setBeritaAcaraList] = useState<BeritaAcara[]>([]);
  const [suratMasukList, setSuratMasukList] = useState<SuratMasuk[]>([]);
  const [suratKeluarList, setSuratKeluarList] = useState<SuratKeluar[]>([]);
  const [templateSuratList, setTemplateSuratList] = useState<TemplateSurat[]>([]);

  const [assetList, setAssetList] = useState<Asset[]>([]);
  const [maintenanceList, setMaintenanceList] = useState<MaintenanceRecord[]>([]);

  const [materialRequestList, setMaterialRequestList] = useState<MaterialRequest[]>([]);
  const [dataCollectionList, setDataCollectionList] = useState<DataCollection[]>([]);
  const [payrollList, setPayrollList] = useState<Payroll[]>([]);

  const [archiveRegistry, setArchiveRegistry] = useState<ArchiveEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [vendorList, setVendorList] = useState<Vendor[]>([]);
  const [expenseList, setExpenseList] = useState<VendorExpense[]>([]);
  const [vendorInvoiceList, setVendorInvoiceList] = useState<VendorInvoice[]>([]);

  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [customerInvoiceList, setCustomerInvoiceList] = useState<CustomerInvoice[]>([]);

  const [alerts, setAlerts] = useState<any[]>([]);
  const hasHydratedFromBackend = useRef(false);
  const isSyncingToBackend = useRef(false);
  const canPersistToBackend = useRef(false);
  const hasInitializedAutoSyncSnapshot = useRef(false);
  const lastSyncedSignaturesRef = useRef<Record<string, string>>({});
  const coreLinkedRefreshInFlightRef = useRef(false);
  const realtimeRefreshInFlightRef = useRef(false);
  const lastCoreLinkedRefreshAtRef = useRef(0);

  const listSignature = (value: unknown): string => {
    try {
      return JSON.stringify(value);
    } catch {
      return String(Date.now());
    }
  };

  const normalizeRef = (value?: string | null) => String(value || "").trim().toLowerCase();

  const isActiveWorkOrderStatus = (status?: WorkOrder["status"]) =>
    status === "Draft" || status === "In Progress" || status === "QC";
  const isActiveDeliveryStatus = (status?: SuratJalan["deliveryStatus"]) =>
    status === "Pending" || status === "On Delivery" || status === "In Transit";
  const isActiveMaintenanceStatus = (status?: MaintenanceRecord["status"]) =>
    status === "Scheduled" || status === "In Progress";

  const isAssetMatchedByMachineRef = (asset: Asset, machineRef?: string) => {
    const ref = normalizeRef(machineRef);
    if (!ref) return false;
    return (
      normalizeRef(asset.id) === ref ||
      normalizeRef(asset.assetCode) === ref ||
      normalizeRef(asset.name) === ref
    );
  };

  const isAssetMatchedByPlateRef = (asset: Asset, plateRef?: string) => {
    const ref = normalizeRef(plateRef);
    if (!ref) return false;
    return normalizeRef(asset.assetCode) === ref || normalizeRef(asset.name) === ref;
  };

  const findAssetByMachineRef = (machineRef?: string, assets: Asset[] = assetList) =>
    assets.find((asset) => isAssetMatchedByMachineRef(asset, machineRef));

  const findAssetByPlateRef = (plateRef?: string, assets: Asset[] = assetList) =>
    assets.find((asset) => isAssetMatchedByPlateRef(asset, plateRef));

  const findAssetBySuratJalanRef = (sj?: Partial<SuratJalan> | null, assets: Asset[] = assetList) => {
    const assetIdRef = normalizeRef(sj?.assetId);
    if (assetIdRef) {
      const byId = assets.find((asset) => normalizeRef(asset.id) === assetIdRef);
      if (byId) return byId;
    }
    return findAssetByPlateRef(sj?.noPolisi, assets);
  };

  const hasActiveWorkOrderForAsset = (asset: Asset, workOrders: WorkOrder[]) =>
    workOrders.some((wo) => isActiveWorkOrderStatus(wo.status) && isAssetMatchedByMachineRef(asset, wo.machineId));

  const hasActiveDeliveryForAsset = (asset: Asset, suratJalans: SuratJalan[]) =>
    suratJalans.some((sj) => {
      if (!isActiveDeliveryStatus(sj.deliveryStatus ?? "Pending")) return false;
      return normalizeRef(sj.assetId) === normalizeRef(asset.id) || isAssetMatchedByPlateRef(asset, sj.noPolisi);
    });

  const hasActiveMaintenanceForAsset = (asset: Asset, maintenances: MaintenanceRecord[] = maintenanceList) =>
    maintenances.some(
      (record) =>
        isActiveMaintenanceStatus(record.status) &&
        (normalizeRef(record.assetCode) === normalizeRef(asset.assetCode) ||
          normalizeRef(record.equipmentName) === normalizeRef(asset.name))
    );

  const getIdleAssetStatus = (
    asset: Asset,
    workOrders: WorkOrder[],
    suratJalans: SuratJalan[],
    maintenances: MaintenanceRecord[]
  ): Asset["status"] => {
    if (hasActiveMaintenanceForAsset(asset, maintenances)) return "Under Maintenance";
    if (hasActiveWorkOrderForAsset(asset, workOrders)) return "In Use";
    if (hasActiveDeliveryForAsset(asset, suratJalans)) return "In Use";
    return "Available";
  };

  const syncAssetLinkedUpdate = (assetId: string, updates: Partial<Asset>) => {
    let prevSnapshot: Asset | undefined;
    let mergedPayload: Asset | undefined;
    setAssetList((prev) =>
      prev.map((item) => {
        if (item.id !== assetId) return item;
        prevSnapshot = item;
        mergedPayload = { ...item, ...updates };
        return mergedPayload;
      })
    );
    if (!mergedPayload) return;
    api
      .patch(`/assets/${assetId}`, mergedPayload)
      .then((res) => {
        const saved = (res?.data || mergedPayload) as Asset;
        setAssetList((prev) => prev.map((item) => (item.id === assetId ? saved : item)));
      })
      .catch((err) => {
        console.error("Failed to sync linked asset update:", err);
        if (prevSnapshot) {
          setAssetList((prev) => prev.map((item) => (item.id === assetId ? prevSnapshot! : item)));
        }
      });
  };

  /**
   * =========================
   *  AUTH: bootstrap from AuthContext state
   * =========================
   */
  useEffect(() => {
    syncCurrentUserFromAuthState();
  }, []);

  useEffect(() => {
    const handleAuthStateChange = () => {
      syncCurrentUserFromAuthState();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "user") return;
      syncCurrentUserFromAuthState();
    };

    window.addEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthStateChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(AUTH_STATE_CHANGE_EVENT, handleAuthStateChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const loadResource = async <T,>(
    resource: string,
    setter: React.Dispatch<React.SetStateAction<T[]>>
  ) => {
    if (!canReadAppResource(resource, currentUser?.role)) {
      setter([]);
      return;
    }

    const resourceEndpoints: Record<string, string> = {
      "stock-items": "/inventory/items",
      "stock-ins": "/inventory/stock-ins",
      "stock-outs": "/inventory/stock-outs",
      "stock-movements": "/inventory/movements",
      "stock-opnames": "/inventory/stock-opnames",
      "work-orders": "/work-orders",
      "material-requests": "/material-requests",
      "production-reports": "/production-reports",
      "production-trackers": "/production-trackers",
      "qc-inspections": "/qc-inspections",
      "surat-jalan": "/surat-jalan",
      "proof-of-delivery": "/proof-of-delivery",
      "berita-acara": "/berita-acara",
      "spk-records": "/spk-records",
      "purchase-orders": "/purchase-orders",
      receivings: "/receivings",
      "working-expense-sheets": "/finance/working-expense-sheets",
      "customer-invoices": "/finance/customer-invoices",
      "vendor-expenses": "/finance/vendor-expenses",
      "vendor-invoices": "/finance/vendor-invoices",
      invoices: "/invoices",
      "surat-masuk": "/surat-masuk",
      "surat-keluar": "/surat-keluar",
      "template-surat": "/template-surat",
      "hr-leaves": "/hr-leaves",
      "hr-online-status": "/hr-online-status",
      "audit-logs": "/audit-logs",
      "archive-registry": "/archive-registry",
      vendors: "/vendors",
      customers: "/customers",
      employees: "/employees",
      attendances: "/attendances",
      "hr-shifts": "/hr-shifts",
      "hr-shift-schedules": "/hr-shift-schedules",
      "hr-attendance-summaries": "/hr-attendance-summaries",
      "hr-performance-reviews": "/hr-performance-reviews",
      "hr-thl-contracts": "/hr-thl-contracts",
      "hr-resignations": "/hr-resignations",
      assets: "/assets",
      maintenances: "/maintenances",
      payrolls: "/payrolls",
      "finance-bpjs-payments": "/finance-bpjs-payments",
      "finance-pph21-filings": "/finance-pph21-filings",
      "finance-thr-disbursements": "/finance-thr-disbursements",
      "finance-employee-allowances": "/finance-employee-allowances",
      "finance-po-payments": "/finance-po-payments",
      kasbons: "/hr/kasbons",
      "fleet-health": "/fleet-health",
    };
    try {
      const res = await api.get(resourceEndpoints[resource] || `/data/${resource}`);
      const rows = Array.isArray(res.data) ? res.data : [];

      const items = rows.map((row: any) => {
        const payload = row?.payload ?? row ?? {};
        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
          const payloadId = typeof payload.id === "string" && payload.id.trim() ? payload.id : null;
          const entityId = typeof row?.entityId === "string" && row.entityId.trim() ? row.entityId : null;
          const rowId = typeof row?.id === "string" && row.id.trim() ? row.id : null;
          return { ...(payload as Record<string, unknown>), id: payloadId || entityId || rowId } as T;
        }
        return payload as T;
      });

      setter(items);
    } catch (error) {
      if (isAccessDeniedError(error)) {
        setter([]);
        return;
      }
      throw error;
    }
  };

  const loadProjects = async () => {
    if (!canReadAppResource("projects", currentUser?.role)) {
      setProjectList([]);
      return;
    }

    try {
      const res = await api.get("/projects");
      const items = Array.isArray(res.data) ? (res.data as Project[]) : [];
      setProjectList(items);
    } catch (error) {
      if (isAccessDeniedError(error)) {
        setProjectList([]);
        return;
      }
      throw error;
    }
  };

  const loadPurchaseOrders = async () => {
    await loadResource<PurchaseOrder>("purchase-orders", setPoList);
  };

  const loadReceivings = async () => {
    await loadResource<Receiving>("receivings", setReceivingList);
  };

  const loadWorkOrders = async () => {
    await loadResource<WorkOrder>("work-orders", setWorkOrderList);
  };

  const loadEmployees = async () => {
    await loadResource<Employee>("employees", setEmployeeList);
  };

  const loadAttendances = async () => {
    await loadResource<Attendance>("attendances", setAttendanceList);
  };

  const loadStockIns = async () => {
    await loadResource<StockIn>("stock-ins", setStockInList);
  };

  const loadStockOuts = async () => {
    await loadResource<StockOut>("stock-outs", setStockOutList);
  };

  const loadStockMovements = async () => {
    await loadResource<StockMovement>("stock-movements", setStockMovementList);
  };

  const loadSuratJalan = async () => {
    await loadResource<SuratJalan>("surat-jalan", setSuratJalanList);
  };

  const loadMaterialRequests = async () => {
    await loadResource<MaterialRequest>("material-requests", setMaterialRequestList);
  };

  const loadDataCollections = async () => {
    if (!canReadDataCollections(currentUser?.role)) {
      setDataCollectionList([]);
      return;
    }

    try {
      const res = await api.get("/data-collections");
      const items = Array.isArray(res.data) ? (res.data as DataCollection[]) : [];
      setDataCollectionList(items);
    } catch (error) {
      if (isAccessDeniedError(error)) {
        setDataCollectionList([]);
        return;
      }
      throw error;
    }
  };

  const loadQuotations = async () => {
    if (!canReadQuotations(currentUser?.role)) {
      setQuotationList([]);
      return;
    }

    try {
      const res = await api.get("/quotations");
      const items = Array.isArray(res.data)
        ? (res.data as unknown[]).map((item) => normalizeQuotationForUi(item))
        : [];
      setQuotationList(items);
    } catch (error) {
      if (isAccessDeniedError(error)) {
        setQuotationList([]);
        return;
      }
      throw error;
    }
  };

  const refreshCoreLinkedData = async () => {
    if (!currentUser) return;
    if (coreLinkedRefreshInFlightRef.current) return;

    const now = Date.now();
    if (now - lastCoreLinkedRefreshAtRef.current < 1500) return;
    coreLinkedRefreshInFlightRef.current = true;
    lastCoreLinkedRefreshAtRef.current = now;

    try {
      await Promise.all([
        loadProjects(),
        loadQuotations(),
        loadWorkOrders(),
        loadMaterialRequests(),
        loadPurchaseOrders(),
        loadResource<Invoice>("invoices", setInvoiceList),
      ]);
    } finally {
      coreLinkedRefreshInFlightRef.current = false;
    }
  };

  const refreshRealtimeCoreData = async () => {
    if (!currentUser) return;
    if (realtimeRefreshInFlightRef.current) return;
    realtimeRefreshInFlightRef.current = true;

    try {
      // Keep realtime pull lightweight to avoid tripping backend rate limiter.
      await Promise.all([
        loadProjects(),
        loadWorkOrders(),
        loadResource<StockItem>("stock-items", setStockItemList),
      ]);
    } finally {
      realtimeRefreshInFlightRef.current = false;
    }
  };

  const saveResource = async <T extends Record<string, any>>(
    resource: string,
    list: T[]
  ) => {
    const directBulkEndpoints: Record<string, string> = {
      invoices: "/invoices",
      "surat-masuk": "/surat-masuk",
      "template-surat": "/template-surat",
      "surat-keluar": "/surat-keluar",
      "hr-leaves": "/hr-leaves",
      "hr-online-status": "/hr-online-status",
      assets: "/assets",
      maintenances: "/maintenances",
      payrolls: "/payrolls",
    };
    if (directBulkEndpoints[resource]) {
      await api.put(`${directBulkEndpoints[resource]}/bulk`, list.map((item) => ({
        ...item,
        id:
          typeof item?.id === "string" && item.id.trim()
            ? item.id
            : `${resource}-${Math.abs(JSON.stringify(item).split("").reduce((acc, ch) => ((acc * 31) + ch.charCodeAt(0)) | 0, 0))}`,
      })));
      return;
    }
    const body = list.map((item) => {
      const existingId = typeof item?.id === "string" && item.id.trim() ? item.id : null;
      const entityId = existingId ?? `${resource}-${Math.abs(JSON.stringify(item).split("").reduce((acc, ch) => ((acc * 31) + ch.charCodeAt(0)) | 0, 0))}`;
      const payload = existingId ? item : ({ ...item, id: entityId } as T);

      return {
        entityId,
        payload,
      };
    });

    await api.put(`/data/${resource}/bulk`, body);
  };

  const saveProjects = async (list: Project[]) => {
    await api.put("/projects/bulk", list);
  };

  const savePurchaseOrders = async (list: PurchaseOrder[]) => {
    await saveResource<PurchaseOrder>("purchase-orders", list);
  };

  const saveReceivings = async (list: Receiving[]) => {
    await saveResource<Receiving>("receivings", list);
  };

  const saveWorkOrders = async (list: WorkOrder[]) => {
    await saveResource<WorkOrder>("work-orders", list);
  };

  const saveEmployees = async (list: Employee[]) => {
    await saveResource<Employee>("employees", list);
  };

  const saveAttendances = async (list: Attendance[]) => {
    await saveResource<Attendance>("attendances", list);
  };

  const saveStockIns = async (list: StockIn[]) => {
    await saveResource<StockIn>("stock-ins", list);
  };

  const saveStockOuts = async (list: StockOut[]) => {
    await saveResource<StockOut>("stock-outs", list);
  };

  const saveStockMovements = async (list: StockMovement[]) => {
    await saveResource<StockMovement>("stock-movements", list);
  };

  const toSuratJalanWorkflowStatus = (sj: SuratJalan): "PREPARED" | "ISSUED" | "DELIVERED" | "CLOSED" => {
    const raw = String(
      (sj as any).workflowStatus ||
      (sj as any).statusWorkflow ||
      (sj as any).status ||
      sj.deliveryStatus ||
      ""
    )
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

    if (raw === "ISSUED" || raw === "IN_TRANSIT" || raw === "ON_DELIVERY" || raw === "SENT") return "ISSUED";
    if (raw === "DELIVERED" || raw === "COMPLETE" || raw === "COMPLETED") return "DELIVERED";
    if (raw === "CLOSED" || raw === "RETURNED") return "CLOSED";
    return "PREPARED";
  };

  const normalizeSuratJalanForSync = (
    sj: SuratJalan,
    options?: { validateProjectRef?: boolean; validProjectIds?: Set<string> }
  ): (SuratJalan & { workflowStatus: string; status: string }) => {
    const validProjectIds = options?.validProjectIds || new Set((projectList || []).map((project) => project.id));
    const shouldValidateProjectRef = options?.validateProjectRef ?? validProjectIds.size > 0;
    const rawProjectId = String(sj.projectId || "").trim();
    const sjType = sj.sjType === "Equipment Loan" ? "Equipment Loan" : "Material Delivery";
    const normalizedProjectId =
      sjType === "Equipment Loan"
        ? (rawProjectId && (!shouldValidateProjectRef || validProjectIds.has(rawProjectId)) ? rawProjectId : undefined)
        : shouldValidateProjectRef && rawProjectId && !validProjectIds.has(rawProjectId)
          ? undefined
          : rawProjectId || undefined;
    const workflowStatus = toSuratJalanWorkflowStatus(sj);
    const deliveryStatus = sj.deliveryStatus || "Pending";

    return {
      ...sj,
      sjType,
      projectId: normalizedProjectId,
      assetId: String(sj.assetId || "").trim() || undefined,
      noPolisi: String(sj.noPolisi || "").trim() || undefined,
      noPO: String(sj.noPO || "").trim() || undefined,
      upPerson: String(sj.upPerson || "").trim() || undefined,
      pengirim: String(sj.pengirim || "").trim() || undefined,
      expectedReturnDate: String(sj.expectedReturnDate || "").trim() || undefined,
      actualReturnDate: String(sj.actualReturnDate || "").trim() || undefined,
      deliveryStatus,
      workflowStatus,
      status: workflowStatus,
    };
  };

  const saveSuratJalan = async (list: SuratJalan[]) => {
    const validProjectIds = new Set((projectList || []).map((project) => project.id));
    const shouldValidateProjectRef = validProjectIds.size > 0;
    const normalizedList = list.map((sj) =>
      normalizeSuratJalanForSync(sj, { validateProjectRef: shouldValidateProjectRef, validProjectIds })
    );

    await saveResource<SuratJalan & { workflowStatus: string; status: string }>("surat-jalan", normalizedList);
  };

  const saveMaterialRequests = async (list: MaterialRequest[]) => {
    await saveResource<MaterialRequest>("material-requests", list);
  };

  const getProjectApiErrorMessage = (err: any, fallback: string): string => {
    const raw = String(err?.response?.data?.error || "").trim();
    if (!raw) return fallback;
    if (raw.includes("Gunakan /projects/:id/approval")) {
      return "Approval/Reject project hanya lewat tombol Approve/Reject (OWNER/SPV).";
    }
    if (raw.includes("approvalStatus=") && raw.includes("tidak boleh di-set")) {
      return "Status final project tidak bisa diubah manual. Gunakan flow approval project.";
    }
    if (raw.includes("Field tidak boleh diubah")) {
      return "Field approval/snapshot project dikunci. Gunakan endpoint approval.";
    }
    return raw;
  };

  useEffect(() => {
    if (!currentUser) return;

    let cancelled = false;
    hasInitializedAutoSyncSnapshot.current = false;
    lastSyncedSignaturesRef.current = {};

    (async () => {
      let loadSucceeded = false;

      try {
        const bootstrapTasks = [
          { key: "projects", critical: true, run: () => loadProjects() },
          { key: "invoices", critical: false, run: () => loadResource<Invoice>("invoices", setInvoiceList) },
          { key: "quotations", critical: true, run: () => loadQuotations() },
          { key: "purchase-orders", critical: true, run: () => loadPurchaseOrders() },
          { key: "receivings", critical: false, run: () => loadReceivings() },
          { key: "stock-items", critical: false, run: () => loadResource<StockItem>("stock-items", setStockItemList) },
          { key: "stock-movements", critical: false, run: () => loadStockMovements() },
          { key: "stock-ins", critical: false, run: () => loadStockIns() },
          { key: "stock-outs", critical: false, run: () => loadStockOuts() },
          { key: "stock-opnames", critical: false, run: () => loadResource<StockOpname>("stock-opnames", setStockOpnameList) },
          { key: "work-orders", critical: true, run: () => loadWorkOrders() },
          { key: "production-reports", critical: false, run: () => loadResource<ProductionReport>("production-reports", setProductionReportList) },
          { key: "production-trackers", critical: false, run: () => loadResource<ProductionTracker>("production-trackers", setProductionTrackerList) },
          { key: "qc-inspections", critical: false, run: () => loadResource<QCInspection>("qc-inspections", setQcInspectionList) },
          { key: "employees", critical: true, run: () => loadEmployees() },
          { key: "attendances", critical: false, run: () => loadAttendances() },
          { key: "surat-jalan", critical: false, run: () => loadSuratJalan() },
          { key: "berita-acara", critical: false, run: () => loadResource<BeritaAcara>("berita-acara", setBeritaAcaraList) },
          { key: "surat-masuk", critical: false, run: () => loadResource<SuratMasuk>("surat-masuk", setSuratMasukList) },
          { key: "surat-keluar", critical: false, run: () => loadResource<SuratKeluar>("surat-keluar", setSuratKeluarList) },
          { key: "template-surat", critical: false, run: () => loadResource<TemplateSurat>("template-surat", setTemplateSuratList) },
          { key: "assets", critical: false, run: () => loadResource<Asset>("assets", setAssetList) },
          { key: "maintenances", critical: false, run: () => loadResource<MaintenanceRecord>("maintenances", setMaintenanceList) },
          { key: "material-requests", critical: false, run: () => loadMaterialRequests() },
          { key: "data-collections", critical: false, run: () => loadDataCollections() },
          { key: "payrolls", critical: false, run: () => loadResource<Payroll>("payrolls", setPayrollList) },
          { key: "archive-registry", critical: false, run: () => loadResource<ArchiveEntry>("archive-registry", setArchiveRegistry) },
          { key: "audit-logs", critical: false, run: () => loadResource<AuditLog>("audit-logs", setAuditLogs).catch(() => setAuditLogs([])) },
          { key: "vendors", critical: false, run: () => loadResource<Vendor>("vendors", setVendorList) },
          { key: "vendor-expenses", critical: false, run: () => loadResource<VendorExpense>("vendor-expenses", setExpenseList) },
          { key: "vendor-invoices", critical: false, run: () => loadResource<VendorInvoice>("vendor-invoices", setVendorInvoiceList) },
          { key: "customers", critical: false, run: () => loadResource<Customer>("customers", setCustomerList) },
          { key: "customer-invoices", critical: false, run: () => loadResource<CustomerInvoice>("customer-invoices", setCustomerInvoiceList) },
        ] as const;

        const settled = await Promise.allSettled(
          bootstrapTasks.map(async (task) => {
            await task.run();
            return task.key;
          })
        );

        const failedKeys = settled.flatMap((result, index) =>
          result.status === "rejected" ? [bootstrapTasks[index].key] : []
        );
        const failedCriticalKeys = failedKeys.filter((key) =>
          bootstrapTasks.some((task) => task.key === key && task.critical)
        );

        try {
          const userRes = await api.get("/users");
          if (!cancelled) {
            const users = Array.isArray(userRes.data) ? userRes.data : userRes.data ? [userRes.data] : [];
            setUserList(users);
          }
        } catch {
          if (!cancelled) {
            setUserList([]);
          }
        }

        if (failedKeys.length > 0) {
          console.warn("Bootstrap resource load failures:", failedKeys);
        }

        loadSucceeded = failedCriticalKeys.length === 0;
        if (!loadSucceeded && !cancelled) {
          toast.error("Gagal load data backend inti. Data lokal tidak akan auto-sync sampai koneksi backend normal.");
        }
      } catch (err) {
        if (!cancelled) {
          toast.error("Gagal load data backend inti. Data lokal tidak akan auto-sync sampai koneksi backend normal.");
        }
      } finally {
        if (!cancelled) {
          hasHydratedFromBackend.current = loadSucceeded;
          canPersistToBackend.current = loadSucceeded;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser || !hasHydratedFromBackend.current || !canPersistToBackend.current || isSyncingToBackend.current) return;

    const syncTasks = [
      { key: "invoices", run: () => saveResource("invoices", invoiceList) },
      { key: "surat-masuk", run: () => saveResource("surat-masuk", suratMasukList) },
      { key: "surat-keluar", run: () => saveResource("surat-keluar", suratKeluarList) },
      { key: "template-surat", run: () => saveResource("template-surat", templateSuratList) },
      { key: "assets", run: () => saveResource("assets", assetList) },
      { key: "maintenances", run: () => saveResource("maintenances", maintenanceList) },
      { key: "payrolls", run: () => saveResource("payrolls", payrollList) },
    ] as const;

    const signatures = Object.fromEntries(
      syncTasks.map((task) => {
        switch (task.key) {
          case "invoices":
            return [task.key, listSignature(invoiceList)];
          case "stock-outs":
            return [task.key, listSignature(stockOutList)];
          case "stock-opnames":
            return [task.key, listSignature(stockOpnameList)];
          case "work-orders":
            return [task.key, listSignature(workOrderList)];
          case "production-reports":
            return [task.key, listSignature(productionReportList)];
          case "production-trackers":
            return [task.key, listSignature(productionTrackerList)];
          case "qc-inspections":
            return [task.key, listSignature(qcInspectionList)];
          case "employees":
            return [task.key, listSignature(employeeList)];
          case "attendances":
            return [task.key, listSignature(attendanceList)];
          case "surat-jalan":
            return [task.key, listSignature(suratJalanList)];
          case "berita-acara":
            return [task.key, listSignature(beritaAcaraList)];
          case "surat-masuk":
            return [task.key, listSignature(suratMasukList)];
          case "surat-keluar":
            return [task.key, listSignature(suratKeluarList)];
          case "template-surat":
            return [task.key, listSignature(templateSuratList)];
          case "assets":
            return [task.key, listSignature(assetList)];
          case "maintenances":
            return [task.key, listSignature(maintenanceList)];
          case "material-requests":
            return [task.key, listSignature(materialRequestList)];
          case "payrolls":
            return [task.key, listSignature(payrollList)];
          case "vendor-expenses":
            return [task.key, listSignature(expenseList)];
          case "vendor-invoices":
            return [task.key, listSignature(vendorInvoiceList)];
          case "customer-invoices":
            return [task.key, listSignature(customerInvoiceList)];
          default:
            return [task.key, ""];
        }
      })
    ) as Record<string, string>;

    if (!hasInitializedAutoSyncSnapshot.current) {
      lastSyncedSignaturesRef.current = signatures;
      hasInitializedAutoSyncSnapshot.current = true;
      return;
    }

    const dirtyTasks = syncTasks.filter(
      (task) => lastSyncedSignaturesRef.current[task.key] !== signatures[task.key]
    );
    if (dirtyTasks.length === 0) return;

    const timer = window.setTimeout(async () => {
      isSyncingToBackend.current = true;

      try {
        for (const task of dirtyTasks) {
          try {
            await task.run();
            lastSyncedSignaturesRef.current[task.key] = signatures[task.key];
          } catch (err) {
            console.error(`Auto-sync failed (${task.key})`, err);
          }
          await new Promise((resolve) => window.setTimeout(resolve, 120));
        }
      } catch (err) {
        console.error("Auto-sync failed", err);
      } finally {
        isSyncingToBackend.current = false;
      }
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    currentUser,
    invoiceList,
    poList,
    receivingList,
    stockItemList,
    stockMovementList,
    stockInList,
    stockOutList,
    stockOpnameList,
    workOrderList,
    productionReportList,
    productionTrackerList,
    qcInspectionList,
    employeeList,
    attendanceList,
    suratJalanList,
    beritaAcaraList,
    suratMasukList,
    suratKeluarList,
    templateSuratList,
    assetList,
    maintenanceList,
    materialRequestList,
    payrollList,
    archiveRegistry,
    auditLogs,
    vendorList,
    expenseList,
    vendorInvoiceList,
    customerList,
    customerInvoiceList,
  ]);

  /**
   * =========================
   *  AUDIT LOG
   * =========================
   */
  const addAuditLog: AppContextType["addAuditLog"] = (log) => {
    const newLog: AuditLog = {
      ...log,
      id: uid("LOG"),
      timestamp: new Date().toISOString(),
      userId: currentUser?.id || "System",
      userName: currentUser?.fullName || currentUser?.username || "System",
    };
    setAuditLogs((prev) => [newLog, ...prev]);
    api.post("/audit-logs", newLog).catch((err) => {
      console.error("Failed to sync audit log:", err);
    });
  };

  /**
   * =========================
   *  ALERTS: low stock
   * =========================
   */
  useEffect(() => {
    const lowStockAlerts = stockItemList
      .filter((it) => it.stok <= it.minStock)
      .map((it) => ({
        id: `STK-ALERT-${it.id}`,
        type: "Inventory",
        title: "Low Stock Warning",
        message: `Material ${it.nama} (${it.kode}) mencapai batas minimum (${it.stok} ${it.satuan})`,
        status: "Unread",
        severity: "High",
        timestamp: new Date().toISOString(),
      }));

    setAlerts((prev) => {
      const existing = new Set(prev.map((a: any) => a.id));
      const fresh = lowStockAlerts.filter((a) => !existing.has(a.id));
      return [...prev, ...fresh];
    });
  }, [stockItemList]);

  const markAlertAsRead: AppContextType["markAlertAsRead"] = (id) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: "Read" } : a)));
  };

  /**
   * =========================
   *  AUTH: login
   * =========================
   */
  const login: AppContextType["login"] = async (username, password) => {
    try {
      const res = await api.post("/auth/login", { username, password });
      safeRemoveLocalStorageItem("token");
      const meRes = await api.get("/auth/me");
      const user = normalizeAuthUser(meRes.data);
      setCurrentUser(user);
      persistAuthUser(user);
      toast.success(`Welcome back, ${user.username}`);
    } catch (err: any) {
      persistAuthUser(null);
      toast.error(err.response?.data?.error || "Login failed");
      throw err;
    }
  };

  /**
   * =========================
   *  CORE CRUD HELPERS
   * =========================
   */
  const updateUser: AppContextType["updateUser"] = (id, updates) =>
    {
      setUserList((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));

      api.patch(`/users/${id}`, updates).catch((err) => {
        console.error("Failed to sync user update:", err);
      });
    };

  const updateProject: AppContextType["updateProject"] = async (id, updates) => {
    const safeUpdates = { ...(updates as any) };
    delete safeUpdates.approvedBy;
    delete safeUpdates.approvedAt;
    delete safeUpdates.rejectedBy;
    delete safeUpdates.rejectedAt;
    delete safeUpdates.quotationSnapshot;
    delete safeUpdates.quotationSnapshotAt;
    delete safeUpdates.quotationSnapshotBy;

    let previousProject: Project | undefined;
    setProjectList((prev) => {
      previousProject = prev.find((p) => p.id === id);
      return prev.map((p) => (p.id === id ? { ...p, ...safeUpdates } : p));
    });

    try {
      const res = await api.patch(`/projects/${id}`, safeUpdates);
      if (res?.data) {
        setProjectList((prev) => prev.map((p) => (p.id === id ? (res.data as Project) : p)));
      }
      toast.success("Project berhasil diperbarui");
      return true;
    } catch (err) {
      if (previousProject) {
        setProjectList((prev) => prev.map((p) => (p.id === id ? previousProject! : p)));
      }
      toast.error(getProjectApiErrorMessage(err, "Gagal update project di server"));
      return false;
    }
  };

  const addEmployee: AppContextType["addEmployee"] = (e) => {
    setEmployeeList((prev) => [...prev, e]);
    api
      .post("/employees", e)
      .then((res) => {
        const saved = (res?.data || e) as Employee;
        setEmployeeList((prev) => {
          const exists = prev.some((item) => item.id === saved.id);
          if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
          return [...prev, saved];
        });
      })
      .catch((err) => {
        console.error("Failed to sync create employee:", err);
        setEmployeeList((prev) => prev.filter((item) => item.id !== e.id));
        toast.error(err?.response?.data?.error || "Gagal simpan employee ke server");
      });
  };

  const updateEmployee: AppContextType["updateEmployee"] = (id, updates) => {
    let prevSnapshot: Employee | undefined;
    let mergedPayload: Employee | undefined;
    setEmployeeList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          prevSnapshot = item;
          mergedPayload = { ...item, ...updates };
          return mergedPayload;
        }
        return item;
      })
    );
    if (!mergedPayload) return;
    api
      .patch(`/employees/${id}`, mergedPayload)
      .then((res) => {
        const saved = (res?.data || mergedPayload) as Employee;
        setEmployeeList((prev) => prev.map((item) => (item.id === id ? saved : item)));
      })
      .catch((err) => {
        console.error("Failed to sync update employee:", err);
        if (prevSnapshot) {
          setEmployeeList((prev) => prev.map((item) => (item.id === id ? prevSnapshot! : item)));
        }
        toast.error(err?.response?.data?.error || "Gagal update employee di server");
      });
  };

  const deleteEmployee: AppContextType["deleteEmployee"] = (id) => {
    let deletedSnapshot: Employee | undefined;
    setEmployeeList((prev) => {
      deletedSnapshot = prev.find((item) => item.id === id);
      return prev.filter((item) => item.id !== id);
    });
    api.delete(`/employees/${id}`).catch((err) => {
      console.error("Failed to sync delete employee:", err);
      if (deletedSnapshot) {
        setEmployeeList((prev) => {
          const exists = prev.some((item) => item.id === deletedSnapshot!.id);
          if (exists) return prev;
          return [...prev, deletedSnapshot!];
        });
      }
      toast.error(err?.response?.data?.error || "Gagal hapus employee di server");
    });
  };

  const addAttendance: AppContextType["addAttendance"] = async (a) => {
    setAttendanceList((prev) => [...prev, a]);
    try {
      const res = await api.post("/attendances", a);
      const saved = (res?.data || a) as Attendance;
      setAttendanceList((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [...prev, saved];
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync create attendance:", err);
      setAttendanceList((prev) => prev.filter((item) => item.id !== a.id));
      toast.error(err?.response?.data?.error || "Gagal simpan attendance ke server");
      return false;
    }
  };

  const addAttendanceBulk: AppContextType["addAttendanceBulk"] = async (a) => {
    setAttendanceList((prev) => [...prev, ...a]);
    try {
      await api.put("/attendances/bulk", a);
      return true;
    } catch (err: any) {
      console.error("Failed to sync create attendance bulk:", err);
      setAttendanceList((prev) => prev.filter((x) => !a.some((item) => item.id === x.id)));
      toast.error(err?.response?.data?.error || "Gagal sinkron bulk attendance ke server");
      return false;
    }
  };

  const updateAttendance: AppContextType["updateAttendance"] = (id, updates) => {
    let prevSnapshot: Attendance | undefined;
    let mergedPayload: Attendance | undefined;
    setAttendanceList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          prevSnapshot = item;
          mergedPayload = { ...item, ...updates };
          return mergedPayload;
        }
        return item;
      })
    );
    if (!mergedPayload) return;
    api
      .patch(`/attendances/${id}`, mergedPayload)
      .then((res) => {
        const saved = (res?.data || mergedPayload) as Attendance;
        setAttendanceList((prev) => prev.map((item) => (item.id === id ? saved : item)));
      })
      .catch((err) => {
        console.error("Failed to sync update attendance:", err);
        if (prevSnapshot) {
          setAttendanceList((prev) => prev.map((item) => (item.id === id ? prevSnapshot! : item)));
        }
        toast.error(err?.response?.data?.error || "Gagal update attendance di server");
      });
  };

  const deleteAttendance: AppContextType["deleteAttendance"] = (id) => {
    let deletedSnapshot: Attendance | undefined;
    setAttendanceList((prev) => {
      deletedSnapshot = prev.find((item) => item.id === id);
      return prev.filter((item) => item.id !== id);
    });
    api.delete(`/attendances/${id}`).catch((err) => {
      console.error("Failed to sync delete attendance:", err);
      if (deletedSnapshot) {
        setAttendanceList((prev) => {
          const exists = prev.some((item) => item.id === deletedSnapshot!.id);
          if (exists) return prev;
          return [...prev, deletedSnapshot!];
        });
      }
      toast.error(err?.response?.data?.error || "Gagal hapus attendance di server");
    });
  };

  const addQCInspection: AppContextType["addQCInspection"] = (inspection) => {
    setQcInspectionList((prev) => [...prev, inspection]);
    api
      .post("/qc-inspections", inspection)
      .then((res) => {
        const saved = (res?.data || inspection) as QCInspection;
        setQcInspectionList((prev) => {
          const exists = prev.some((item) => item.id === saved.id);
          if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
          return [...prev, saved];
        });
      })
      .catch((err) => {
        console.error("Failed to sync create qc inspection:", err);
        setQcInspectionList((prev) => prev.filter((item) => item.id !== inspection.id));
        toast.error(err?.response?.data?.error || "Gagal simpan QC inspection ke server");
      });
  };

  const addWorkOrder: AppContextType["addWorkOrder"] = async (wo) => {
    setWorkOrderList((prev) => [...prev, wo]);
    if (isActiveWorkOrderStatus(wo.status)) {
      const linkedAsset = findAssetByMachineRef(wo.machineId);
      if (linkedAsset && linkedAsset.status !== "Scrapped") {
        syncAssetLinkedUpdate(linkedAsset.id, {
          status: "In Use",
          projectName: wo.projectName || linkedAsset.projectName,
        });
      }
    }
    try {
      const res = await api.post("/work-orders", wo);
      const saved = (res?.data || wo) as WorkOrder;
      setWorkOrderList((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [...prev, saved];
      });
    } catch (err: any) {
      if (err?.response?.status === 409) {
        try {
          const existingRes = await api.get("/work-orders");
          const rows = Array.isArray(existingRes?.data) ? existingRes.data : [];
          const existing = rows
            .map((row: any) => {
              const payload = row?.payload ?? row ?? {};
              if (payload && typeof payload === "object" && !Array.isArray(payload)) {
                const payloadId = typeof payload.id === "string" && payload.id.trim() ? payload.id : null;
                const entityId = typeof row?.entityId === "string" && row.entityId.trim() ? row.entityId : null;
                const rowId = typeof row?.id === "string" && row.id.trim() ? row.id : null;
                return { ...(payload as Record<string, unknown>), id: payloadId || entityId || rowId } as WorkOrder;
              }
              return payload as WorkOrder;
            })
            .find((item: WorkOrder) => item?.id === wo.id || item?.woNumber === wo.woNumber);

          if (existing) {
            setWorkOrderList((prev) => {
              const withoutTemp = prev.filter((item) => item.id !== wo.id && item.woNumber !== wo.woNumber);
              return [...withoutTemp, existing];
            });
            return;
          }
        } catch (lookupErr) {
          console.error("Failed to reconcile duplicate work order after conflict:", lookupErr);
        }
      }
      console.error("Failed to sync create work order:", err);
      setWorkOrderList((prev) => prev.filter((item) => item.id !== wo.id));
      toast.error(err?.response?.data?.error || "Gagal simpan work order ke server");
      throw err;
    }
  };

  const updateWorkOrder: AppContextType["updateWorkOrder"] = async (id, updates) => {
    let prevSnapshot: WorkOrder | undefined;
    let mergedPayload: WorkOrder | undefined;
    let nextWorkOrderList: WorkOrder[] | undefined;
    setWorkOrderList((prev) =>
      {
        const next = prev.map((item) => {
        if (item.id === id) {
          prevSnapshot = item;
          mergedPayload = { ...item, ...updates };
          return mergedPayload;
        }
        return item;
        });
        nextWorkOrderList = next;
        return next;
      }
    );
    if (!mergedPayload) return;

    const simulatedWorkOrders = nextWorkOrderList || workOrderList;
    const prevAsset = findAssetByMachineRef(prevSnapshot?.machineId);
    const nextAsset = findAssetByMachineRef(mergedPayload.machineId);
    const nextIsActive = isActiveWorkOrderStatus(mergedPayload.status);

    if (nextAsset && nextAsset.status !== "Scrapped" && nextIsActive) {
      syncAssetLinkedUpdate(nextAsset.id, {
        status: "In Use",
        projectName: mergedPayload.projectName || nextAsset.projectName,
      });
    }

    if (prevAsset && (!nextIsActive || prevAsset.id !== nextAsset?.id)) {
      const idleStatus = getIdleAssetStatus(prevAsset, simulatedWorkOrders, suratJalanList, maintenanceList);
      syncAssetLinkedUpdate(prevAsset.id, {
        status: idleStatus,
        projectName: idleStatus === "In Use" ? prevAsset.projectName : undefined,
      });
    }

    if (nextAsset && !nextIsActive) {
      const idleStatus = getIdleAssetStatus(nextAsset, simulatedWorkOrders, suratJalanList, maintenanceList);
      syncAssetLinkedUpdate(nextAsset.id, {
        status: idleStatus,
        projectName: idleStatus === "In Use" ? mergedPayload.projectName || nextAsset.projectName : undefined,
      });
    }

    try {
      const res = await api.patch(`/work-orders/${id}`, mergedPayload);
      const saved = (res?.data || mergedPayload) as WorkOrder;
      setWorkOrderList((prev) => prev.map((item) => (item.id === id ? saved : item)));
    } catch (err: any) {
      console.error("Failed to sync update work order:", err);
      if (prevSnapshot) {
        setWorkOrderList((prev) => prev.map((item) => (item.id === id ? prevSnapshot! : item)));
      }
      toast.error(err?.response?.data?.error || "Gagal update work order di server");
      throw err;
    }
  };

  const deleteWorkOrder: AppContextType["deleteWorkOrder"] = async (id) => {
    let deletedSnapshot: WorkOrder | undefined;
    let nextWorkOrderList: WorkOrder[] | undefined;
    setWorkOrderList((prev) => {
      deletedSnapshot = prev.find((item) => item.id === id);
      const next = prev.filter((item) => item.id !== id);
      nextWorkOrderList = next;
      return next;
    });
    const linkedAsset = findAssetByMachineRef(deletedSnapshot?.machineId);
    if (linkedAsset) {
      const idleStatus = getIdleAssetStatus(linkedAsset, nextWorkOrderList || workOrderList, suratJalanList, maintenanceList);
      syncAssetLinkedUpdate(linkedAsset.id, {
        status: idleStatus,
        projectName: idleStatus === "In Use" ? linkedAsset.projectName : undefined,
      });
    }
    try {
      await api.delete(`/work-orders/${id}`);
    } catch (err: any) {
      console.error("Failed to sync delete work order:", err);
      if (deletedSnapshot) {
        setWorkOrderList((prev) => {
          const exists = prev.some((item) => item.id === deletedSnapshot!.id);
          if (exists) return prev;
          return [...prev, deletedSnapshot!];
        });
      }
      toast.error(err?.response?.data?.error || "Gagal hapus work order di server");
      throw err;
    }
  };

  const addInvoice: AppContextType["addInvoice"] = async (inv) => {
    setInvoiceList((prev) => [...prev, inv]);
    try {
      const res = await api.post("/invoices", inv);
      const saved = (res?.data || inv) as Invoice;
      setInvoiceList((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [...prev, saved];
      });
    } catch (err: any) {
      console.error("Failed to sync create invoice:", err);
      setInvoiceList((prev) => prev.filter((item) => item.id !== inv.id));
      const message = err?.response?.data?.error || "Gagal simpan invoice ke server";
      toast.error(message);
      throw err;
    }
  };

  const updateInvoice: AppContextType["updateInvoice"] = async (id, updates) => {
    let prevSnapshot: Invoice | undefined;
    let mergedPayload: Invoice | undefined;
    setInvoiceList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          prevSnapshot = item;
          mergedPayload = { ...item, ...updates };
          return mergedPayload;
        }
        return item;
      })
    );
    if (!mergedPayload) return;
    try {
      const res = await api.patch(`/invoices/${id}`, mergedPayload);
      const saved = (res?.data || mergedPayload) as Invoice;
      setInvoiceList((prev) => prev.map((item) => (item.id === id ? saved : item)));
    } catch (err: any) {
      console.error("Failed to sync update invoice:", err);
      if (prevSnapshot) {
        setInvoiceList((prev) => prev.map((item) => (item.id === id ? prevSnapshot! : item)));
      }
      toast.error(err?.response?.data?.error || "Gagal update invoice di server");
      throw err;
    }
  };

  const addPO: AppContextType["addPO"] = async (po) => {
    try {
      const res = await api.post("/purchase-orders", po);
      const saved = (res?.data || po) as PurchaseOrder;
      setPoList((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [...prev, saved];
      });
      addAuditLog({
        action: "PO_CREATED",
        module: "Procurement",
        details: `PO ${saved.noPO} dibuat untuk supplier ${saved.supplier || "-"}`,
        status: "Success",
      });
    } catch (err: any) {
      console.error("Failed to sync create purchase order:", err);
      const message = err?.response?.data?.error || "Gagal simpan purchase order ke server";
      addAuditLog({
        action: "PO_CREATE_FAILED",
        module: "Procurement",
        details: `Gagal membuat PO ${po.noPO || po.id}`,
        status: "Failed",
      });
      toast.error(message);
      throw err;
    }
  };

  const updatePO: AppContextType["updatePO"] = async (id, updates) => {
    const current = poList.find((item) => item.id === id);
    if (!current) {
      const notFoundErr = new Error(`PO ${id} tidak ditemukan di state lokal`);
      console.error("Failed to sync update purchase order:", notFoundErr);
      toast.error("PO tidak ditemukan");
      throw notFoundErr;
    }

    const mergedPayload = { ...current, ...updates } as PurchaseOrder;
    try {
      const res = await api.patch(`/purchase-orders/${id}`, mergedPayload);
      const saved = (res?.data || mergedPayload) as PurchaseOrder;
      setPoList((prev) => prev.map((item) => (item.id === id ? saved : item)));
      addAuditLog({
        action: "PO_UPDATED",
        module: "Procurement",
        details: `PO ${saved.noPO} diupdate`,
        status: "Success",
      });
    } catch (err: any) {
      console.error("Failed to sync update purchase order:", err);
      addAuditLog({
        action: "PO_UPDATE_FAILED",
        module: "Procurement",
        details: `Gagal update PO ${current?.noPO || id}`,
        status: "Failed",
      });
      toast.error(err?.response?.data?.error || "Gagal update purchase order di server");
      throw err;
    }
  };

  const approveProject: AppContextType["approveProject"] = async (id, ownerName) => {
    const role = String(currentUser?.role || "").toUpperCase();
    if (!isOwnerLike(role)) {
      toast.error("Hanya OWNER/SPV yang bisa approve project");
      throw new Error("Hanya OWNER/SPV yang bisa approve project");
    }

    const now = new Date().toISOString();
    let previous: Project | undefined;
    setProjectList((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          previous = p;
          return {
            ...p,
            approvalStatus: "Approved",
            approvedBy: ownerName,
            approvedAt: now,
            rejectedBy: undefined,
            rejectedAt: undefined,
            spvApprovedBy: role === "SPV" ? ownerName : (p as any).spvApprovedBy,
            spvApprovedAt: role === "SPV" ? now : (p as any).spvApprovedAt,
          };
        }
        return p;
      })
    );

    try {
      const res = await api.patch(`/projects/${id}/approval`, { action: "APPROVE" });
      if (res?.data) {
        setProjectList((prev) => prev.map((p) => (p.id === id ? (res.data as Project) : p)));
      }
    } catch (err) {
      if (previous) {
        setProjectList((prev) => prev.map((p) => (p.id === id ? previous! : p)));
      }
      const message = getProjectApiErrorMessage(err, "Gagal approve project di server");
      toast.error(message);
      throw err;
    }
  };

  const rejectProject: AppContextType["rejectProject"] = async (id, ownerName, reason) => {
    const role = String(currentUser?.role || "").toUpperCase();
    if (!isOwnerLike(role)) {
      toast.error("Hanya OWNER/SPV yang bisa reject project");
      throw new Error("Hanya OWNER/SPV yang bisa reject project");
    }

    const now = new Date().toISOString();
    let previous: Project | undefined;
    setProjectList((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          previous = p;
          return {
            ...p,
            approvalStatus: "Rejected",
            rejectedBy: ownerName,
            rejectedAt: now,
          };
        }
        return p;
      })
    );

    try {
      const res = await api.patch(`/projects/${id}/approval`, { action: "REJECT", reason: String(reason || "").trim() });
      if (res?.data) {
        setProjectList((prev) => prev.map((p) => (p.id === id ? (res.data as Project) : p)));
      }
    } catch (err) {
      if (previous) {
        setProjectList((prev) => prev.map((p) => (p.id === id ? previous! : p)));
      }
      const message = getProjectApiErrorMessage(err, "Gagal reject project di server");
      toast.error(message);
      throw err;
    }
  };

  const unlockProject: AppContextType["unlockProject"] = async (id, reason) => {
    const role = String(currentUser?.role || "").toUpperCase();
    if (!isOwnerLike(role)) {
      toast.error("Hanya OWNER/SPV yang bisa unlock project");
      throw new Error("Hanya OWNER/SPV yang bisa unlock project");
    }

    let previous: Project | undefined;
    setProjectList((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          previous = p;
          return {
            ...p,
            approvalStatus: "Pending",
            approvedBy: undefined,
            approvedAt: undefined,
          };
        }
        return p;
      })
    );

    try {
      const res = await api.post(`/projects/${id}/unlock`, { reason: reason || "" });
      if (res?.data) {
        setProjectList((prev) => prev.map((p) => (p.id === id ? (res.data as Project) : p)));
      }
    } catch (err) {
      if (previous) {
        setProjectList((prev) => prev.map((p) => (p.id === id ? previous! : p)));
      }
      const message = getProjectApiErrorMessage(err, "Gagal unlock project di server");
      toast.error(message);
      throw err;
    }
  };

  const relockProject: AppContextType["relockProject"] = async (id) => {
    const role = String(currentUser?.role || "").toUpperCase();
    if (!isOwnerLike(role)) {
      toast.error("Hanya OWNER/SPV yang bisa relock project");
      throw new Error("Hanya OWNER/SPV yang bisa relock project");
    }

    let previous: Project | undefined;
    setProjectList((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          previous = p;
          return {
            ...p,
            approvalStatus: "Approved",
            approvedBy: currentUser?.fullName || currentUser?.username || "Management",
            approvedAt: new Date().toISOString(),
          };
        }
        return p;
      })
    );

    try {
      const res = await api.post(`/projects/${id}/relock`);
      if (res?.data) {
        setProjectList((prev) => prev.map((p) => (p.id === id ? (res.data as Project) : p)));
      }
    } catch (err) {
      if (previous) {
        setProjectList((prev) => prev.map((p) => (p.id === id ? previous! : p)));
      }
      const message = getProjectApiErrorMessage(err, "Gagal relock project di server");
      toast.error(message);
      throw err;
    }
  };

  /**
   * =========================
   *  STOCK LOGIC (CLEAN)
   *  - match by kode ONLY
   * =========================
   */
  const createStockOut: AppContextType["createStockOut"] = async (so) => {
    const stockOutRef = String(so.workOrderId || so.noWorkOrder || "").trim();
    const linkedWO = stockOutRef
      ? workOrderList.find((wo) => {
          const candidates = [
            wo.id,
            (wo as any).woNumber,
            (wo as any).number,
            (wo as any).noWorkOrder,
          ]
            .map((value) => String(value || "").trim())
            .filter(Boolean);
          return candidates.includes(stockOutRef);
        })
      : undefined;
    const linkedProject =
      projectList.find((p) => {
        const candidates = [p.id, (p as any).kodeProject]
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        return candidates.includes(stockOutRef);
      }) || projectList.find((p) => String(p.id || "").trim() === String(so.projectId || "").trim());
    const resolvedProjectId = String(so.projectId || linkedWO?.projectId || linkedProject?.id || "").trim() || undefined;
    const resolvedProjectName =
      String(
        so.projectName ||
          linkedWO?.projectName ||
          linkedProject?.namaProject ||
          projectList.find((p) => String(p.id || "").trim() === String(resolvedProjectId || "").trim())?.namaProject ||
          ""
      ).trim() || undefined;
    const payload: StockOut = {
      ...so,
      workOrderId: linkedWO?.id || so.workOrderId,
      projectId: resolvedProjectId,
      projectName: resolvedProjectName,
    };

    const insufficient = payload.items
      .map((item) => {
        const stock = stockItemList.find((s) => s.kode === item.kode);
        if (!stock) return `Item ${item.kode} tidak ditemukan di master stok`;
        if (stock.stok < item.qty) {
          return `Stok ${item.nama} (${item.kode}) kurang. Tersedia ${stock.stok}, butuh ${item.qty}`;
        }
        return null;
      })
      .filter(Boolean) as string[];
    if (insufficient.length) {
      toast.error(insufficient[0]);
      return;
    }

    const previousStockItems = stockItemList;
    const previousStockMovements = stockMovementList;
    setStockOutList((prev) => [...prev, payload]);

    setStockItemList((prevInventory) => {
      const updated = [...prevInventory];
      const movements: StockMovement[] = [];

      for (const item of payload.items) {
        const idx = updated.findIndex((i) => i.kode === item.kode);
        if (idx === -1) continue;

        const stockBefore = updated[idx].stok;
        const stockAfter = stockBefore - item.qty;

        updated[idx] = { ...updated[idx], stok: stockAfter, lastUpdate: new Date().toISOString() };
        api.patch(`/inventory/items/${updated[idx].id}`, updated[idx]).catch((err) => {
          console.error("Failed to sync stock item after stock out:", err);
        });

        movements.push({
          id: uid("MOV"),
          tanggal: payload.tanggal,
          type: "OUT",
          refNo: payload.noStockOut,
          refType: "Stock Out",
          itemKode: updated[idx].kode,
          itemNama: updated[idx].nama,
          qty: item.qty,
          unit: item.satuan || updated[idx].satuan,
          lokasi: updated[idx].lokasi,
          stockBefore,
          stockAfter,
          createdBy: payload.createdBy,
          productionReportId: payload.productionReportId,
          projectId: resolvedProjectId,
          projectName: resolvedProjectName,
          batchNo: item.batchNo,
        });
      }

      if (movements.length) {
        setStockMovementList((prev) => [...movements, ...prev]);
        for (const mv of movements) {
          api.post("/inventory/movements", mv).catch((err) => {
            console.error("Failed to sync stock movement (OUT):", err);
          });
        }
      }

      addAuditLog({
        action: "STOCK_OUT",
        module: "Warehouse",
        details: `Stock out ${payload.noStockOut} processed`,
        status: "Success",
      });

      return updated;
    });
    try {
      await api.post("/inventory/stock-outs", payload);
    } catch (err: any) {
      console.error("Failed to sync create stock out:", err);
      setStockOutList((prev) => prev.filter((item) => item.id !== payload.id));
      setStockItemList(previousStockItems);
      setStockMovementList(previousStockMovements);
      toast.error(err?.response?.data?.error || "Gagal simpan stock out ke server");
      throw err;
    }
  };

  const createStockIn: AppContextType["createStockIn"] = async (si) => {
    const previousStockItems = stockItemList;
    const previousStockMovements = stockMovementList;
    setStockInList((prev) => [...prev, si]);
    let optimisticStockItems = previousStockItems;
    let optimisticMovements = previousStockMovements;

    setStockItemList((prevInventory) => {
      const updated = [...prevInventory];
      const movements: StockMovement[] = [];

      for (const item of si.items) {
        let idx = updated.findIndex((i) => i.kode === item.kode);
        if (idx === -1) {
          const nowIso = new Date().toISOString();
          updated.push({
            id: uid("STK"),
            kode: item.kode,
            nama: item.nama || item.kode,
            stok: 0,
            satuan: item.satuan || "Unit",
            kategori: "General",
            minStock: 0,
            hargaSatuan: 0,
            supplier: si.supplier || undefined,
            lokasi: "Gudang Utama",
            lastUpdate: nowIso,
          });
          idx = updated.length - 1;
        }

        const stockBefore = updated[idx].stok;
        const stockAfter = stockBefore + item.qty;

        updated[idx] = {
          ...updated[idx],
          stok: stockAfter,
          supplier: updated[idx].supplier || si.supplier || undefined,
          lastUpdate: new Date().toISOString(),
        };

        movements.push({
          id: uid("MOV"),
          tanggal: si.tanggal,
          type: "IN",
          refNo: si.noStockIn,
          refType: "Stock In",
          itemKode: updated[idx].kode,
          itemNama: updated[idx].nama,
          qty: item.qty,
          unit: item.satuan || updated[idx].satuan,
          lokasi: updated[idx].lokasi,
          stockBefore,
          stockAfter,
          createdBy: si.createdBy,
          batchNo: item.batchNo,
          expiryDate: item.expiryDate,
          supplier: si.supplier || updated[idx].supplier,
          noPO: si.noPO,
          projectId: si.projectId,
          projectName: si.projectName,
        });
      }

      if (movements.length) {
        setStockMovementList((prev) => [...movements, ...prev]);
      }

      optimisticStockItems = updated;
      optimisticMovements = movements;

      addAuditLog({
        action: "STOCK_IN",
        module: "Warehouse",
        details: `Stock in ${si.noStockIn} processed`,
        status: "Success",
      });

      return updated;
    });
    try {
      await api.post("/inventory/stock-ins", si);
      try {
        const [stockInRes, stockItemRes, stockMovementRes] = await Promise.all([
          api.get("/inventory/stock-ins"),
          api.get("/inventory/items"),
          api.get("/inventory/movements"),
        ]);
        setStockInList(Array.isArray(stockInRes.data) ? (stockInRes.data as StockIn[]) : []);
        setStockItemList(Array.isArray(stockItemRes.data) ? (stockItemRes.data as StockItem[]) : optimisticStockItems);
        setStockMovementList(Array.isArray(stockMovementRes.data) ? (stockMovementRes.data as StockMovement[]) : optimisticMovements);
      } catch (refreshErr) {
        console.error("Failed to refresh stock sources after stock in:", refreshErr);
      }
    } catch (err: any) {
      console.error("Failed to sync create stock in:", err);
      setStockInList((prev) => prev.filter((item) => item.id !== si.id));
      setStockItemList(previousStockItems);
      setStockMovementList(previousStockMovements);
      toast.error(err?.response?.data?.error || "Gagal simpan stock in ke server");
      throw err;
    }
  };

  const addStockIn: AppContextType["addStockIn"] = async (si) => createStockIn(si);
  const addStockOut: AppContextType["addStockOut"] = async (so) => createStockOut(so);
  const addStockOpname: AppContextType["addStockOpname"] = async (opname) => {
    try {
      const res = await api.post("/inventory/stock-opnames", opname);
      const saved = (res?.data || opname) as StockOpname;
      setStockOpnameList((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [saved, ...prev];
      });
    } catch (err: any) {
      console.error("Failed to sync create stock opname:", err);
      toast.error(err?.response?.data?.error || "Gagal simpan stock opname ke server");
      throw err;
    }
  };

  const confirmStockOpname: AppContextType["confirmStockOpname"] = async (id) => {
    const previousSnapshot = stockOpnameList.find((item) => item.id === id);
    if (!previousSnapshot) {
      const notFoundErr = new Error(`Stock opname ${id} tidak ditemukan`);
      toast.error("Stock opname tidak ditemukan");
      throw notFoundErr;
    }
    if (previousSnapshot.status === "Confirmed") return;

    const confirmedPayload: StockOpname = {
      ...previousSnapshot,
      status: "Confirmed",
      confirmedAt: new Date().toISOString(),
      confirmedBy: currentUser?.fullName || currentUser?.username || "System",
    };

    const nextStockItems = [...stockItemList];
    const changedStockItems: StockItem[] = [];
    const movementRows: StockMovement[] = [];

    for (const row of confirmedPayload.items || []) {
      const idx = nextStockItems.findIndex((it) => (row.itemId && it.id === row.itemId) || it.kode === row.itemKode);
      if (idx === -1) continue;
      const stockBefore = Number(nextStockItems[idx].stok || 0);
      const stockAfter = Number(row.physicalQty ?? stockBefore);
      if (!Number.isFinite(stockAfter) || stockAfter === stockBefore) continue;

      const updatedItem: StockItem = {
        ...nextStockItems[idx],
        stok: stockAfter,
        lastUpdate: new Date().toISOString(),
      };
      nextStockItems[idx] = updatedItem;
      changedStockItems.push(updatedItem);

      movementRows.push({
        id: uid("MOV"),
        tanggal: confirmedPayload.tanggal || todayISO(),
        type: stockAfter >= stockBefore ? "IN" : "OUT",
        refNo: confirmedPayload.noOpname,
        refType: "Stock Opname",
        itemKode: updatedItem.kode,
        itemNama: updatedItem.nama,
        qty: Math.abs(stockAfter - stockBefore),
        unit: updatedItem.satuan,
        lokasi: confirmedPayload.lokasi || updatedItem.lokasi,
        stockBefore,
        stockAfter,
        createdBy: confirmedPayload.confirmedBy || confirmedPayload.createdBy,
      });
    }

    try {
      const opnameRes = await api.patch(`/inventory/stock-opnames/${id}`, confirmedPayload);
      const savedOpname = (opnameRes?.data || confirmedPayload) as StockOpname;

      await Promise.all(
        changedStockItems.map((item) => api.patch(`/inventory/items/${item.id}`, item))
      );
      await Promise.all(
        movementRows.map((mv) => api.post("/inventory/movements", mv))
      );

      setStockOpnameList((prev) => prev.map((item) => (item.id === id ? savedOpname : item)));
      if (changedStockItems.length > 0) {
        setStockItemList(nextStockItems);
      }
      if (movementRows.length > 0) {
        setStockMovementList((prev) => [...movementRows, ...prev]);
      }

      addAuditLog({
        action: "STOCK_OPNAME_CONFIRMED",
        module: "Warehouse",
        details: `Stock opname ${confirmedPayload.noOpname} dikonfirmasi`,
        status: "Success",
      });
    } catch (err: any) {
      console.error("Failed to sync confirm stock opname:", err);
      toast.error(err?.response?.data?.error || "Gagal konfirmasi stock opname di server");
      throw err;
    }
  };

  /**
   * =========================
   *  RECEIVING: auto StockIn + PO progress
   * =========================
   */
  const addReceiving: AppContextType["addReceiving"] = async (rcv) => {
    setReceivingList((prev) => [...prev, rcv]);
    try {
      const res = await api.post("/receivings", rcv);
      const savedReceiving = (res?.data || rcv) as Receiving;
      setReceivingList((prev) => {
        const exists = prev.some((item) => item.id === savedReceiving.id);
        if (exists) return prev.map((item) => (item.id === savedReceiving.id ? savedReceiving : item));
        return [savedReceiving, ...prev];
      });
      try {
        const [poRes, stockInRes, stockItemRes, stockMovementRes] = await Promise.all([
          api.get("/purchase-orders"),
          api.get("/inventory/stock-ins"),
          api.get("/inventory/items"),
          api.get("/inventory/movements"),
        ]);
        const nextPOs = normalizeEntityRows<PurchaseOrder>(poRes.data);
        setPoList(nextPOs);
        setStockInList(Array.isArray(stockInRes.data) ? (stockInRes.data as StockIn[]) : []);
        setStockItemList(Array.isArray(stockItemRes.data) ? (stockItemRes.data as StockItem[]) : []);
        setStockMovementList(Array.isArray(stockMovementRes.data) ? (stockMovementRes.data as StockMovement[]) : []);
      } catch (err) {
        console.error("Failed to refresh inventory/PO after receiving create:", err);
      }

      addAuditLog({
        action: "MATERIAL_RECEIVED",
        module: "Procurement",
        details: `Received materials for PO ${rcv.noPO} via GRN ${rcv.noReceiving}`,
        status: "Success",
      });
    } catch (err: any) {
      console.error("Failed to sync create receiving:", err);
      setReceivingList((prev) => prev.filter((item) => item.id !== rcv.id));
      toast.error(err?.response?.data?.error || "Gagal simpan receiving ke server");
      throw err;
    }
  };

  /**
   * =========================
   *  PRODUCTION: output + auto BOM stock out + project progress
   * =========================
   */
  const handleProductionOutput: AppContextType["handleProductionOutput"] = (woId, qty, workerName, options) => {
    setWorkOrderList((prevWOs) => {
      const updatedWOs = prevWOs.map((wo) => {
        if (wo.id !== woId) return wo;

        const newCompleted = (wo.completedQty || 0) + qty;
        const normalizedSelectedItem = String(options?.selectedItem || "").trim();
        const isAutoDeduct =
          !normalizedSelectedItem ||
          normalizedSelectedItem.toLowerCase() === "auto" ||
          normalizedSelectedItem === "-- Auto-Deduct All BOM --";
        const denominator = wo.targetQty > 0 ? wo.targetQty : 1;
        if (wo.targetQty <= 0) {
          toast.warning(`WO ${wo.woNumber}: targetQty = 0, perhitungan konsumsi pakai fallback 1`);
        }

        // Auto BOM Consumption
        if (wo.bom?.length) {
          const bomCandidates = isAutoDeduct
            ? wo.bom
            : wo.bom.filter((b) => (b.nama || b.materialName || "") === normalizedSelectedItem);
          const stockOutItems: StockOutItem[] = bomCandidates
            .map((b) => {
              const kode = b.kode || b.id || "";
              const nama = b.nama || b.materialName || "BOM Item";
              if (!kode) return null;

              // qty proportional
              const consumed = (b.qty || 0) * (qty / denominator);
              if (!Number.isFinite(consumed) || consumed <= 0) return null;
              return {
                kode,
                nama,
                qty: consumed,
                satuan: b.unit || "Unit",
              };
            })
            .filter(Boolean) as StockOutItem[];

          if (stockOutItems.length) {
            createStockOut({
              id: uid("SO"),
              noStockOut: `SO-AUTO-PROD-${wo.woNumber}`,
              noWorkOrder: wo.woNumber,
              productionReportId: options?.productionReportId,
              projectId: wo.projectId,
              projectName: wo.projectName,
              penerima: workerName,
              tanggal: todayISO(),
              type: "Project Issue",
              status: "Posted",
              createdBy: "Production System",
              notes: options?.productionReportId
                ? `Auto deduct dari LHP ${options.productionReportId}`
                : "Auto deduct dari LHP",
              items: stockOutItems,
            });
          }
        }

        const nextBom = wo.bom?.map((b) => {
          const bomName = b.nama || b.materialName || "";
          if (!isAutoDeduct && bomName !== normalizedSelectedItem) return b;
          const consumed = (b.qty || 0) * (qty / denominator);
          if (!Number.isFinite(consumed) || consumed <= 0) return b;
          return { ...b, completedQty: (b.completedQty || 0) + consumed };
        });

        const updatedWO = {
          ...wo,
          bom: nextBom,
          completedQty: newCompleted,
          status: newCompleted >= wo.targetQty ? "Completed" : "In Progress",
        };
        api.patch(`/work-orders/${updatedWO.id}`, updatedWO).catch((err) => {
          console.error("Failed to sync work order production update:", err);
          toast.error(err?.response?.data?.error || "Gagal sinkron update work order");
        });
        return updatedWO;
      });

      // Update project progress (based on WO completion ratio within project)
      const targetWO = updatedWOs.find((w) => w.id === woId);
      if (targetWO?.projectId) {
        const projectWOs = updatedWOs.filter((w) => w.projectId === targetWO.projectId);
        const totalTarget = projectWOs.reduce((sum, w) => sum + w.targetQty, 0);
        const totalCompleted = projectWOs.reduce((sum, w) => sum + (w.completedQty || 0), 0);
        if (totalTarget > 0) {
          const newProgress = Math.min(100, Math.round((totalCompleted / totalTarget) * 100));
          setProjectList((prev) => prev.map((p) => (p.id === targetWO.projectId ? { ...p, progress: newProgress } : p)));
          api.patch(`/projects/${targetWO.projectId}`, { progress: newProgress }).catch((err) => {
            console.error("Failed to sync project progress from production:", err);
          });
        }
      }

      return updatedWOs;
    });
  };

  const recordProduction: AppContextType["recordProduction"] = async (woId, qty) => {
    handleProductionOutput(woId, qty, currentUser?.fullName || currentUser?.username || "System");
  };

  const addProductionReport: AppContextType["addProductionReport"] = (report) => {
    setProductionReportList((prev) => [report, ...prev]);
    api
      .post("/production/submit-lhp", { report })
      .then((res) => {
        const serverReport = (res?.data?.report || report) as ProductionReport;
        const serverWorkOrder = res?.data?.workOrder as WorkOrder | undefined;
        const serverStockOut = res?.data?.stockOut as StockOut | null | undefined;
        const serverStockMovements = Array.isArray(res?.data?.stockMovements)
          ? (res.data.stockMovements as StockMovement[])
          : [];
        const serverStockItems = Array.isArray(res?.data?.stockItems)
          ? (res.data.stockItems as StockItem[])
          : [];

        setProductionReportList((prev) => {
          const filtered = prev.filter((item) => item.id !== serverReport.id);
          return [serverReport, ...filtered];
        });

        if (serverWorkOrder?.id) {
          setWorkOrderList((prev) =>
            prev.map((item) => (item.id === serverWorkOrder.id ? serverWorkOrder : item))
          );
        }

        if (serverStockOut?.id) {
          setStockOutList((prev) => {
            const filtered = prev.filter((item) => item.id !== serverStockOut.id);
            return [serverStockOut, ...filtered];
          });
        }

        if (serverStockMovements.length) {
          setStockMovementList((prev) => [...serverStockMovements, ...prev]);
        }

        if (serverStockItems.length) {
          setStockItemList((prev) => {
            const byId = new Map(prev.map((item) => [item.id, item]));
            for (const item of serverStockItems) {
              if (item?.id) byId.set(item.id, item);
            }
            return Array.from(byId.values());
          });
        }
      })
      .catch((err) => {
        console.error("Failed to submit LHP transaction:", err);
        setProductionReportList((prev) => prev.filter((item) => item.id !== report.id));
        toast.error(err?.response?.data?.error || "Gagal submit LHP (transaction rollback)");
      });
  };

  /**
   * =========================
   *  PROJECT / DATA COLLECTION / QUOTATION CONVERSION
   * =========================
   */
  const addDataCollection: AppContextType["addDataCollection"] = (dc) =>
    {
      setDataCollectionList((prev) => {
        const exists = prev.some((item) => item.id === dc.id);
        if (exists) return prev.map((item) => (item.id === dc.id ? dc : item));
        return [...prev, dc];
      });
      api.post("/data-collections", dc).then((res) => {
        const saved = (res?.data || dc) as DataCollection;
        setDataCollectionList((prev) => {
          const exists = prev.some((item) => item.id === saved.id);
          if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
          return [...prev, saved];
        });
      }).catch((err) => {
        console.error("Failed to sync create data collection:", err);
        setDataCollectionList((prev) => prev.filter((item) => item.id !== dc.id));
        toast.error(err?.response?.data?.error || "Gagal simpan data collection ke server");
      });
    };

  const updateDataCollection: AppContextType["updateDataCollection"] = (id, updates) =>
    {
      const prevSnapshot = dataCollectionList.find((dc) => dc.id === id);
      setDataCollectionList((prev) => prev.map((dc) => (dc.id === id ? { ...dc, ...updates } : dc)));
      api.patch(`/data-collections/${id}`, updates).then((res) => {
        if (res?.data) {
          setDataCollectionList((prev) => prev.map((dc) => (dc.id === id ? (res.data as DataCollection) : dc)));
        }
      }).catch((err) => {
        console.error("Failed to sync update data collection:", err);
        if (prevSnapshot) {
          setDataCollectionList((prev) => prev.map((dc) => (dc.id === id ? prevSnapshot : dc)));
        }
        toast.error(err?.response?.data?.error || "Gagal update data collection di server");
      });
    };

  const deleteDataCollection: AppContextType["deleteDataCollection"] = (id) =>
    {
      let deletedDataCollection: DataCollection | undefined;
      setDataCollectionList((prev) => {
        deletedDataCollection = prev.find((dc) => dc.id === id);
        return prev.filter((dc) => dc.id !== id);
      });
      api.delete(`/data-collections/${id}`).catch((err) => {
        console.error("Failed to sync delete data collection:", err);
        if (deletedDataCollection) {
          setDataCollectionList((prev) => {
            const exists = prev.some((dc) => dc.id === deletedDataCollection!.id);
            if (exists) return prev;
            return [deletedDataCollection!, ...prev];
          });
        }
        toast.error(err?.response?.data?.error || "Gagal hapus data collection di server");
      });
    };

  const addProject: AppContextType["addProject"] = async (p) => {
    setProjectList((prev) => [...prev, p]);
    try {
      const res = await api.post("/projects", p);
      if (res?.data) {
        const saved = res.data as Project;
        setProjectList((prev) => {
          const exists = prev.some((item) => item.id === saved.id);
          if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
          return [...prev, saved];
        });
      }
      toast.success("Project baru berhasil dibuat");
      return true;
    } catch (err) {
      setProjectList((prev) => prev.filter((item) => item.id !== p.id));
      toast.error(getProjectApiErrorMessage(err, "Gagal simpan project ke server"));
      return false;
    }
  };
  const deleteProject: AppContextType["deleteProject"] = async (id) => {
    let deletedProject: Project | undefined;
    setProjectList((prev) => {
      deletedProject = prev.find((p) => p.id === id);
      return prev.filter((p) => p.id !== id);
    });
    try {
      await api.delete(`/projects/${id}`);
      toast.success("Project berhasil dihapus");
      return true;
    } catch (err: any) {
      if (deletedProject) {
        setProjectList((prev) => [deletedProject!, ...prev]);
      }
      toast.error(err?.response?.data?.error || "Gagal hapus project di server");
      return false;
    }
  };

  const addQuotation: AppContextType["addQuotation"] = async (q) => {
    const optimisticId = String((q as any)?.id || uid("QUO"));
    const optimisticQuotation = normalizeQuotationForUi({ ...q, id: optimisticId });
    setQuotationList((prev) => {
      const exists = prev.some((item) => item.id === optimisticId);
      if (exists) return prev.map((item) => (item.id === optimisticId ? optimisticQuotation : item));
      return [...prev, optimisticQuotation];
    });

    try {
      const payload = normalizeQuotationForApi({ ...q, id: optimisticId });
      const res = await api.post("/quotations", payload);
      const saved = normalizeQuotationForUi(res?.data || payload);
      setQuotationList((prev) => {
        const replaced = prev.map((item) =>
          item.id === optimisticId || item.id === saved.id ? saved : item
        );
        const exists = replaced.some((item) => item.id === saved.id);
        return exists ? replaced : [...replaced, saved];
      });
    } catch (err: any) {
      console.error("Failed to sync create quotation:", err);
      setQuotationList((prev) => prev.filter((item) => item.id !== optimisticId));
      toast.error(err?.response?.data?.error || "Gagal simpan quotation ke server");
      throw err;
    }
  };
  const updateQuotation: AppContextType["updateQuotation"] = async (id, updates) =>
    {
      let previousQuotation: Quotation | undefined;
      setQuotationList((prev) => {
        previousQuotation = prev.find((q) => q.id === id);
        return prev.map((q) =>
          q.id === id ? normalizeQuotationForUi({ ...q, ...updates, id }) : q
        );
      });
      try {
        const mergedForApi = normalizeQuotationForApi({
          ...(previousQuotation || {}),
          ...updates,
          id,
        });
        const res = await api.patch(`/quotations/${id}`, mergedForApi);
        if (res?.data) {
          const saved = normalizeQuotationForUi(res.data);
          setQuotationList((prev) => prev.map((q) => (q.id === id ? saved : q)));
        }
      } catch (err: any) {
        console.error("Failed to sync update quotation:", err);
        if (previousQuotation) {
          setQuotationList((prev) => prev.map((q) => (q.id === id ? previousQuotation! : q)));
        }
        toast.error(err?.response?.data?.error || "Gagal update quotation di server");
        throw err;
      }
    };
  const deleteQuotation: AppContextType["deleteQuotation"] = async (id) =>
    {
      let deletedQuotation: Quotation | undefined;
      setQuotationList((prev) => {
        deletedQuotation = prev.find((q) => q.id === id);
        return prev.filter((q) => q.id !== id);
      });
      try {
        await api.delete(`/quotations/${id}`);
      } catch (err: any) {
        console.error("Failed to sync delete quotation:", err);
        if (deletedQuotation) {
          setQuotationList((prev) => {
            const exists = prev.some((q) => q.id === deletedQuotation!.id);
            if (exists) return prev;
            return [deletedQuotation!, ...prev];
          });
        }
        toast.error(err?.response?.data?.error || "Gagal hapus quotation di server");
        throw err;
      }
    };

  const convertDataCollectionToQuotation: AppContextType["convertDataCollectionToQuotation"] = (dcId) => {
    const dc = dataCollectionList.find((d) => d.id === dcId);
    if (!dc) return;

    const now = new Date().toISOString();

    // Create a simple quotation with one section (you can expand in UI)
    const newQuo: Quotation = {
      id: uid("QUO"),
      noPenawaran: `QUO/GTP/${new Date().getFullYear()}/${String(quotationList.length + 1).padStart(3, "0")}`,
      revisi: "A",
      tanggal: todayISO(),
      jenisQuotation: "Jasa",
      kepada: dc.namaResponden,
      lokasi: dc.lokasi,
      up: "",
      perihal: dc.tipePekerjaan,
      sections: [
        {
          id: uid("SEC"),
          label: "I",
          title: "Rincian Pekerjaan",
          items: [],
          subtotal: 0,
        },
      ],
      totalSebelumDiskon: 0,
      diskonPersen: 0,
      diskonNominal: 0,
      grandTotal: 0,
      terms: [],
      status: "Draft",
      createdBy: currentUser?.fullName || currentUser?.username || "System",
      createdAt: now,
      dataCollectionId: dc.id,
      type: dc.jenisKontrak === "Project" ? "Project" : "Direct",
    };

    void addQuotation(newQuo as any)
      .then(() => {
        updateDataCollection(dcId, { status: "Completed" });
        toast.success("Survey data converted to Quotation Draft successfully!");
      })
      .catch(() => {
        // Error toast handled in addQuotation.
      });
  };

  const convertQuotationToProject: AppContextType["convertQuotationToProject"] = (quoId) => {
    const quo = quotationList.find((q) => q.id === quoId);
    if (!quo) return;

    void updateQuotation(quoId, { status: "Sent" })
      .then(() => {
        toast.success("Quotation synced to Project Ledger successfully!");
      })
      .catch(() => {
        // Error toast handled in updateQuotation.
      });
  };

  /**
   * =========================
   *  LETTERS / BA / SJ
   * =========================
   */
  const addSuratMasuk: AppContextType["addSuratMasuk"] = async (s) => {
    setSuratMasukList((prev) => [...prev, s]);
    try {
      const res = await api.post("/surat-masuk", s);
      const saved = (res?.data || s) as SuratMasuk;
      setSuratMasukList((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [...prev, saved];
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync create surat masuk:", err);
      setSuratMasukList((prev) => prev.filter((item) => item.id !== s.id));
      toast.error(err?.response?.data?.error || "Gagal simpan surat masuk ke server");
      return false;
    }
  };
  const updateSuratMasuk: AppContextType["updateSuratMasuk"] = async (id, updates) => {
    let prevSnapshot: SuratMasuk | undefined;
    let mergedPayload: SuratMasuk | undefined;
    setSuratMasukList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          prevSnapshot = item;
          mergedPayload = { ...item, ...updates };
          return mergedPayload;
        }
        return item;
      })
    );
    if (!mergedPayload) return false;
    try {
      const res = await api.patch(`/surat-masuk/${id}`, mergedPayload);
      const saved = (res?.data || mergedPayload) as SuratMasuk;
      setSuratMasukList((prev) => prev.map((item) => (item.id === id ? saved : item)));
      return true;
    } catch (err: any) {
      console.error("Failed to sync update surat masuk:", err);
      if (prevSnapshot) {
        setSuratMasukList((prev) => prev.map((item) => (item.id === id ? prevSnapshot! : item)));
      }
      toast.error(err?.response?.data?.error || "Gagal update surat masuk di server");
      return false;
    }
  };
  const deleteSuratMasuk: AppContextType["deleteSuratMasuk"] = async (id) => {
    let deletedSnapshot: SuratMasuk | undefined;
    setSuratMasukList((prev) => {
      deletedSnapshot = prev.find((item) => item.id === id);
      return prev.filter((item) => item.id !== id);
    });
    try {
      await api.delete(`/surat-masuk/${id}`);
      return true;
    } catch (err: any) {
      console.error("Failed to sync delete surat masuk:", err);
      if (deletedSnapshot) {
        setSuratMasukList((prev) => {
          const exists = prev.some((item) => item.id === deletedSnapshot!.id);
          if (exists) return prev;
          return [deletedSnapshot!, ...prev];
        });
      }
      toast.error(err?.response?.data?.error || "Gagal hapus surat masuk di server");
      return false;
    }
  };

  const addSuratKeluar: AppContextType["addSuratKeluar"] = async (s) => {
    const sanitizedRecord = sanitizeSuratKeluarRecord(s);
    setSuratKeluarList((prev) => [...prev, sanitizedRecord]);
    try {
      const res = await api.post("/surat-keluar", sanitizedRecord);
      const saved = sanitizeSuratKeluarRecord((res?.data || sanitizedRecord) as SuratKeluar);
      setSuratKeluarList((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [...prev, saved];
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync create surat keluar:", err);
      setSuratKeluarList((prev) => prev.filter((item) => item.id !== sanitizedRecord.id));
      toast.error(err?.response?.data?.error || "Gagal simpan surat keluar ke server");
      return false;
    }
  };
  const updateSuratKeluar: AppContextType["updateSuratKeluar"] = async (id, updates) => {
    let prevSnapshot: SuratKeluar | undefined;
    let mergedPayload: SuratKeluar | undefined;
    const sanitizedUpdates = sanitizeSuratKeluarRecord(updates);
    setSuratKeluarList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          prevSnapshot = item;
          mergedPayload = sanitizeSuratKeluarRecord({ ...item, ...sanitizedUpdates });
          return mergedPayload;
        }
        return item;
      })
    );
    if (!mergedPayload) return false;
    try {
      const res = await api.patch(`/surat-keluar/${id}`, mergedPayload);
      const saved = sanitizeSuratKeluarRecord((res?.data || mergedPayload) as SuratKeluar);
      setSuratKeluarList((prev) => prev.map((item) => (item.id === id ? saved : item)));
      return true;
    } catch (err: any) {
      console.error("Failed to sync update surat keluar:", err);
      if (prevSnapshot) {
        setSuratKeluarList((prev) => prev.map((item) => (item.id === id ? prevSnapshot! : item)));
      }
      toast.error(err?.response?.data?.error || "Gagal update surat keluar di server");
      return false;
    }
  };
  const deleteSuratKeluar: AppContextType["deleteSuratKeluar"] = async (id) => {
    let deletedSnapshot: SuratKeluar | undefined;
    setSuratKeluarList((prev) => {
      deletedSnapshot = prev.find((item) => item.id === id);
      return prev.filter((item) => item.id !== id);
    });
    try {
      await api.delete(`/surat-keluar/${id}`);
      return true;
    } catch (err: any) {
      console.error("Failed to sync delete surat keluar:", err);
      if (deletedSnapshot) {
        setSuratKeluarList((prev) => {
          const exists = prev.some((item) => item.id === deletedSnapshot!.id);
          if (exists) return prev;
          return [deletedSnapshot!, ...prev];
        });
      }
      toast.error(err?.response?.data?.error || "Gagal hapus surat keluar di server");
      return false;
    }
  };

  const addBeritaAcara: AppContextType["addBeritaAcara"] = async (ba) => {
    const sanitizedRecord = sanitizeBeritaAcaraRecord(ba);
    setBeritaAcaraList((prev) => [...prev, sanitizedRecord]);
    try {
      const res = await api.post("/berita-acara", sanitizedRecord);
      const saved = sanitizeBeritaAcaraRecord((res?.data || sanitizedRecord) as BeritaAcara);
      setBeritaAcaraList((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [...prev, saved];
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync create berita acara:", err);
      setBeritaAcaraList((prev) => prev.filter((item) => item.id !== sanitizedRecord.id));
      toast.error(err?.response?.data?.error || "Gagal simpan berita acara ke server");
      return false;
    }
  };
  const updateBeritaAcara: AppContextType["updateBeritaAcara"] = async (id, updates) => {
    let prevSnapshot: BeritaAcara | undefined;
    let mergedPayload: BeritaAcara | undefined;
    const sanitizedUpdates = sanitizeBeritaAcaraRecord(updates);
    setBeritaAcaraList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          prevSnapshot = item;
          mergedPayload = sanitizeBeritaAcaraRecord({ ...item, ...sanitizedUpdates });
          return mergedPayload;
        }
        return item;
      })
    );
    if (!mergedPayload) return false;
    try {
      const res = await api.patch(`/berita-acara/${id}`, mergedPayload);
      const saved = sanitizeBeritaAcaraRecord((res?.data || mergedPayload) as BeritaAcara);
      setBeritaAcaraList((prev) => prev.map((item) => (item.id === id ? saved : item)));
      return true;
    } catch (err: any) {
      console.error("Failed to sync update berita acara:", err);
      if (prevSnapshot) {
        setBeritaAcaraList((prev) => prev.map((item) => (item.id === id ? prevSnapshot! : item)));
      }
      toast.error(err?.response?.data?.error || "Gagal update berita acara di server");
      return false;
    }
  };
  const deleteBeritaAcara: AppContextType["deleteBeritaAcara"] = async (id) => {
    let deletedSnapshot: BeritaAcara | undefined;
    setBeritaAcaraList((prev) => {
      deletedSnapshot = prev.find((item) => item.id === id);
      return prev.filter((item) => item.id !== id);
    });
    try {
      await api.delete(`/berita-acara/${id}`);
      return true;
    } catch (err: any) {
      console.error("Failed to sync delete berita acara:", err);
      if (deletedSnapshot) {
        setBeritaAcaraList((prev) => {
          const exists = prev.some((item) => item.id === deletedSnapshot!.id);
          if (exists) return prev;
          return [deletedSnapshot!, ...prev];
        });
      }
      toast.error(err?.response?.data?.error || "Gagal hapus berita acara di server");
      return false;
    }
  };

  const addSuratJalan: AppContextType["addSuratJalan"] = async (sj) => {
    const normalizedPayload = normalizeSuratJalanForSync(sj);
    setSuratJalanList((prev) => [...prev, normalizedPayload]);
    if (isActiveDeliveryStatus(normalizedPayload.deliveryStatus ?? "Pending")) {
      const linkedAsset = findAssetBySuratJalanRef(normalizedPayload);
      if (linkedAsset && linkedAsset.status !== "Scrapped") {
        syncAssetLinkedUpdate(linkedAsset.id, { status: "In Use" });
      }
    }
    try {
      const res = await api.post("/surat-jalan", normalizedPayload);
      const saved = (res?.data || normalizedPayload) as SuratJalan;
      setSuratJalanList((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [...prev, saved];
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync create surat jalan:", err);
      setSuratJalanList((prev) => prev.filter((item) => item.id !== normalizedPayload.id));
      toast.error(err?.response?.data?.error || "Gagal simpan surat jalan ke server");
      return false;
    }
  };
  const updateSuratJalan: AppContextType["updateSuratJalan"] = async (id, updates) => {
    let prevSnapshot: SuratJalan | undefined;
    let mergedPayload: SuratJalan | undefined;
    let nextSuratJalanList: SuratJalan[] | undefined;
    setSuratJalanList((prev) => {
      const next = prev.map((sj) => {
        if (sj.id === id) {
          prevSnapshot = sj;
          mergedPayload = normalizeSuratJalanForSync({ ...sj, ...updates });
          return mergedPayload;
        }
        return sj;
      });
      nextSuratJalanList = next;
      return next;
    });

    if (!mergedPayload) return false;

    const simulatedSuratJalan = nextSuratJalanList || suratJalanList;
    const prevAsset = findAssetBySuratJalanRef(prevSnapshot);
    const nextAsset = findAssetBySuratJalanRef(mergedPayload);
    const nextIsActive = isActiveDeliveryStatus(mergedPayload.deliveryStatus ?? "Pending");

    if (nextAsset && nextAsset.status !== "Scrapped" && nextIsActive) {
      syncAssetLinkedUpdate(nextAsset.id, { status: "In Use" });
    }

    if (prevAsset && (!nextIsActive || prevAsset.id !== nextAsset?.id)) {
      const idleStatus = getIdleAssetStatus(prevAsset, workOrderList, simulatedSuratJalan, maintenanceList);
      syncAssetLinkedUpdate(prevAsset.id, {
        status: idleStatus,
        projectName: idleStatus === "In Use" ? prevAsset.projectName : undefined,
      });
    }

    if (nextAsset && !nextIsActive) {
      const idleStatus = getIdleAssetStatus(nextAsset, workOrderList, simulatedSuratJalan, maintenanceList);
      syncAssetLinkedUpdate(nextAsset.id, {
        status: idleStatus,
        projectName: idleStatus === "In Use" ? nextAsset.projectName : undefined,
      });
    }

    try {
      const res = await api.patch(`/surat-jalan/${id}`, mergedPayload);
      const saved = (res?.data || mergedPayload) as SuratJalan;
      setSuratJalanList((prev) => prev.map((item) => (item.id === id ? saved : item)));
      return true;
    } catch (err: any) {
      console.error("Failed to sync update surat jalan:", err);
      if (prevSnapshot) {
        setSuratJalanList((prev) => prev.map((item) => (item.id === id ? prevSnapshot! : item)));
      }
      toast.error(err?.response?.data?.error || "Gagal update surat jalan di server");
      return false;
    }
  };
  const deleteSuratJalan: AppContextType["deleteSuratJalan"] = async (id) => {
    let deletedSnapshot: SuratJalan | undefined;
    let nextSuratJalanList: SuratJalan[] | undefined;
    setSuratJalanList((prev) => {
      deletedSnapshot = prev.find((item) => item.id === id);
      const next = prev.filter((item) => item.id !== id);
      nextSuratJalanList = next;
      return next;
    });
    const linkedAsset = findAssetBySuratJalanRef(deletedSnapshot);
    if (linkedAsset) {
      const idleStatus = getIdleAssetStatus(linkedAsset, workOrderList, nextSuratJalanList || suratJalanList, maintenanceList);
      syncAssetLinkedUpdate(linkedAsset.id, {
        status: idleStatus,
        projectName: idleStatus === "In Use" ? linkedAsset.projectName : undefined,
      });
    }
    try {
      await api.delete(`/surat-jalan/${id}`);
      return true;
    } catch (err: any) {
      console.error("Failed to sync delete surat jalan:", err);
      if (deletedSnapshot) {
        setSuratJalanList((prev) => {
          const exists = prev.some((item) => item.id === deletedSnapshot!.id);
          if (exists) return prev;
          return [deletedSnapshot!, ...prev];
        });
      }
      toast.error(err?.response?.data?.error || "Gagal hapus surat jalan di server");
      return false;
    }
  };

  /**
   * =========================
   *  ASSET & MAINTENANCE
   * =========================
   */
  const addAsset: AppContextType["addAsset"] = async (a) => {
    try {
      const res = await api.post("/assets", a);
      const saved = (res?.data || a) as Asset;
      setAssetList((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [...prev, saved];
      });
    } catch (err: any) {
      console.error("Failed to sync create asset:", err);
      toast.error(err?.response?.data?.error || "Gagal simpan asset ke server");
      throw err;
    }
  };

  const addMaintenance: AppContextType["addMaintenance"] = async (m) => {
    setMaintenanceList((prev) => [m, ...prev]);
    const linkedAsset =
      findAssetByPlateRef(m.assetCode) ||
      assetList.find((asset) => normalizeRef(asset.name) === normalizeRef(m.equipmentName));
    if (linkedAsset && linkedAsset.status !== "Scrapped") {
      const nextStatus: Asset["status"] =
        isActiveMaintenanceStatus(m.status)
          ? "Under Maintenance"
          : getIdleAssetStatus(linkedAsset, workOrderList, suratJalanList, [m, ...maintenanceList]);
      syncAssetLinkedUpdate(linkedAsset.id, { status: nextStatus });
    }
    try {
      const res = await api.post("/maintenances", m);
      const saved = (res?.data || m) as MaintenanceRecord;
      setMaintenanceList((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [saved, ...prev];
      });
    } catch (err: any) {
      console.error("Failed to sync create maintenance:", err);
      setMaintenanceList((prev) => prev.filter((item) => item.id !== m.id));
      toast.error(err?.response?.data?.error || "Gagal simpan maintenance ke server");
      throw err;
    }
    addAuditLog({
      action: "MAINTENANCE_LOGGED",
      module: "Assets",
      details: `Recorded maintenance ${m.maintenanceNo} for unit ${m.equipmentName}`,
      status: "Success",
    });
  };

  const updateAsset: AppContextType["updateAsset"] = async (id, updates) => {
    const current = assetList.find((item) => item.id === id);
    if (!current) {
      const notFoundErr = new Error(`Asset ${id} tidak ditemukan di state lokal`);
      console.error("Failed to sync update asset:", notFoundErr);
      toast.error("Asset tidak ditemukan");
      throw notFoundErr;
    }
    const mergedPayload = { ...current, ...updates } as Asset;
    try {
      const res = await api.patch(`/assets/${id}`, mergedPayload);
      const saved = (res?.data || mergedPayload) as Asset;
      setAssetList((prev) => prev.map((item) => (item.id === id ? saved : item)));
    } catch (err: any) {
      console.error("Failed to sync update asset:", err);
      toast.error(err?.response?.data?.error || "Gagal update asset di server");
      throw err;
    }
  };

  const deleteAsset: AppContextType["deleteAsset"] = async (id) => {
    const safeId = String(id || "").trim();
    if (!safeId) {
      toast.error("ID asset tidak valid. Coba refresh data dulu.");
      throw new Error("Invalid asset id");
    }
    try {
      await api.delete(`/assets/${safeId}`);
      setAssetList((prev) => prev.filter((item) => item.id !== safeId));
    } catch (err: any) {
      console.error("Failed to sync delete asset:", err);
      toast.error(err?.response?.data?.error || "Gagal hapus asset di server");
      throw err;
    }
  };

  /**
   * =========================
   *  ARCHIVE
   * =========================
   */
  const addArchiveEntry: AppContextType["addArchiveEntry"] = async (entry) => {
    const newEntry: ArchiveEntry = { ...entry, id: uid("REC") };
    setArchiveRegistry((prev) => [newEntry, ...prev]);
    try {
      const res = await api.post("/archive-registry", newEntry);
      const saved = (res?.data || newEntry) as ArchiveEntry;
      setArchiveRegistry((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [saved, ...prev];
      });
      return saved;
    } catch (err: any) {
      console.error("Failed to sync create archive entry:", err);
      setArchiveRegistry((prev) => prev.filter((item) => item.id !== newEntry.id));
      toast.error(err?.response?.data?.error || "Gagal simpan arsip ke server");
      if (err && typeof err === "object") {
        (err as { __toastShown?: boolean }).__toastShown = true;
      }
      throw err;
    }
  };

  /**
   * =========================
   *  EQUIPMENT USAGE -> store inside Project
   * =========================
   */
  const addEquipmentUsage: AppContextType["addEquipmentUsage"] = (usage) => {
    let updatedProjectEquipmentUsage: EquipmentUsage[] | undefined;
    setProjectList((prev) =>
      prev.map((p) => {
        if (p.id !== usage.projectId) return p;
        updatedProjectEquipmentUsage = [...(p.equipmentUsage || []), usage];
        return { ...p, equipmentUsage: updatedProjectEquipmentUsage };
      })
    );
    if (updatedProjectEquipmentUsage) {
      updateProject(usage.projectId, { equipmentUsage: updatedProjectEquipmentUsage });
    }
    addAuditLog({
      action: "EQUIPMENT_USAGE_LOG",
      module: "Operations",
      details: `Logged ${usage.hoursUsed}h for ${usage.equipmentName} on project ${usage.projectId}`,
      status: "Success",
    });
  };

  /**
   * =========================
   *  MATERIAL REQUESTS
   * =========================
   */
  const addMaterialRequest: AppContextType["addMaterialRequest"] = (request) => {
    setMaterialRequestList((prev) => [...prev, request]);
    addAuditLog({
      action: "MATERIAL_REQUEST_SUBMITTED",
      module: "Procurement",
      details: `Requested materials for project ${request.projectId} (${request.noRequest})`,
      status: "Success",
    });
    api
      .post("/material-requests", request)
      .then((res) => {
        const saved = (res?.data || request) as MaterialRequest;
        setMaterialRequestList((prev) => {
          const exists = prev.some((item) => item.id === saved.id);
          if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
          return [...prev, saved];
        });
      })
      .catch((err) => {
        console.error("Failed to sync create material request:", err);
        setMaterialRequestList((prev) => prev.filter((item) => item.id !== request.id));
        toast.error(err?.response?.data?.error || "Gagal simpan material request ke server");
      });
  };

  const updateMaterialRequest: AppContextType["updateMaterialRequest"] = async (id, updates) => {
    let prevSnapshot: MaterialRequest | undefined;
    let mergedPayload: MaterialRequest | undefined;
    setMaterialRequestList((prev) =>
      prev.map((mr) => {
        if (mr.id === id) {
          prevSnapshot = mr;
          mergedPayload = { ...mr, ...updates };
          return mergedPayload;
        }
        return mr;
      })
    );
    if (!mergedPayload) return;
    try {
      const res = await api.patch(`/material-requests/${id}`, mergedPayload);
      const saved = (res?.data || mergedPayload) as MaterialRequest;
      setMaterialRequestList((prev) => prev.map((mr) => (mr.id === id ? saved : mr)));
    } catch (err: any) {
      console.error("Failed to sync update material request:", err);
      if (prevSnapshot) {
        setMaterialRequestList((prev) => prev.map((mr) => (mr.id === id ? prevSnapshot! : mr)));
      }
      toast.error(err?.response?.data?.error || "Gagal update material request di server");
      throw err;
    }
  };

  const issueMaterialRequest: AppContextType["issueMaterialRequest"] = (id, issuedBy) => {
    let prevSnapshot: MaterialRequest | undefined;
    let mergedPayload: MaterialRequest | undefined;
    setMaterialRequestList((prev) =>
      prev.map((mr) => {
        if (mr.id === id) {
          prevSnapshot = mr;
          mergedPayload = { ...mr, status: "Issued" };
          return mergedPayload;
        }
        return mr;
      })
    );
    addAuditLog({
      action: "MATERIAL_REQUEST_ISSUED",
      module: "Warehouse",
      details: `Material request ${id} issued by ${issuedBy}`,
      status: "Success",
    });
    if (!mergedPayload) return;
    api
      .patch(`/material-requests/${id}`, mergedPayload)
      .then((res) => {
        const saved = (res?.data || mergedPayload) as MaterialRequest;
        setMaterialRequestList((prev) => prev.map((mr) => (mr.id === id ? saved : mr)));
      })
      .catch((err) => {
        console.error("Failed to sync issue material request:", err);
        if (prevSnapshot) {
          setMaterialRequestList((prev) => prev.map((mr) => (mr.id === id ? prevSnapshot! : mr)));
        }
        toast.error(err?.response?.data?.error || "Gagal update issue material request di server");
      });
  };

  const updateMaterialRequestStatus: AppContextType["updateMaterialRequestStatus"] = (projectId, requestId, status) => {
    let prevSnapshot: MaterialRequest | undefined;
    let mergedPayload: MaterialRequest | undefined;
    setMaterialRequestList((prev) =>
      prev.map((r) => {
        if (r.id === requestId) {
          prevSnapshot = r;
          mergedPayload = { ...r, status };
          return mergedPayload;
        }
        return r;
      })
    );
    if (!mergedPayload) return;
    api.patch(`/material-requests/${requestId}`, mergedPayload).catch((err) => {
      console.error("Failed to sync material request status update:", err);
      if (prevSnapshot) {
        setMaterialRequestList((prev) => prev.map((r) => (r.id === requestId ? prevSnapshot! : r)));
      }
      toast.error(err?.response?.data?.error || "Gagal update status material request di server");
    });
  };

  /**
   * =========================
   *  TEMPLATE APPLY
   * =========================
   */
  const applyTemplate: AppContextType["applyTemplate"] = (templateId, variables) => {
    const template = templateSuratList.find((t) => t.id === templateId);
    if (!template) return "";
    let content = template.content;
    for (const [key, val] of Object.entries(variables)) {
      content = content.replaceAll(`{{${key}}}`, val);
    }
    return content;
  };

  /**
   * =========================
   *  RESERVED STOCK
   * =========================
   */
  const updateReservedStock: AppContextType["updateReservedStock"] = (materials, type) => {
    const changedItems: StockItem[] = [];
    setStockItemList((prev) =>
      prev.map((item) => {
        const mat = materials.find((m) => m.kode === item.kode);
        if (!mat) return item;
        const updatedItem = { ...item, stok: type === "reserve" ? item.stok - mat.qty : item.stok + mat.qty };
        changedItems.push(updatedItem);
        return updatedItem;
      })
    );
    for (const item of changedItems) {
      api.patch(`/inventory/items/${item.id}`, item).catch((err) => {
        console.error("Failed to sync reserved stock update:", err);
      });
    }
  };

  /**
   * =========================
   *  VENDOR & EXPENSE
   * =========================
   */
  const addVendor: AppContextType["addVendor"] = async (vendor) => {
    setVendorList((prev) => [...prev, vendor]);
    try {
      const res = await api.post("/vendors", vendor);
      const saved = (res?.data || vendor) as Vendor;
      setVendorList((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [...prev, saved];
      });
      toast.success(`Vendor ${saved.namaVendor || vendor.namaVendor} berhasil ditambahkan!`);
      addAuditLog({
        action: "VENDOR_ADDED",
        module: "Finance",
        details: `Menambahkan vendor baru: ${saved.namaVendor || vendor.namaVendor}`,
        status: "Success",
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync create vendor:", err);
      setVendorList((prev) => prev.filter((item) => item.id !== vendor.id));
      toast.error(err?.response?.data?.error || "Gagal simpan vendor ke server");
      return false;
    }
  };

  const updateVendor: AppContextType["updateVendor"] = async (id, updates) => {
    let prevSnapshot: Vendor | undefined;
    let mergedPayload: Vendor | undefined;
    setVendorList((prev) =>
      prev.map((v) => {
        if (v.id === id) {
          prevSnapshot = v;
          mergedPayload = { ...v, ...updates };
          return mergedPayload;
        }
        return v;
      })
    );
    if (!mergedPayload) return false;
    try {
      const res = await api.patch(`/vendors/${id}`, mergedPayload);
      const saved = (res?.data || mergedPayload) as Vendor;
      setVendorList((prev) => prev.map((item) => (item.id === id ? saved : item)));
      addAuditLog({
        action: "VENDOR_UPDATED",
        module: "Finance",
        details: `Update vendor: ${saved.namaVendor || updates.namaVendor || id}`,
        status: "Success",
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync update vendor:", err);
      if (prevSnapshot) {
        setVendorList((prev) => prev.map((item) => (item.id === id ? prevSnapshot! : item)));
      }
      toast.error(err?.response?.data?.error || "Gagal update vendor di server");
      return false;
    }
  };

  const deleteVendor: AppContextType["deleteVendor"] = async (id) => {
    const vendor = vendorList.find((v) => v.id === id);
    let deletedSnapshot: Vendor | undefined;
    setVendorList((prev) => {
      deletedSnapshot = prev.find((v) => v.id === id);
      return prev.filter((v) => v.id !== id);
    });
    try {
      await api.delete(`/vendors/${id}`);
      addAuditLog({
        action: "VENDOR_DELETED",
        module: "Finance",
        details: `Menghapus vendor: ${vendor?.namaVendor || id}`,
        status: "Success",
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync delete vendor:", err);
      if (deletedSnapshot) {
        setVendorList((prev) => {
          const exists = prev.some((item) => item.id === deletedSnapshot!.id);
          if (exists) return prev;
          return [deletedSnapshot!, ...prev];
        });
      }
      toast.error(err?.response?.data?.error || "Gagal hapus vendor di server");
      return false;
    }
  };

  const addExpense: AppContextType["addExpense"] = async (expense) => {
    setExpenseList((prev) => [...prev, expense]);
    try {
      const res = await api.post("/finance/vendor-expenses", expense);
      const saved = (res?.data || expense) as VendorExpense;
      setExpenseList((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [...prev, saved];
      });
      addAuditLog({
        action: "EXPENSE_ADDED",
        module: "Finance",
        details: `Expense baru: ${saved.noExpense || expense.noExpense} - ${saved.keterangan || expense.keterangan} (Rp ${Number(saved.totalNominal || expense.totalNominal || 0).toLocaleString("id-ID")})`,
        status: "Success",
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync create expense:", err);
      setExpenseList((prev) => prev.filter((item) => item.id !== expense.id));
      toast.error(err?.response?.data?.error || "Gagal simpan expense ke server");
      return false;
    }
  };

  const updateExpense: AppContextType["updateExpense"] = async (id, updates) => {
    let prevSnapshot: VendorExpense | undefined;
    let mergedPayload: VendorExpense | undefined;
    setExpenseList((prev) =>
      prev.map((e) => {
        if (e.id === id) {
          prevSnapshot = e;
          mergedPayload = { ...e, ...updates };
          return mergedPayload;
        }
        return e;
      })
    );
    if (!mergedPayload) return false;
    try {
      const res = await api.patch(`/finance/vendor-expenses/${id}`, mergedPayload);
      const saved = (res?.data || mergedPayload) as VendorExpense;
      setExpenseList((prev) => prev.map((item) => (item.id === id ? saved : item)));
      return true;
    } catch (err: any) {
      console.error("Failed to sync update expense:", err);
      if (prevSnapshot) {
        setExpenseList((prev) => prev.map((item) => (item.id === id ? prevSnapshot! : item)));
      }
      toast.error(err?.response?.data?.error || "Gagal update expense di server");
      return false;
    }
  };

  const deleteExpense: AppContextType["deleteExpense"] = async (id) => {
    const expense = expenseList.find((e) => e.id === id);
    let deletedSnapshot: VendorExpense | undefined;
    setExpenseList((prev) => {
      deletedSnapshot = prev.find((e) => e.id === id);
      return prev.filter((e) => e.id !== id);
    });
    try {
      await api.delete(`/finance/vendor-expenses/${id}`);
      addAuditLog({
        action: "EXPENSE_DELETED",
        module: "Finance",
        details: `Menghapus expense: ${expense?.noExpense || id}`,
        status: "Success",
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync delete expense:", err);
      if (deletedSnapshot) {
        setExpenseList((prev) => {
          const exists = prev.some((item) => item.id === deletedSnapshot!.id);
          if (exists) return prev;
          return [deletedSnapshot!, ...prev];
        });
      }
      toast.error(err?.response?.data?.error || "Gagal hapus expense di server");
      return false;
    }
  };

  const approveExpense: AppContextType["approveExpense"] = async (id, approver) => {
    const expense = expenseList.find((e) => e.id === id);
    const ok = await updateExpense(id, {
      status: "Approved",
      approvedBy: approver,
      approvedAt: new Date().toISOString(),
    });
    if (!ok) return false;

    toast.success(`Expense ${expense?.noExpense || id} telah disetujui!`);
    addAuditLog({
      action: "EXPENSE_APPROVED",
      module: "Finance",
      details: `Menyetujui expense: ${expense?.noExpense || id}`,
      status: "Success",
    });
    return true;
  };

  const rejectExpense: AppContextType["rejectExpense"] = async (id, reason) => {
    const rejector = currentUser?.fullName || currentUser?.username || "System";

    const expense = expenseList.find((e) => e.id === id);
    const ok = await updateExpense(id, {
      status: "Rejected",
      rejectedBy: rejector,
      rejectedAt: new Date().toISOString(),
      rejectReason: reason,
    });
    if (!ok) return false;

    toast.error(`Expense ${expense?.noExpense || id} ditolak!`);
    addAuditLog({
      action: "EXPENSE_REJECTED",
      module: "Finance",
      details: `Menolak expense: ${expense?.noExpense || id} - Alasan: ${reason}`,
      status: "Warning",
    });
    return true;
  };

  /**
   * =========================
   *  CUSTOMER & AR
   * =========================
   */
  const addCustomer: AppContextType["addCustomer"] = async (customer) => {
    setCustomerList((prev) => [...prev, customer]);
    try {
      const res = await api.post("/customers", customer);
      const saved = (res?.data || customer) as Customer;
      setCustomerList((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [...prev, saved];
      });
      toast.success(`Customer ${saved.namaCustomer || customer.namaCustomer} berhasil ditambahkan!`);
      addAuditLog({
        action: "CUSTOMER_ADDED",
        module: "Finance",
        details: `Menambahkan customer baru: ${saved.namaCustomer || customer.namaCustomer}`,
        status: "Success",
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync create customer:", err);
      setCustomerList((prev) => prev.filter((item) => item.id !== customer.id));
      toast.error(err?.response?.data?.error || "Gagal simpan customer ke server");
      return false;
    }
  };

  const updateCustomer: AppContextType["updateCustomer"] = async (id, updates) => {
    let prevSnapshot: Customer | undefined;
    let mergedPayload: Customer | undefined;
    setCustomerList((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          prevSnapshot = c;
          mergedPayload = { ...c, ...updates };
          return mergedPayload;
        }
        return c;
      })
    );
    if (!mergedPayload) return false;
    try {
      const res = await api.patch(`/customers/${id}`, mergedPayload);
      const saved = (res?.data || mergedPayload) as Customer;
      setCustomerList((prev) => prev.map((item) => (item.id === id ? saved : item)));
      addAuditLog({
        action: "CUSTOMER_UPDATED",
        module: "Finance",
        details: `Mengupdate data customer: ${saved.namaCustomer || id}`,
        status: "Success",
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync update customer:", err);
      if (prevSnapshot) {
        setCustomerList((prev) => prev.map((item) => (item.id === id ? prevSnapshot! : item)));
      }
      toast.error(err?.response?.data?.error || "Gagal update customer di server");
      return false;
    }
  };

  const deleteCustomer: AppContextType["deleteCustomer"] = async (id) => {
    const customer = customerList.find((c) => c.id === id);
    let deletedSnapshot: Customer | undefined;
    setCustomerList((prev) => {
      deletedSnapshot = prev.find((c) => c.id === id);
      return prev.filter((c) => c.id !== id);
    });
    try {
      await api.delete(`/customers/${id}`);
      addAuditLog({
        action: "CUSTOMER_DELETED",
        module: "Finance",
        details: `Menghapus customer: ${customer?.namaCustomer || id}`,
        status: "Success",
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync delete customer:", err);
      if (deletedSnapshot) {
        setCustomerList((prev) => {
          const exists = prev.some((item) => item.id === deletedSnapshot!.id);
          if (exists) return prev;
          return [deletedSnapshot!, ...prev];
        });
      }
      toast.error(err?.response?.data?.error || "Gagal hapus customer di server");
      return false;
    }
  };

  const addCustomerInvoice: AppContextType["addCustomerInvoice"] = async (invoice) => {
    setCustomerInvoiceList((prev) => [...prev, invoice]);
    try {
      const res = await api.post("/finance/customer-invoices", invoice);
      const saved = (res?.data || invoice) as CustomerInvoice;
      setCustomerInvoiceList((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [...prev, saved];
      });
      toast.success(`Invoice ${saved.noInvoice || invoice.noInvoice} berhasil dibuat!`);
      addAuditLog({
        action: "INVOICE_CREATED",
        module: "Finance",
        details: `Membuat invoice baru: ${saved.noInvoice || invoice.noInvoice} - ${saved.customerName || invoice.customerName}`,
        status: "Success",
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync create customer invoice:", err);
      setCustomerInvoiceList((prev) => prev.filter((item) => item.id !== invoice.id));
      toast.error(err?.response?.data?.error || "Gagal simpan customer invoice ke server");
      return false;
    }
  };

  const updateCustomerInvoice: AppContextType["updateCustomerInvoice"] = async (id, updates) => {
    let prevSnapshot: CustomerInvoice | undefined;
    let mergedPayload: CustomerInvoice | undefined;
    setCustomerInvoiceList((prev) =>
      prev.map((inv) => {
        if (inv.id === id) {
          prevSnapshot = inv;
          mergedPayload = { ...inv, ...updates };
          return mergedPayload;
        }
        return inv;
      })
    );
    if (!mergedPayload) return false;

    try {
      const res = await api.patch(`/finance/customer-invoices/${id}`, mergedPayload);
      const saved = (res?.data || mergedPayload) as CustomerInvoice;
      setCustomerInvoiceList((prev) => prev.map((item) => (item.id === id ? saved : item)));

      if (updates.status === "Sent") {
        toast.success(`Invoice ${saved?.noInvoice || id} berhasil dikirim!`);
        addAuditLog({
          action: "INVOICE_SENT",
          module: "Finance",
          details: `Mengirim invoice: ${saved?.noInvoice || id} ke ${saved?.customerName || "-"}`,
          status: "Success",
        });
      }

      return true;
    } catch (err: any) {
      console.error("Failed to sync update customer invoice:", err);
      if (prevSnapshot) {
        setCustomerInvoiceList((prev) => prev.map((item) => (item.id === id ? prevSnapshot! : item)));
      }
      toast.error(err?.response?.data?.error || "Gagal update customer invoice di server");
      return false;
    }
  };

  const deleteCustomerInvoice: AppContextType["deleteCustomerInvoice"] = async (id) => {
    const inv = customerInvoiceList.find((x) => x.id === id);
    let deletedSnapshot: CustomerInvoice | undefined;
    setCustomerInvoiceList((prev) => {
      deletedSnapshot = prev.find((x) => x.id === id);
      return prev.filter((x) => x.id !== id);
    });
    try {
      await api.delete(`/finance/customer-invoices/${id}`);
      toast.success(`Invoice ${inv?.noInvoice || id} berhasil dihapus!`);
      addAuditLog({
        action: "INVOICE_DELETED",
        module: "Finance",
        details: `Menghapus invoice: ${inv?.noInvoice || id}`,
        status: "Success",
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync delete customer invoice:", err);
      if (deletedSnapshot) {
        setCustomerInvoiceList((prev) => {
          const exists = prev.some((item) => item.id === deletedSnapshot!.id);
          if (exists) return prev;
          return [deletedSnapshot!, ...prev];
        });
      }
      toast.error(err?.response?.data?.error || "Gagal hapus customer invoice di server");
      return false;
    }
  };

  const addInvoicePayment: AppContextType["addInvoicePayment"] = async (invoiceId, payment) => {
    let prevSnapshot: CustomerInvoice | undefined;
    let mergedPayload: CustomerInvoice | undefined;
    setCustomerInvoiceList((prev) =>
      prev.map((inv) => {
        if (inv.id !== invoiceId) return inv;
        prevSnapshot = inv;
        const newPaid = inv.paidAmount + payment.nominal;
        const newOutstanding = inv.totalNominal - newPaid;
        const newStatus: InvoiceStatus = newOutstanding <= 0 ? "Paid" : "Partial Paid";
        mergedPayload = {
          ...inv,
          paidAmount: newPaid,
          outstandingAmount: Math.max(0, newOutstanding),
          status: newStatus,
          paymentHistory: [...inv.paymentHistory, payment],
        };
        return mergedPayload;
      })
    );
    if (!mergedPayload) return false;
    try {
      const res = await api.patch(`/finance/customer-invoices/${invoiceId}`, mergedPayload);
      const saved = (res?.data || mergedPayload) as CustomerInvoice;
      setCustomerInvoiceList((prev) => prev.map((item) => (item.id === invoiceId ? saved : item)));

      const inv = customerInvoiceList.find((x) => x.id === invoiceId);
      toast.success(`Pembayaran Rp ${payment.nominal.toLocaleString("id-ID")} berhasil dicatat!`);
      addAuditLog({
        action: "PAYMENT_RECEIVED",
        module: "Finance",
        details: `Pembayaran invoice ${inv?.noInvoice || invoiceId} Rp ${payment.nominal.toLocaleString("id-ID")}`,
        status: "Success",
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync invoice payment:", err);
      if (prevSnapshot) {
        setCustomerInvoiceList((prev) => prev.map((item) => (item.id === invoiceId ? prevSnapshot! : item)));
      }
      toast.error(err?.response?.data?.error || "Gagal sinkron pembayaran invoice ke server");
      return false;
    }
  };

  /**
   * =========================
   *  VENDOR INVOICE
   * =========================
   */
  const addVendorInvoice: AppContextType["addVendorInvoice"] = async (inv) => {
    setVendorInvoiceList((prev) => [...prev, inv]);
    try {
      const res = await api.post("/finance/vendor-invoices", inv);
      const saved = (res?.data || inv) as VendorInvoice;
      setVendorInvoiceList((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
        return [...prev, saved];
      });
      return true;
    } catch (err: any) {
      console.error("Failed to sync create vendor invoice:", err);
      setVendorInvoiceList((prev) => prev.filter((item) => item.id !== inv.id));
      toast.error(err?.response?.data?.error || "Gagal simpan invoice vendor ke server");
      return false;
    }
  };

  const updateVendorInvoice: AppContextType["updateVendorInvoice"] = async (id, updates) => {
    let prevSnapshot: VendorInvoice | undefined;
    let mergedPayload: VendorInvoice | undefined;
    setVendorInvoiceList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          prevSnapshot = item;
          mergedPayload = { ...item, ...updates };
          return mergedPayload;
        }
        return item;
      })
    );
    if (!mergedPayload) return false;
    try {
      const res = await api.patch(`/finance/vendor-invoices/${id}`, mergedPayload);
      const saved = (res?.data || mergedPayload) as VendorInvoice;
      setVendorInvoiceList((prev) => prev.map((item) => (item.id === id ? saved : item)));
      return true;
    } catch (err: any) {
      console.error("Failed to sync update vendor invoice:", err);
      if (prevSnapshot) {
        setVendorInvoiceList((prev) => prev.map((item) => (item.id === id ? prevSnapshot! : item)));
      }
      toast.error(err?.response?.data?.error || "Gagal update invoice vendor di server");
      return false;
    }
  };

  /**
   * =========================
   *  PAYROLL
   * =========================
   */
  const generatePayroll: AppContextType["generatePayroll"] = (month, year) => {
    const p: Payroll = {
      id: uid("PAY"),
      month,
      year: parseInt(year, 10),
      totalPayroll: 0,
      status: "Pending",
      employeeCount: employeeList.length,
    };
    setPayrollList((prev) => [p, ...prev]);
    api
      .post("/payrolls", p)
      .then((res) => {
        const saved = (res?.data || p) as Payroll;
        setPayrollList((prev) => {
          const exists = prev.some((item) => item.id === saved.id);
          if (exists) return prev.map((item) => (item.id === saved.id ? saved : item));
          return [saved, ...prev];
        });
      })
      .catch((err) => {
        console.error("Failed to sync create payroll:", err);
        setPayrollList((prev) => prev.filter((item) => item.id !== p.id));
        toast.error(err?.response?.data?.error || "Gagal simpan payroll ke server");
      });
  };

  const refreshAll: AppContextType["refreshAll"] = async () => {
    if (!currentUser) {
      toast.error("Silakan login ulang.");
      return;
    }

    try {
      await Promise.all([
        loadProjects(),
        loadResource<Invoice>("invoices", setInvoiceList),
        loadQuotations(),
        loadPurchaseOrders(),
        loadReceivings(),
        loadResource<StockItem>("stock-items", setStockItemList),
        loadStockMovements(),
        loadStockIns(),
        loadStockOuts(),
        loadResource<StockOpname>("stock-opnames", setStockOpnameList),
        loadWorkOrders(),
        loadResource<ProductionReport>("production-reports", setProductionReportList),
        loadResource<ProductionTracker>("production-trackers", setProductionTrackerList),
        loadResource<QCInspection>("qc-inspections", setQcInspectionList),
        loadEmployees(),
        loadAttendances(),
        loadSuratJalan(),
        loadResource<BeritaAcara>("berita-acara", setBeritaAcaraList),
        loadResource<SuratMasuk>("surat-masuk", setSuratMasukList),
        loadResource<SuratKeluar>("surat-keluar", setSuratKeluarList),
        loadResource<TemplateSurat>("template-surat", setTemplateSuratList),
        loadResource<Asset>("assets", setAssetList),
        loadResource<MaintenanceRecord>("maintenances", setMaintenanceList),
        loadMaterialRequests(),
        loadDataCollections(),
        loadResource<Payroll>("payrolls", setPayrollList),
        loadResource<ArchiveEntry>("archive-registry", setArchiveRegistry),
        loadResource<AuditLog>("audit-logs", setAuditLogs).catch(() => setAuditLogs([])),
        loadResource<Vendor>("vendors", setVendorList),
        loadResource<VendorExpense>("vendor-expenses", setExpenseList),
        loadResource<VendorInvoice>("vendor-invoices", setVendorInvoiceList),
        loadResource<Customer>("customers", setCustomerList),
        loadResource<CustomerInvoice>("customer-invoices", setCustomerInvoiceList),
      ]);

      try {
        const userRes = await api.get("/users");
        const users = Array.isArray(userRes.data) ? userRes.data : userRes.data ? [userRes.data] : [];
        setUserList(users);
      } catch {
        setUserList([]);
      }

      hasHydratedFromBackend.current = true;
      canPersistToBackend.current = true;
      hasInitializedAutoSyncSnapshot.current = false;
      lastSyncedSignaturesRef.current = {};
      toast.success("Data berhasil di-refresh dari backend.");
    } catch {
      toast.error("Gagal refresh data dari backend.");
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeDataSync(() => {
      if (!currentUser) return;

      void refreshCoreLinkedData().catch(() => {
        // Keep UI running; page-level fetchers can still recover.
      });
    });
    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const REALTIME_SYNC_INTERVAL_MS = 30000;
    let stopped = false;

    const pull = async () => {
      if (stopped) return;
      if (document.hidden) return;
      if (window.location.pathname.includes("/produksi/dashboard")) return;
      try {
        await refreshRealtimeCoreData();
      } catch {
        // keep UI responsive; next interval will retry
      }
    };

    void pull();
    const interval = window.setInterval(() => {
      void pull();
    }, REALTIME_SYNC_INTERVAL_MS);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [currentUser?.id]);

  const resetAllData: AppContextType["resetAllData"] = () => {
    setUserList([]);
    setProjectList([]);
    setInvoiceList([]);
    setQuotationList([]);
    setPoList([]);
    setReceivingList([]);

    setStockItemList([]);
    setStockMovementList([]);
    setStockInList([]);
    setStockOutList([]);
    setStockOpnameList([]);

    setWorkOrderList([]);
    setProductionReportList([]);
    setProductionTrackerList([]);
    setQcInspectionList([]);

    setEmployeeList([]);
    setAttendanceList([]);

    setSuratJalanList([]);
    setBeritaAcaraList([]);
    setSuratMasukList([]);
    setSuratKeluarList([]);
    setTemplateSuratList([]);

    setAssetList([]);
    setMaintenanceList([]);

    setMaterialRequestList([]);
    setDataCollectionList([]);
    setPayrollList([]);

    setArchiveRegistry([]);
    setAuditLogs([]);

    setVendorList([]);
    setExpenseList([]);
    setVendorInvoiceList([]);

    setCustomerList([]);
    setCustomerInvoiceList([]);

    setAlerts([]);
    hasInitializedAutoSyncSnapshot.current = false;
    lastSyncedSignaturesRef.current = {};
  };

  const syncCurrentUserFromAuthState = () => {
    const persistedUser = readPersistedAuthUser();
    if (persistedUser) {
      setCurrentUser(persistedUser);
      return;
    }

    persistAuthUser(null);
    setCurrentUser(null);
  };

  /**
   * =========================
   *  MEMOIZED VALUE
   * =========================
   */
  const value: AppContextType = useMemo(
    () => ({
      projectList,
      invoiceList,
      stockItemList,
      employeeList,
      attendanceList,
      workOrderList,
      productionReportList,
      productionTrackerList,
      qcInspectionList,
      stockInList,
      stockOutList,
      stockOpnameList,
      stockMovementList,
      receivingList,
      suratJalanList,
      assetList,
      quotationList,
      poList,
      vendorInvoiceList,
      userList,
      materialRequestList,
      maintenanceList,
      dataCollectionList,
      payrollList,
      suratMasukList,
      suratKeluarList,
      beritaAcaraList,
      templateSuratList,
      archiveRegistry,
      auditLogs,
      vendorList,
      expenseList,
      customerList,
      customerInvoiceList,
      currentUser,

      alerts,
      markAlertAsRead,

      login,
      refreshAll,
      resetAllData,

      addAuditLog,

      updateUser,
      updateProject,

      addEmployee,
      updateEmployee,
      deleteEmployee,

      addAttendance,
      addAttendanceBulk,
      updateAttendance,
      deleteAttendance,

      recordProduction,
      addQCInspection,

      addWorkOrder,
      updateWorkOrder,
      deleteWorkOrder,

      createStockIn,
      createStockOut,
      addStockIn,
      addStockOut,
      addStockOpname,
      confirmStockOpname,

      addReceiving,

      addInvoice,
      updateInvoice,
      addPO,

      addProductionReport,
      handleProductionOutput,

      updatePO,
      approveProject,
      rejectProject,
      unlockProject,
      relockProject,

      updateMaterialRequest,
      issueMaterialRequest,

      addDataCollection,
      updateDataCollection,
      deleteDataCollection,

      addProject,
      deleteProject,

      addQuotation,
      updateQuotation,
      deleteQuotation,

      addVendorInvoice,
      updateVendorInvoice,

      generatePayroll,

      addSuratMasuk,
      updateSuratMasuk,
      deleteSuratMasuk,

      addSuratKeluar,
      updateSuratKeluar,
      deleteSuratKeluar,

      addBeritaAcara,
      updateBeritaAcara,
      deleteBeritaAcara,

      addSuratJalan,
      updateSuratJalan,
      deleteSuratJalan,

      addAsset,
      addMaintenance,
      updateAsset,
      deleteAsset,

      addArchiveEntry,
      addEquipmentUsage,

      addMaterialRequest,
      updateMaterialRequestStatus,

      applyTemplate,

      updateReservedStock,

      setStockItemList,
      setStockMovementList,
      setPoList,

      convertDataCollectionToQuotation,
      convertQuotationToProject,

      addVendor,
      updateVendor,
      deleteVendor,

      addExpense,
      updateExpense,
      deleteExpense,
      approveExpense,
      rejectExpense,

      addCustomer,
      updateCustomer,
      deleteCustomer,

      addCustomerInvoice,
      updateCustomerInvoice,
      deleteCustomerInvoice,
      addInvoicePayment,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      projectList,
      invoiceList,
      stockItemList,
      employeeList,
      attendanceList,
      workOrderList,
      productionReportList,
      productionTrackerList,
      qcInspectionList,
      stockInList,
      stockOutList,
      stockOpnameList,
      stockMovementList,
      receivingList,
      suratJalanList,
      assetList,
      quotationList,
      poList,
      vendorInvoiceList,
      userList,
      materialRequestList,
      maintenanceList,
      dataCollectionList,
      payrollList,
      suratMasukList,
      suratKeluarList,
      beritaAcaraList,
      templateSuratList,
      archiveRegistry,
      auditLogs,
      vendorList,
      expenseList,
      customerList,
      customerInvoiceList,
      currentUser,
      alerts,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

/**
 * =========================
 *  HOOK
 * =========================
 */
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within an AppProvider");
  return ctx;
};
