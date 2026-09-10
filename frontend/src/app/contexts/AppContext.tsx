import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useStoredState } from '../utils/useStoredState';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

import { toast } from 'sonner';
import {
  seedBeritaAcaraList,
  seedVendorList,
  seedVendorInvoiceList,
  seedExpenseList,
  seedCustomerList,
  seedCustomerInvoiceList,
  seedProjectList,
  seedDataCollectionList,
  seedPettyCashList,
  seedAuditLogs,
  seedThlList,
  seedShiftList,
  seedRefreshProjects,
  seedRefreshQuotations,
  seedRefreshEmployees,
  seedEmployeeCompensations,
  seedAttendanceAug2026,
} from './seedData';

// Demo seed hanya boleh hidup saat development lokal atau ketika secara
// eksplisit diaktifkan. Database production tidak boleh pernah diisi ulang
// oleh data contoh dari browser.
const DEMO_MODE_ENABLED = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true';

// --- Types ---
export interface User {
  id: string;
  username: string;
  password?: string;
  email?: string;
  phone?: string;
  signatureUrl?: string;
  fullName: string;
  role: string;
  department?: string;
  status?: string;
  lastLogin?: any;
  createdAt?: string;
}

type BackendUser = {
  id: string;
  email?: string;
  username: string;
  name?: string | null;
  phone?: string | null;
  role: string;
  isActive?: boolean;
  lastLogin?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
};

const backendRoleToLabel: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  FINANCE_ACCOUNTING: 'Finance & Accounting',
  SALES_MARKETING: 'Sales & Marketing',
  OPERATIONAL_PRODUCTION: 'Operasional & Produksi',
  HR: 'HR',
  HSE: 'HSE',
  MANAGER: 'Manager',
  SPV: 'Supervisor',
};

const roleLabelToBackend: Record<string, string> = Object.fromEntries(
  Object.entries(backendRoleToLabel).map(([key, value]) => [value, key])
);

const departmentFromRole = (role: string) => ({
  Owner: 'Management',
  Admin: 'System Administration',
  'Finance & Accounting': 'Finance & Accounting',
  'Sales & Marketing': 'Sales & Marketing',
  'Operasional & Produksi': 'Operasional & Produksi',
  HR: 'Human Capital',
  HSE: 'HSE',
  Manager: 'Management',
  Supervisor: 'Operations',
}[role] || role);

const mapBackendUser = (user: BackendUser): User => {
  const role = backendRoleToLabel[user.role] || user.role;
  return {
    id: user.id,
    username: user.username,
    email: user.email || '',
    phone: user.phone || '',
    fullName: user.name || user.username,
    role,
    department: departmentFromRole(role),
    status: user.isActive === false ? 'Inactive' : 'Active',
    lastLogin: user.lastLogin || user.lastLoginAt || null,
    createdAt: user.createdAt,
  };
};

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
  nomorSPK?: string;
  projectId: string;
  projectName: string;
  itemToProduce: string;
  targetQty: number;
  targetUnit?: string;
  completedQty?: number;
  status: 'Draft' | 'In Progress' | 'QC' | 'Completed';
  priority: 'Low' | 'Normal' | 'Urgent';
  deadline: string;
  leadTechnician: string;
  machineId?: string;
  bom?: any[];
  startDate?: string;
  endDate?: string;
  spkId?: string;
  nomorSPK?: string;
  teknisiRows?: any[];
  jenisSPK?: string;
  jamMasuk?: string;
  jamKeluar?: string;
}

export interface DimensionMeasurement {
  parameter: string; // H, H1, W, W1, W2, R, D, etc
  specification: string; // e.g., "75mm", "120mm"
  sample1: string;
  sample2: string;
  sample3: string;
  sample4: string;
  result: 'OK' | 'NG';
}

export interface QCInspection {
  id: string;
  tanggal: string;
  batchNo: string;
  itemNama: string;
  qtyInspected: number;
  qtyPassed: number;
  qtyRejected: number;
  inspectorName: string;
  status: 'Passed' | 'Rejected' | 'Partial';
  notes?: string;
  visualCheck: boolean;
  dimensionCheck: boolean;
  materialCheck: boolean;
  photoUrl?: string;
  woNumber?: string;
  workOrderId?: string;
  projectId?: string;
  sendToWarehouse?: boolean;
  warehouseLocation?: string;
  stockCategory?: string;
  // NEW: Inspection Report Fields
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
  status: 'H' | 'A' | 'I' | 'S';
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

export interface MaterialUsageReport {
  id: string;
  projectId: string;
  reportNumber: string;
  spkNumber: string;
  date: string;
  location: string;
  customerName: string;
  items: {
    id: string;
    materialName: string;
    unit: string;
    pengambilan: number;
    terpasang: number;
    sisa: number;
    keterangan?: string;
  }[];
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

export interface ProjectMilestone {
  id: string;
  nama: string;
  persentase: number;
  nilaiTermin: number;
  tanggalTarget: string;
  tanggalActual?: string;
  status: 'Belum Mulai' | 'Dalam Proses' | 'Selesai';
  invoiceId?: string;
  keterangan?: string;
}

export interface ProjectMutation {
  id: string;
  noMutation: string;
  tanggal: string;
  deskripsi: string;
  jenisPerubahan: 'Tambah Pekerjaan' | 'Kurang Pekerjaan' | 'Perpanjangan Waktu' | 'Lain-lain';
  nilaiPerubahan: number;
  status: 'Pending' | 'Disetujui' | 'Ditolak';
  disetujuiOleh?: string;
  tanggalDisetujui?: string;
  catatan?: string;
}

export interface Project {
  id: string;
  kodeProject?: string;
  namaProject: string;
  customer: string;
  nilaiKontrak: number;
  status: string;
  progress: number;
  endDate: string;
  budget?: any;
  boq?: any[];
  milestones?: ProjectMilestone[];
  mutations?: ProjectMutation[];
  quotationId?: string;
  fieldAttendance?: FieldAttendanceRecord[];
  workingExpenses?: WorkingExpenseRecord[];
  materialUsageReports?: MaterialUsageReport[];
  equipmentUsage?: EquipmentUsage[];
  materialRequests?: MaterialRequest[];
  approvalStatus?: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvedAt?: string;
  spkList?: any[];
  workOrders?: any[];
  kasbon?: any[];
  kasbonTHL?: any[];
}

export interface PurchaseOrder {
  id: string;
  noPO: string;
  tanggal: string;
  supplier: string;
  total: number;
  status: 'Draft' | 'Sent' | 'Approved' | 'Partial' | 'Received' | 'Rejected';
  projectId?: string;
  mrId?: string;
  mrNo?: string;
  items: any[];
}

export interface Quotation {
  id: string;
  customerId?: string;
  nomorQuotation?: string;
  noPenawaran?: string;
  revisi?: string;
  tanggal: string;
  jenisQuotation?: 'Jasa' | 'Material';
  customer?: {
    nama: string;
    alamat?: string;
    pic?: string;
  };
  kepada?: string;
  lokasi?: string;
  up?: string;
  lampiran?: string;
  perihal: string;
  sections?: Array<{
    id: string;
    label: string;
    title: string;
    items: Array<{
      id: string;
      keterangan: string;
      satuan: string;
      hargaUnit: number;
      jumlah: number;
      total: number;
    }>;
    subtotal: number;
  }>;
  totalSebelumDiskon?: number;
  diskonPersen?: number;
  diskonNominal?: number;
  grandTotal: number;
  totalCost?: number;
  totalSelling?: number;
  discount?: number;
  grossProfit?: number;
  marginPercent?: number;
  ppnPercent?: number;
  ppnAmount?: number;
  grandTotalWithTax?: number;
  terms?: string[];
  status: 'Planning' | 'Pending Approval' | 'Approved' | 'In Progress' | 'Pending Review' | 'On Hold' | 'Complete' | 'Rejected' | 'Draft' | 'Sent' | 'Revised';
  createdBy?: string;
  createdAt?: string;
  sentAt?: string;
  approvedAt?: string;
  projectId?: string;
  convertedToPO?: boolean;
  poId?: string;
  sectionsHTML?: string;
  materials?: any[];
  manpower?: any[];
  consumables?: any[];
  equipment?: any[];
  notes?: any;
  dataCollectionId?: string;
  terminology?: 'RAB' | 'SOW';
  type?: 'Direct' | 'Project';
  subtotal?: number;
  ppn?: number;
  kotaPenempatan?: string;
  untukPerhatian?: string;
  internalApprovalStatus?: 'Pending' | 'Approved' | 'Rejected' | 'Revision';
  internalApprovedBy?: string;
  internalApprovedAt?: string;
  internalRejectReason?: string;
  clientApprovalStatus?: 'Pending' | 'Approved' | 'Rejected' | 'Revision';
  clientApprovedAt?: string;
  clientRejectReason?: string;
  clientNote?: string;
  convertedToProject?: boolean;
  quotationApprovalHistory?: Array<{
    action: 'Internal Approved' | 'Internal Rejected' | 'Internal Revision' | 'Client Approved' | 'Client Rejected' | 'Client Revision';
    by: string;
    date: string;
    reason?: string;
  }>;
  revisionNo?: number;
  revisionHistory?: Array<{
    no: number;
    date: string;
    by: string;
    reason: string;
    trigger: 'Internal' | 'Client';
    grandTotal: number;
    perihal: string;
    sections?: any[];
  }>;
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

export interface StockIn {
  id: string;
  noStockIn: string;
  noSuratJalan?: string;
  tanggal: string;
  type: 'Receiving' | 'Return' | 'Adjustment' | 'Production Output';
  status: 'Posted' | 'Draft';
  createdBy: string;
  items: any[];
  notes?: string;
  noPO?: string;
  projectId?: string;
  workOrderId?: string;
  qcInspectionId?: string;
  warehouseLocation?: string;
  stockCategory?: string;
}

export interface StockOut {
  id: string;
  noStockOut: string;
  noWorkOrder?: string;
  workOrderId?: string;
  projectId?: string;
  penerima: string;
  tanggal: string;
  type: 'Project Issue' | 'Sales' | 'Adjustment';
  status: 'Posted' | 'Draft';
  createdBy: string;
  items: any[];
  notes?: string;
}

export interface StockMovement {
  id: string;
  tanggal: string;
  type: 'IN' | 'OUT';
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
  projectName?: string;
  projectId?: string;
  unitPrice?: number;
  batchNo?: string;
  expiryDate?: string;
  supplier?: string;
  notes?: string;
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
  status: 'Pending' | 'Partial' | 'Complete' | 'Rejected';
  items: any[];
  fotoSuratJalan?: string;
  lokasiGudang?: string;
  projectId?: string;
}

export interface SuratJalan {
  id: string;
  noSurat: string;
  tanggal: string;
  
  // NEW: Type Toggle
  sjType: 'Material Delivery' | 'Equipment Loan';
  
  tujuan: string;
  alamat: string;
  upPerson?: string; // NEW: untuk "UP/"
  noPO?: string;
  projectId?: string;
  sopir?: string;
  noPolisi?: string;
  pengirim?: string;
  deliveryStatus?: 'Pending' | 'On Delivery' | 'Delivered' | 'In Transit' | 'Returned';
  deliveredAt?: string;
  podName?: string;
  podTime?: string;
  items: Array<{
    namaItem: string;
    itemKode?: string; // Optional for Equipment Loan
    jumlah: number;
    satuan: string;
    batchNo?: string; // Only for Material Delivery
    keterangan?: string; // Only for Equipment Loan
  }>;
  
  // For Equipment Loan only
  expectedReturnDate?: string;
  actualReturnDate?: string;
  returnStatus?: 'Pending' | 'Partial' | 'Complete';
  
  createdAt?: string;
}

export interface BeritaAcara {
  id: string;
  noBA?: string;
  noBeritaAcara?: string;
  tanggal: string;
  tempatTanggal?: string;
  jenisBA?: 'Serah Terima Barang' | 'Penerimaan Pekerjaan' | 'Inspeksi' | 'Rapat' | 'Pengembalian Alat' | 'Custom';
  jenis?: 'Penyelesaian Pekerjaan' | 'Serah Terima' | 'Rapat' | 'Pemeriksaan' | 'Pemusnahan' | 'Lainnya';
  perihal?: string;
  pihakPertama?: string;
  pihakPertamaJabatan?: string;
  pihakKedua?: string;
  pihakKeduaJabatan?: string;
  lokasi?: string;
  contentHTML?: string;
  refSuratJalan?: string;
  refProject?: string;
  status?: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvedAt?: string;
  ownerSignatureUrl?: string;
  rejectionReason?: string;
  refProject?: string;
  ttdPihakPertama?: string;
  ttdPihakKedua?: string;
  saksi1?: string;
  saksi2?: string;
  namaPihakPertama?: string;
  perusahaanPihakPertama?: string;
  alamatPihakPertama?: string;
  namaPihakKedua?: string;
  perusahaanPihakKedua?: string;
  alamatPihakKedua?: string;
  peserta?: any[];
  deskripsi?: string;
  status?: 'Draft' | 'Final' | 'Disetujui';
  projectId?: string;
  projectName?: string;
  noPO?: string;
  tanggalPO?: string;
  tanggalPelaksanaanMulai?: string;
  tanggalPelaksanaanSelesai?: string;
  createdBy?: string;
  createdAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  pihakPertamaNama?: string;
  pihakKeduaNama?: string;
}


export interface Invoice {
  id: string;
  noInvoice: string;
  tanggal: string;
  jatuhTempo: string;
  customer: string;
  alamat: string;
  noPO: string;
  perihal?: string;
  items: Array<{
    deskripsi: string;
    qty: number;
    unit: string;
    hargaSatuan: number;
    total: number;
  }>;
  subtotal: number;
  ppn: number;
  totalBayar: number;
  paidAmount?: number;
  status: 'Draft' | 'Sent' | 'Unpaid' | 'Partial' | 'Paid' | 'Overdue';
  source?: 'manual' | 'quotation' | 'sj';
  quotationId?: string;
  terminType?: 'full' | 'dp' | 'progress' | 'final';
  terminLabel?: string;
  terminPercent?: number;
  projectId?: string;
  buktiTransfer?: string;
  noKwitansi?: string;
  tanggalBayar?: string;
  createdBy?: string;
  createdAt?: string;
  sentAt?: string;
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
  woNumber?: string;
  nomorSPK?: string;
  selectedItem?: string;
  namaBarang?: string;
  qcStatus?: 'Pending' | 'Passed' | 'Failed';
  projectId?: string;
  workOrderId?: string;
}

export interface MaterialRequest {
  id: string;
  noRequest: string;
  projectName: string;
  projectId: string;
  requestedBy: string;
  requestedAt: string;
  status: 'Pending' | 'Approved' | 'Issued' | 'Rejected' | 'Ordered' | 'Delivered';
  items: Array<{
    itemKode: string;
    itemNama: string;
    qty: number;
    unit: string;
  }>;
  keterangan?: string;
  rejectReason?: string;
  poId?: string;
  poNo?: string;
}

export interface MaintenanceRecord {
  id: string;
  maintenanceNo: string;
  equipmentName: string;
  assetCode: string;
  maintenanceType: 'Routine' | 'Repair' | 'Overhaul';
  scheduledDate?: string;
  completedDate?: string;
  status: 'Scheduled' | 'In Progress' | 'Completed';
  cost: number;
  performedBy: string;
  notes?: string;
}

export interface DataCollection {
  id: string;
  noKoleksi: string;
  namaResponden: string;
  kategori: string; // Make it flexible to accept any category
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
  status: 'Pending' | 'Approved' | 'Disbursed';
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
  purchaseOrderId?: string;
  noInvoiceVendor: string;
  supplier: string;
  noPO: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount?: number;
  status: 'Draft' | 'Pending' | 'Approved' | 'Unpaid' | 'Partial' | 'Paid' | 'Overdue' | 'Rejected';
  jatuhTempo: string;
  tanggal?: string;
  projectId?: string;
  ppn?: number;
  keterangan?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedReason?: string;
  sentAt?: string;
  paymentHistory?: { id?: string; tanggal: string; nominal: number; metodeBayar?: string; noBukti?: string; bank?: string; noRekening?: string; keterangan?: string }[];
  approvalHistory?: { action: 'Approved' | 'Rejected' | 'Revision'; by: string; date: string; reason?: string }[];
}











export interface SuratMasuk {
  id: string;
  noSurat: string;
  tanggalTerima: string;
  tanggalSurat: string;
  pengirim: string;
  perihal: string;
  jenisSurat: string;
  prioritas: 'Low' | 'Normal' | 'High' | 'Urgent';
  status: 'Baru' | 'Disposisi' | 'Proses' | 'Selesai';
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
  status: 'Draft' | 'Review' | 'Approved' | 'Sent';
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
  kategori: 'Material' | 'Equipment' | 'Service' | 'Subcontractor';
  alamat?: string;
  kontak?: string;
  telepon?: string;
  email?: string;
  npwp?: string;
  paymentTerms?: string;
  status: 'Active' | 'Inactive';
  rating: number; // 1-5
  createdAt: string;
}

export interface VendorExpense {
  id: string;
  noExpense: string;
  tanggal: string;
  vendorId: string;
  vendorName: string;
  penerima?: string;
  projectId?: string;
  projectName?: string;
  rabItemId?: string;
  rabItemName?: string;
  kategori:
    | 'Material'
    | 'Jasa/Service'
    | 'Gaji/Manpower'
    | 'Kasbon'
    | 'Consumable'
    | 'Hand Tool'
    | 'Safety'
    | 'Equipment'
    | 'Mob-Demob'
    | 'Penginapan'
    | 'Makan'
    | 'Transport'
    | 'Asuransi/MCU'
    | 'Biaya Lain'
    // Legacy values are kept so existing local-storage data remains valid.
    | 'Service'
    | 'Manpower'
    | 'Tools'
    | 'Consumables'
    | 'Other';
  costRecognition?: "DIRECT_PROJECT" | "STOCK_ISSUE";
  keterangan: string;
  nominal: number;
  ppn?: number;
  totalNominal: number;
  hasKwitansi: boolean;
  kwitansiUrl?: string;
  noKwitansi?: string;
  metodeBayar: 'Cash' | 'Transfer' | 'Cheque' | 'Giro';
  bank?: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Paid';
  remark?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectReason?: string;
  paidAt?: string;
  bankBayar?: string;
  noBuktiPay?: string;
  createdBy: string;
  createdAt: string;
}

// NEW: Customer & AR Management
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
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export interface InvoicePayment {
  id: string;
  tanggal: string;
  nominal: number;
  metodeBayar: 'Cash' | 'Transfer' | 'Cheque' | 'Giro';
  noBukti?: string;
  bankName?: string;
  bankPengirim?: string;
  rekeningTujuan?: string;
  namaPengirim?: string;
  buktiTransferUrl?: string; // base64 data URL
  buktiTransferName?: string;
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
  items: {
    id: string;
    deskripsi: string;
    qty: number;
    satuan: string;
    hargaSatuan: number;
    jumlah: number;
  }[];
  subtotal: number;
  ppn: number;
  pph: number;
  totalNominal: number;
  paidAmount: number;
  outstandingAmount: number;
  status: 'Draft' | 'Pending' | 'Approved' | 'Revision' | 'Rejected' | 'Partial Paid' | 'Paid' | 'Overdue' | 'Cancelled';
  paymentHistory: InvoicePayment[];
  approvalHistory?: { action: 'Approved' | 'Rejected' | 'Revision'; by: string; date: string; reason?: string }[];
  noKontrak?: string;
  noPO?: string;
  termin?: string;
  terminType?: 'full' | 'dp' | 'progress' | 'final';
  terminLabel?: string;
  terminPercent?: number;
  quotationId?: string;
  invoiceId?: string;
  remark?: string;
  createdBy: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  position: string;
  department: string;
  employmentType: 'Permanent' | 'Contract' | 'THL' | 'Internship';
  joinDate: string;
  endDate?: string;
  email: string;
  phone: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  salary: number;
  status: 'Active' | 'Inactive' | 'Resigned';
  bank?: string;
  bankAccount?: string;
  npwp?: string;
  bpjsKesehatan?: string;
  bpjsKetenagakerjaan?: string;
  leaveQuota?: number;
  jatahKasbon?: number;
  jatahKasbonAmount?: number;
  potonganPerKasbon?: number;
}

export interface Attendance {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: 'Present' | 'Late' | 'Absent' | 'Leave' | 'Sick' | 'Permission';
  checkIn?: string;
  checkOut?: string;
  workHours?: number;
  overtime?: number;
  location?: string;
  notes?: string;
  projectId?: string;
  laborCost?: number;
}

export interface Asset {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  location: string;
  status: 'Available' | 'Under Maintenance' | 'In Use' | 'Scrapped';
  condition: 'Good' | 'Fair' | 'Poor';
  purchaseDate?: string;
  purchasePrice?: number;
  rentalPrice?: number;
  /** Internal usage rate in IDR/hour, configured per asset (never inferred from category). */
  costPerHour?: number;
  lastMaintenance?: string;
  nextMaintenance?: string;
  operatorName?: string;
  projectName?: string;
  rentedTo?: string;
  notes?: string;
}

export interface PettyCashEntry {
  id: string;
  date: string;
  accountCode: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  kasir?: string;
  sumberDana?: string;
  bonList?: { name: string; url: string }[];
}

export interface TopUpRequest {
  id: string;
  date: string;
  bank: string;
  amount: number;
  notes: string;
  priority: 'Normal' | 'Urgent';
  status: 'Pending' | 'Approved' | 'Rejected';
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedReason?: string;
}

export interface BKExpenseItem {
  id: string;
  date: string;
  category: string;
  description: string;
  nominal: number;
  hasNota: 'Y' | 'T' | '';
  remark?: string;
  bonUrl?: string;
}

export interface WorkingExpenseSheet {
  id: string;
  client: string;
  project: string;
  location: string;
  date: string;
  noHal: string;
  revisi: string;
  items: BKExpenseItem[];
  totalKas: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Paid';
  keterangan?: string;
  bank?: string;
}

export interface KasbonEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  tanggal: string;
  nominal: number;
  catatan?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvalDate?: string;
  projectId?: string;
}

export interface KasbonTHLEntry {
  id: string;
  thlId: string;
  thlNama: string;
  projectId: string;
  tanggal: string;
  nominal: number;
  catatan?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export interface Leave {
  id: string;
  leaveNo: string;
  employeeId: string;
  employeeName: string;
  leaveType: 'Annual' | 'Sick' | 'Permission' | 'Unpaid' | 'Marriage' | 'Maternity' | string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  days?: number;
  totalDays?: number;
  nominal?: number;
  approvedBy?: string;
  approvedDate?: string;
  notes?: string;
}

export interface OnlineEmployee {
  id: string;
  employeeId: string;
  name: string;
  position: string;
  department: string;
  checkIn: string;
  checkOut?: string;
  location?: string;
  status: 'Online' | 'Offline';
  date: string;
}

export interface THL {
  id: string;
  noTHL: string;
  nama: string;
  posisi: string;
  projectId?: string;
  project: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  upahHarian: number;
  upahPerJam?: number;
  uangMakanPerHari?: number;
  shiftMulai?: string;
  shiftSelesai?: string;
  jumlahHari: number;
  totalUpah: number;
  status: 'Active' | 'Completed' | 'Pending';
  catatan?: string;
}

export interface THLKasbonSettlement {
  id: string;
  thlId: string;
  thlNama: string;
  tanggal: string;
  periode: string;
  totalGaji: number;
  tambahan: number;
  tambahanKet: string;
  potonganKasbon: number;
  adminFee: number;
  bpjstk: number;
  jkn: number;
  saldo: number;
}

export interface THLTimesheetRecord {
  id: string;
  thlId: string;
  periode: string;
  tanggal: string;
  ket: 'Kerja' | 'Izin' | 'Sakit' | 'Libur' | 'Alpa';
  mulai: string;
  selesai: string;
  istirahat: number;
  jamLembur: number;
  lemburIndex: number;
}

export interface THLPayrollSlip {
  thlId: string;
  thlNama: string;
  posisi: string;
  project: string;
  hariKerja: number;
  totalJam: number;
  totalUpah: number;
  totalKasbon: number;
  adminFee: number;
  bpjstk: number;
  jkn: number;
  netto: number;
}

export interface THLPayrollRun {
  id: string;
  periode: string;
  periodLabel: string;
  thlCount: number;
  totalUpah: number;
  totalKasbon: number;
  totalAdminFee: number;
  totalBPJSTK: number;
  totalJKN: number;
  totalNetto: number;
  status: 'Draft' | 'Approved' | 'Disbursed';
  slips: THLPayrollSlip[];
  createdAt: string;
  approvedAt?: string;
  disbursedAt?: string;
  notes?: string;
  bank?: string;
}

export interface Resignation {
  id: string;
  resignNo: string;
  employeeId: string;
  employeeName: string;
  position: string;
  department: string;
  joinDate: string;
  resignDate: string;
  lastWorkingDate: string;
  reason: string;
  status: 'Submitted' | 'Processing' | 'Completed' | 'Cancelled';
  submittedDate: string;
  noticePeriod: number;
  clearanceStatus?: 'Pending' | 'Completed';
  finalSettlement?: number;
  notes?: string;
}

export interface Shift {
  id: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  breakDuration: number;
  workHours: number;
  status: 'Active' | 'Inactive';
  description?: string;
}

export interface ShiftSchedule {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  location: string;
}

export interface SalaryHistory {
  id: string; employeeId: string; effectiveDate: string;
  baseSalary: number; transportAllowance: number; mealAllowancePerDay: number;
  maximumIncentive: number; positionAllowance: number; overtimeRate: number;
  reason?: string; approvedBy?: string; status: 'Active' | 'Superseded';
}
export interface PayrollPolicy {
  id: string; policyName: string; effectiveDate: string;
  standardWorkDays: number; standardWorkHours: number; mealAllowancePerDay: number;
  overtimeRateMultiplier: number;
  incentiveDeductionRules: Array<{ minAttendancePct: number; maxAttendancePct: number; deductionPct: number }>;
  incentiveDeductionPerAbsencePercent?: number;
  bpjsJHTEmployer: number; bpjsJHTEmployee: number; bpjsJPEmployer: number; bpjsJPEmployee: number;
  bpjsJKKEmployer: number; bpjsJKMEmployer: number; bpjsKesEmployer: number; bpjsKesEmployee: number;
  roundingRule: 'none' | 'nearest1000' | 'nearest500';
  signatoryPrepared: string; signatoryChecked: string; signatoryApproved: string;
  companyName: string; companyAddress?: string;
  holidayDates?: string[];
}
export interface EmployeeCompensation {
  id: string; employeeId: string; baseSalary: number; transportAllowance: number;
  mealAllowancePerDay: number; maximumIncentive: number; positionAllowance: number;
  overtimeRate: number; effectiveDate?: string;
  bpjsKetEmployerPct?: number; bpjsKetEmployeePct?: number; bpjsKesPct?: number;
  bpjsKetEmployerAmount?: number; bpjsKetEmployeeAmount?: number; bpjsKesEmployeeAmount?: number;
  pph21Amount?: number;
}
export interface EmployeeAdvance {
  id: string; advanceNumber: string; employeeId: string; employeeName: string;
  employeeType: 'Karyawan' | 'THL'; projectId?: string; requestDate: string; description?: string;
  originalAmount: number; adminFeePercent?: number; adminFeeAmount?: number; installmentAmount: number; installmentCount: number;
  paidInstallments: number; deductionThisPeriod: number;
  remainingBalanceBefore: number; remainingBalanceAfter: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Disbursed' | 'Partially Deducted' | 'Settled' | 'Cancelled';
  approvedBy?: string; approvedAt?: string; disbursedAt?: string; payrollRunId?: string; settledAt?: string;
  lastDeductionPeriod?: string;
}
export interface OvertimeRequest {
  id: string;
  overtimeNo: string;
  employeeId: string;
  employeeName: string;
  employeeType: 'Karyawan' | 'THL';
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  reason: string;
  spkId?: string;
  nomorSPK?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}

export interface PayrollSlip {
  employeeId: string; employeeName: string; employeeNumber: string; position: string; department: string;
  period: string; payrollRunId: string;
  baseSalary: number; transportAllowance: number; mealAllowance: number; maximumIncentive: number;
  positionAllowance: number; overtimePay: number; bonus: number; otherIncome: number; grossIncome: number;
  kasbonDeduction: number; bpjsKetEmployee: number; bpjsKesEmployee: number; pph21: number;
  incentiveDeductionAmount: number; absenceDeduction: number; otherDeductions: number; totalDeductions: number;
  koperasiDeduction?: number;
  koperasiLoanDeduction?: number;
  koperasiMandatorySavingDeduction?: number;
  koperasiLoanDetails?: Array<{ loanId: string; pinjamanNo: string; installmentNumber: number; installmentAmount: number; remainingAfter: number }>;
  kasbonDetails?: Array<{ advanceId: string; advanceNumber: string; installmentNumber: number; principal: number; admin: number; remainingAfter: number }>;
  /** Nilai ini disimpan saat payroll dihitung agar slip historis tidak berubah. */
  kasbonAdminFee?: number;
  jpkAllowance?: number;
  cutiAllowance?: number;
  takeHomePay: number; attendanceDays: number; standardDays: number; lateMinutes: number; overtimeHours: number;
  overtimeReferences?: string[];
  insentifRatePerDay?: number;
  alphaDays?: number; permissionDays?: number; sickDays?: number; leaveDays?: number; holidayDays?: number;
  bpjsKetEmployer: number; bpjsKesEmployer: number;
  status: 'Calculated' | 'Approved' | 'Disbursed' | 'Closed'; disbursedAt?: string;
  policySnapshot?: Partial<PayrollPolicy>;
}
export interface PayrollRun {
  id: string; runNumber: string; period: string; periodLabel: string; processedDate: string;
  totalGross: number; totalDeductions: number; totalTHP: number; employeeCount: number;
  status: 'Draft' | 'Calculated' | 'Reviewed' | 'Approved' | 'Disbursed' | 'Closed';
  slips: PayrollSlip[]; processedBy: string; approvedBy?: string; approvedAt?: string;
  disbursedAt?: string; closedAt?: string; notes?: string;
  bank?: string;
  periodStart?: string; periodEnd?: string;
}

export interface PayrollEntry {
  employeeId: string;
  employeeName: string;
  position: string;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  paidDate?: string;
  status: 'Pending' | 'Paid';
}

export interface PayrollRecord {
  id: string;
  period: string;
  periodLabel: string;
  processedDate: string;
  totalAmount: number;
  employeeCount: number;
  status: 'Draft' | 'Processed' | 'Paid';
  entries: PayrollEntry[];
  nextPayrollDate: string;
  processedBy?: string;
}

export interface ArchiveEntry {
  id: string;
  date: string;
  ref: string;
  description: string;
  amount: number;
  project: string;
  admin: string;
  type: 'AR' | 'AP' | 'PETTY' | 'BK';
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
  status: 'Success' | 'Failed' | 'Warning';
}

export interface StockOpname {
  id: string;
  noOpname: string;
  tanggal: string;
  lokasi: string;
  status: 'Draft' | 'In Progress' | 'Completed';
  items: {
    itemId: string;
    itemKode: string;
    itemNama: string;
    systemQty: number;
    physicalQty: number;
    difference: number;
    notes: string;
  }[];
  notes: string;
  createdBy: string;
  confirmedBy?: string;
  confirmedAt?: string;
}

export interface KoperasiMember {
  id: string;
  memberNo: string;
  employeeId: string;
  employeeName: string;
  joinDate: string;
  status: 'Active' | 'Inactive';
  simpananPokok: number;
  simpananWajibBulanan: number;
}

export interface KoperasiSimpanan {
  id: string;
  memberId: string;
  memberName: string;
  type: 'Wajib' | 'Sukarela';
  amount: number;
  date: string;
  period?: string;
  notes?: string;
}

export interface KoperasiPinjaman {
  id: string;
  pinjamanNo: string;
  memberId: string;
  memberName: string;
  amount: number;
  adminFeePercent: number;
  adminFeeAmount: number;
  totalAmount: number;
  installmentCount: number;
  installmentAmount: number;
  paidInstallments: number;
  requestDate: string;
  status: 'Pending' | 'Approved' | 'Active' | 'Settled' | 'Rejected';
  notes?: string;
  approvedBy?: string;
  approvedDate?: string;
  disbursedDate?: string;
}

export interface KoperasiCashTransaction {
  id: string;
  date: string;
  type: string;
  direction: 'IN' | 'OUT';
  amount: number;
  status: string;
  description: string;
  bankAccount?: string;
  notes?: string;
}

export interface AppContextType {
  projectList: Project[];
  invoiceList: Invoice[];
  stockItemList: StockItem[];
  employeeList: Employee[];
  koperasiMembers: KoperasiMember[];
  addKoperasiMember: (member: KoperasiMember) => Promise<KoperasiMember>;
  updateKoperasiMember: (id: string, updates: Partial<KoperasiMember>) => Promise<KoperasiMember>;
  koperasiSimpananList: KoperasiSimpanan[];
  addKoperasiSimpanan: (simpanan: KoperasiSimpanan) => Promise<KoperasiSimpanan>;
  koperasiPinjamanList: KoperasiPinjaman[];
  addKoperasiPinjaman: (pinjaman: KoperasiPinjaman) => Promise<KoperasiPinjaman>;
  approveKoperasiPinjaman: (id: string) => Promise<KoperasiPinjaman>;
  bayarKoperasiAngsuran: (id: string) => Promise<KoperasiPinjaman>;
  koperasiBalance: number;
  koperasiTransactions: KoperasiCashTransaction[];
  topUpKoperasi: (topUp: { id: string; date: string; amount: number; bankAccount: string; notes?: string }) => Promise<KoperasiCashTransaction>;
  attendanceList: Attendance[];
  workOrderList: WorkOrder[];
  productionReportList: ProductionReport[];
  productionTrackerList: ProductionTracker[];
  qcInspectionList: QCInspection[];
  stockInList: StockIn[];
  stockOutList: StockOut[];
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
  addPayroll: (p: Payroll) => void;
  workingExpenseSheets: WorkingExpenseSheet[];
  addWorkingExpenseSheet: (s: WorkingExpenseSheet) => void;
  updateWorkingExpenseSheet: (id: string, updates: Partial<WorkingExpenseSheet>) => void;
  kasbonList: KasbonEntry[];
  addKasbon: (k: KasbonEntry) => void;
  updateKasbon: (id: string, updates: Partial<KasbonEntry>) => void;
  deleteKasbon: (id: string) => void;
  kasbonTHLList: KasbonTHLEntry[];
  addKasbonTHL: (k: KasbonTHLEntry) => void;
  updateKasbonTHL: (id: string, updates: Partial<KasbonTHLEntry>) => void;
  deleteKasbonTHL: (id: string) => void;
  thlTimesheetList: THLTimesheetRecord[];
  addTHLTimesheet: (r: THLTimesheetRecord) => void;
  updateTHLTimesheet: (id: string, updates: Partial<THLTimesheetRecord>) => void;
  deleteTHLTimesheet: (id: string) => void;
  saveTHLTimesheetBatch: (thlId: string, periode: string, records: THLTimesheetRecord[]) => void;
  thlSettlementList: THLKasbonSettlement[];
  addTHLSettlement: (s: THLKasbonSettlement) => void;
  deleteTHLSettlement: (id: string) => void;
  thlPayrollRunList: THLPayrollRun[];
  addTHLPayrollRun: (run: THLPayrollRun) => void;
  updateTHLPayrollRun: (id: string, updates: Partial<THLPayrollRun>) => void;
  deleteTHLPayrollRun: (id: string) => void;
  payrollRecords: PayrollRecord[];
  addPayrollRecord: (record: PayrollRecord) => void;
  updatePayrollRecord: (id: string, updates: Partial<PayrollRecord>) => void;
  markEmployeePaid: (recordId: string, employeeId: string) => void;
  suratMasukList: SuratMasuk[];
  suratKeluarList: SuratKeluar[];
  beritaAcaraList: BeritaAcara[];
  templateSuratList: TemplateSurat[];
  pettyCashList: PettyCashEntry[];
  leaveList: Leave[];
  overtimeList: OvertimeRequest[];
  addOvertime: (req: OvertimeRequest) => void;
  updateOvertime: (id: string, updates: Partial<OvertimeRequest>) => void;
  onlineEmployeeList: OnlineEmployee[];
  archiveRegistry: ArchiveEntry[];
  auditLogs: AuditLog[];
  vendorList: Vendor[];
  expenseList: VendorExpense[];
  customerList: Customer[];
  customerInvoiceList: CustomerInvoice[];
  stockOpnameList: StockOpname[];
  currentUser: User | null;
  login: (username: string) => void;
  addAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp' | 'userId' | 'userName'>) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  addUser: (user: User) => Promise<BackendUser>;
  deleteUser: (id: string) => Promise<void>;
  addPO: (po: PurchaseOrder) => void;
  addLeave: (leave: Leave) => Promise<Leave>;
  updateLeave: (id: string, updates: Partial<Leave>) => void;
  penilaianKinerjaList: any[];
  addPenilaian: (p: any) => void;
  updatePenilaian: (id: string, updates: any) => void;
  deletePenilaian: (id: string) => void;
  addOnlineEmployee: (emp: OnlineEmployee) => void;
  updateOnlineEmployee: (id: string, updates: Partial<OnlineEmployee>) => void;
  stockItems: StockItem[];
  updateProject: (id: string, updates: Partial<Project>) => Promise<boolean>;
  createProjectSpkWithWorkOrder: (projectId: string, spk: Record<string, unknown>, workOrder: WorkOrder) => Promise<void>;
  addEmployee: (e: Employee) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  addAttendance: (a: Attendance) => void;
  addAttendanceBulk: (a: Attendance[]) => void;
  updateAttendance: (id: string, updates: Partial<Attendance>) => void;
  deleteAttendance: (id: string) => void;
  recordProduction: (woId: string, qty: number) => Promise<void>;
  addQCInspection: (inspection: QCInspection) => Promise<void>;
  addWorkOrder: (wo: WorkOrder) => void;
  updateWorkOrder: (id: string, updates: Partial<WorkOrder>) => void;
  deleteWorkOrder: (id: string) => void;
  addStockIn: (si: StockIn) => void;
  addStockOut: (so: StockOut) => void;
  addReceiving: (rcv: Receiving) => void;
  addInvoice: (inv: Invoice) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  createInvoiceWithAR: (inv: Invoice) => Promise<boolean>;
  addProductionReport: (report: ProductionReport) => Promise<void>;
  updateProductionReport: (id: string, updates: Partial<ProductionReport>) => void;
  handleProductionOutput: (woId: string, qty: number, workerName: string, selectedItem?: string) => void;
  updatePO: (id: string, updates: Partial<any>) => void;
  approveProject: (id: string, ownerName: string) => void;
  updateMaterialRequest: (id: string, updates: Partial<MaterialRequest>) => void;
  issueMaterialRequest: (id: string, issuedBy: string) => void;
  addDataCollection: (dc: DataCollection) => void;
  updateDataCollection: (id: string, updates: Partial<DataCollection>) => void;
  deleteDataCollection: (id: string) => void;
  addProject: (p: Project) => Promise<Project | undefined>;
  deleteProject: (id: string) => void;
  addQuotation: (q: Quotation) => Promise<Quotation>;
  updateQuotation: (id: string, updates: Partial<Quotation>) => Promise<Quotation | undefined>;
  deleteQuotation: (id: string) => void;
  addVendorInvoice: (inv: VendorInvoice) => void;
  updateVendorInvoice: (id: string, updates: Partial<VendorInvoice>) => void;
  payVendorInvoice: (id: string, payment: { tanggal: string; nominal: number; metodeBayar?: string; noBukti?: string; bank?: string; noRekening?: string; keterangan?: string }) => Promise<VendorInvoice>;
  generatePayroll: (month: string, year: string) => void;
  addSuratMasuk: (s: SuratMasuk) => void;
  updateSuratMasuk: (id: string, updates: Partial<SuratMasuk>) => void;
  deleteSuratMasuk: (id: string) => void;
  addSuratKeluar: (s: SuratKeluar) => void;
  updateSuratKeluar: (id: string, updates: Partial<SuratKeluar>) => void;
  deleteSuratKeluar: (id: string) => void;
  addBeritaAcara: (ba: BeritaAcara) => void;
  updateBeritaAcara: (id: string, updates: Partial<BeritaAcara>) => void;
  deleteBeritaAcara: (id: string) => void;
  addSuratJalan: (sj: SuratJalan) => void;
  createSuratJalanWithStockOut: (sj: SuratJalan, stockOut?: StockOut) => Promise<void>;
  updateSuratJalan: (id: string, updates: Partial<SuratJalan>) => void;
  deleteSuratJalan: (id: string) => void;
  addAsset: (a: Asset) => void;
  addMaintenance: (m: MaintenanceRecord) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  deleteAsset: (id: string) => void;
  addPettyCashEntry: (entry: Omit<PettyCashEntry, 'id'>) => void;
  topUpRequestList: TopUpRequest[];
  addTopUpRequest: (req: Omit<TopUpRequest, 'id' | 'status'>) => void;
  approveTopUpRequest: (id: string, approverName: string) => Promise<void>;
  rejectTopUpRequest: (id: string, reason: string) => void;
  pettyCashGudangList: PettyCashEntry[];
  addPettyCashGudangEntry: (entry: Omit<PettyCashEntry, 'id'>) => void;
  updatePettyCashGudangEntry: (id: string, updates: Partial<PettyCashEntry>) => void;
  topUpGudangRequestList: TopUpRequest[];
  addTopUpGudangRequest: (req: Omit<TopUpRequest, 'id' | 'status'>) => void;
  approveTopUpGudangRequest: (id: string, approverName: string) => Promise<void>;
  rejectTopUpGudangRequest: (id: string, reason: string) => void;
  addArchiveEntry: (entry: Omit<ArchiveEntry, 'id'>) => void;
  addEquipmentUsage: (usage: EquipmentUsage) => void;
  addMaterialRequest: (request: MaterialRequest) => void;
  updateMaterialRequestStatus: (projectId: string, requestId: string, status: MaterialRequest['status']) => void;
  applyTemplate: (templateId: string, variables: Record<string, string>) => string;
  updateReservedStock: (materials: any[], type: 'reserve' | 'release') => void;
  addStockItem: (item: StockItem) => void;
  setStockItemList: React.Dispatch<React.SetStateAction<StockItem[]>>;
  setStockMovementList: React.Dispatch<React.SetStateAction<StockMovement[]>>;
  setPoList: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
  createStockOut: (so: StockOut) => void;
  createStockIn: (si: StockIn) => void;
  updateStockIn: (id: string, updates: Partial<StockIn>) => void;
  convertDataCollectionToQuotation: (dcId: string) => void;
  convertQuotationToProject: (quoId: string) => void;
  refreshAll: () => void;
  resetAllData: () => void;
  alerts: any[];
  markAlertAsRead: (id: string) => void;
  addVendor: (vendor: Vendor) => void;
  updateVendor: (id: string, updates: Partial<Vendor>) => void;
  deleteVendor: (id: string) => void;
  addExpense: (expense: VendorExpense) => void;
  updateExpense: (id: string, updates: Partial<VendorExpense>) => void;
  deleteExpense: (id: string) => void;
  approveExpense: (id: string, approver: string) => void;
  rejectExpense: (id: string, reason: string) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addCustomerInvoice: (invoice: CustomerInvoice) => void;
  updateCustomerInvoice: (id: string, updates: Partial<CustomerInvoice>) => void;
  deleteCustomerInvoice: (id: string) => void;
  approveCustomerInvoice: (id: string, approvedBy: string) => void;
  addInvoicePayment: (invoiceId: string, payment: InvoicePayment) => Promise<boolean>;
  addStockOpname: (opname: StockOpname) => void;
  confirmStockOpname: (id: string, confirmedBy: string) => void;
  thlList: THL[];
  addTHL: (thl: THL) => void;
  updateTHL: (id: string, updates: Partial<THL>) => void;
  deleteTHL: (id: string) => void;
  resignationList: Resignation[];
  addResignation: (r: Resignation) => void;
  updateResignation: (id: string, updates: Partial<Resignation>) => void;
  shiftList: Shift[];
  addShift: (s: Shift) => void;
  updateShift: (id: string, updates: Partial<Shift>) => void;
  deleteShift: (id: string) => void;
  shiftScheduleList: ShiftSchedule[];
  addShiftSchedule: (s: ShiftSchedule) => void;
  deleteShiftSchedule: (id: string) => void;
  salaryHistoryList: SalaryHistory[];
  addSalaryHistory: (h: SalaryHistory) => void;
  payrollPolicy: PayrollPolicy | null;
  setPayrollPolicy: (p: PayrollPolicy) => void;
  employeeCompensations: EmployeeCompensation[];
  setEmployeeCompensation: (comp: EmployeeCompensation) => void;
  employeeAdvanceList: EmployeeAdvance[];
  addEmployeeAdvance: (a: EmployeeAdvance) => void;
  updateEmployeeAdvance: (id: string, updates: Partial<EmployeeAdvance>) => void;
  payrollRunList: PayrollRun[];
  addPayrollRun: (run: PayrollRun) => void;
  updatePayrollRun: (id: string, updates: Partial<PayrollRun>) => void;
  disbursePayrollRun: (id: string, updates: Partial<PayrollRun>) => Promise<void>;
  deletePayrollRun: (id: string) => void;
  clearAllPayrollRuns: () => void;
  extraCategories: string[];
  addExtraCategory: (cat: string) => void;
  bankSaldoAwal: Record<string, number>;
  setBankSaldoAwal: (bank: string, amount: number, options?: BankOpeningBalanceOptions) => Promise<void>;
  bankManualEntryList: BankManualEntry[];
  addBankManualEntry: (entry: Omit<BankManualEntry, 'id'>) => Promise<void>;
  deleteBankManualEntry: (id: string) => void;
  closedYearsList: ClosedYear[];
  addClosedYear: (entry: Omit<ClosedYear, 'id'>) => void;
  isYearClosed: (year: number) => boolean;
}

export interface ClosedYear {
  id: string;
  year: number;
  closedAt: string;
  closedBy: string;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  carryForwardAR: number;
  carryForwardAP: number;
  bankBalances: Record<string, number>;
}

export interface BankManualEntry {
  id: string;
  tanggal: string;
  bank: string;
  keterangan: string;
  amount: number;
  tipe: 'Masuk' | 'Keluar';
  notes?: string;
  createdAt: string;
}

export interface BankOpeningBalanceOptions {
  period?: string;
  date?: string;
  note?: string;
  priority?: 'Normal' | 'Urgent';
}

export const bankOpeningBalanceKey = (bank: string, period: string) => `${bank}::${period}`;

export const AppContext = createContext<AppContextType | undefined>(undefined);

// Resource /data memakai envelope { entityId, payload }. UI selalu bekerja dengan
// payload murni supaya bentuk data sama dengan record yang dipakai halaman lama.
const unwrapDataEntity = <T,>(entry: unknown): T => {
  const carrier = entry as { entityId?: string; payload?: unknown };
  const payload = carrier?.payload && typeof carrier.payload === 'object'
    ? carrier.payload as Record<string, unknown>
    : entry as Record<string, unknown>;

  return {
    ...payload,
    id: payload?.id ?? carrier?.entityId,
  } as T;
};

const toInvoiceApiPayload = (invoice: Invoice, customerId?: string) => ({
  id: invoice.id,
  noInvoice: invoice.noInvoice,
  tanggal: invoice.tanggal,
  jatuhTempo: invoice.jatuhTempo,
  ...(customerId ? { customerId } : {}),
  projectId: invoice.projectId,
  customer: invoice.customer,
  alamat: invoice.alamat,
  noPO: invoice.noPO,
  perihal: invoice.perihal,
  items: invoice.items,
  subtotal: invoice.subtotal,
  ppn: invoice.ppn,
  totalBayar: invoice.totalBayar,
  paidAmount: invoice.paidAmount ?? 0,
  outstandingAmount: Math.max(0, invoice.totalBayar - (invoice.paidAmount ?? 0)),
  status: invoice.status,
  termin: invoice.terminLabel,
  buktiTransfer: invoice.buktiTransfer,
  noKwitansi: invoice.noKwitansi,
  tanggalBayar: invoice.tanggalBayar,
});

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [materialRequestList, setMaterialRequestList] = useStoredState<MaterialRequest[]>('materialRequests', []);
  const [maintenanceList, setMaintenanceList] = useStoredState<MaintenanceRecord[]>('maintenanceList', []);
  const [invoiceList, setInvoiceList] = useStoredState<Invoice[]>('invoiceList', []);
  const [stockItemList, setStockItemList] = useStoredState<StockItem[]>('stockItemList', [
    { id: "s1", kode: "GTP-MTR-PIP-001", nama: "Pipa Galvanis 2 Inch", stok: 120, satuan: "Batang", kategori: "Piping", minStock: 20, hargaSatuan: 450000, lokasi: "Gudang A" },
    { id: "s2", kode: "GTP-MTR-VAL-002", nama: "Valve 2 Inch", stok: 5, satuan: "Pcs", kategori: "Fitting", minStock: 10, hargaSatuan: 1200000, lokasi: "Gudang B" }
  ]);
  const [employeeList, setEmployeeList] = useStoredState<Employee[]>('employeeList', []);
  const [koperasiMembers, setKoperasiMembers] = useStoredState<KoperasiMember[]>('koperasiMembers', []);
  const [koperasiSimpananList, setKoperasiSimpananList] = useStoredState<KoperasiSimpanan[]>('koperasiSimpananList', []);
  const [koperasiPinjamanList, setKoperasiPinjamanList] = useStoredState<KoperasiPinjaman[]>('koperasiPinjamanList', []);
  const [koperasiBalance, setKoperasiBalance] = useStoredState<number>('koperasiBalance', 0);
  const [koperasiTransactions, setKoperasiTransactions] = useStoredState<KoperasiCashTransaction[]>('koperasiTransactions', []);
  const [attendanceList, setAttendanceList] = useStoredState<Attendance[]>('attendanceList', []);
  const [workOrderList, setWorkOrderList] = useStoredState<WorkOrder[]>('workOrderList', []);
  const [productionReportList, setProductionReportList] = useStoredState<ProductionReport[]>('productionReportList', []);
  const [productionTrackerList, setProductionTrackerList] = useStoredState<ProductionTracker[]>('productionTrackerList', []);
  const [qcInspectionList, setQcInspectionList] = useStoredState<QCInspection[]>('qcInspectionList', []);
  const [stockInList, setStockInList] = useStoredState<StockIn[]>('stockInList', []);
  const [stockOutList, setStockOutList] = useStoredState<StockOut[]>('stockOutList', []);
  const [stockMovementList, setStockMovementList] = useStoredState<StockMovement[]>('stockMovementList', [
    { id: 'MOV-SEED-001', tanggal: '2026-01-01', type: 'IN', refNo: 'OB-2026-001', refType: 'Opening Balance', itemKode: 'GTP-MTR-PIP-001', itemNama: 'Pipa Galvanis 2 Inch', qty: 120, unit: 'Batang', lokasi: 'Gudang A', stockBefore: 0, stockAfter: 120, createdBy: 'System' },
    { id: 'MOV-SEED-002', tanggal: '2026-01-01', type: 'IN', refNo: 'OB-2026-001', refType: 'Opening Balance', itemKode: 'GTP-MTR-VAL-002', itemNama: 'Valve 2 Inch', qty: 5, unit: 'Pcs', lokasi: 'Gudang B', stockBefore: 0, stockAfter: 5, createdBy: 'System' },
  ]);
  const [receivingList, setReceivingList] = useStoredState<Receiving[]>('receivingList', []);
  const [suratJalanList, setSuratJalanList] = useStoredState<SuratJalan[]>('suratJalanList', [
    {
      id: 'SJ-DEMO-1',
      noSurat: 'SJ/2026/001',
      tanggal: '2026-02-10',
      sjType: 'Material Delivery',
      tujuan: 'PT. Gema Industri Indonesia',
      alamat: 'Kawasan Industri Cikarang Utama, Bekasi',
      upPerson: 'Budi Santoso',
      projectId: 'prj-demo-1',
      sopir: 'Agus Wahyudi',
      noPolisi: 'B 1234 GTP',
      pengirim: 'Gudang GTP',
      deliveryStatus: 'Delivered',
      items: [
        { namaItem: 'Pipa Galvanis 2 Inch', itemKode: 'GTP-MTR-PIP-001', jumlah: 50, satuan: 'Batang', batchNo: 'GTP/20260210/A12' },
        { namaItem: 'Valve 2 Inch', itemKode: 'GTP-MTR-VAL-002', jumlah: 12, satuan: 'Pcs', batchNo: 'GTP/20260210/B34' }
      ],
      createdAt: '2026-02-10T08:00:00Z'
    },
    {
      id: 'SJ-DEMO-2',
      noSurat: 'SJ/2026/002',
      tanggal: '2026-02-15',
      sjType: 'Equipment Loan',
      tujuan: 'PT. Daki Aluminium Industry Indonesia (Plant II)',
      alamat: 'Jalan Malig VIII Lot T2 Kawasan Industri KIIC, Teluk Jambe Barat, Karawang',
      upPerson: 'Ir. Wijaya',
      sopir: 'Dewi',
      pengirim: 'Ade Suhender',
      deliveryStatus: 'In Transit',
      expectedReturnDate: '2026-03-15',
      returnStatus: 'Pending',
      items: [
        { namaItem: 'Mixer', jumlah: 1, satuan: 'Unit', keterangan: 'Alat dipinjamkan untuk pekerjaan cor beton area plant 2' },
        { namaItem: 'Vibrator', jumlah: 2, satuan: 'Unit', keterangan: 'Setelah pekerjaan sudah selesai alat harus dikembalikan' },
        { namaItem: 'Trafo Las', jumlah: 1, satuan: 'Unit', keterangan: 'Untuk fabrikasi struktur baja' },
        { namaItem: 'Gerinda Tangan', jumlah: 3, satuan: 'Unit', keterangan: 'Grinding & polishing work' }
      ],
      createdAt: '2026-02-15T09:30:00Z'
    }
  ]);
  const [assetList, setAssetList] = useStoredState<Asset[]>('assetList', []);
  const [quotationList, setQuotationList] = useStoredState<Quotation[]>('quotationList', []);

  // Asset dan maintenance dipakai lintas Logistics, Produksi, serta Project.
  // Muat dari PostgreSQL saat sesi tersedia; cache lokal hanya menjadi fallback offline.
  useEffect(() => {
    if (!localStorage.getItem('authToken')) return;
    let active = true;
    const sync = async <T extends { id: string }>(path: string, cached: T[], apply: (rows: T[]) => void) => {
      const rows = await api.request<T[]>(path);
      if (!active) return;
      if (rows.length > 0) apply(rows);
      // Empty backend responses are valid (especially on a fresh database).
      // Do not push stale/demo LocalStorage rows back automatically: doing so
      // creates duplicate IDs and invalid cross-module references.
    };

    Promise.all([
      sync('/assets', assetList, setAssetList),
      sync('/maintenances', maintenanceList, setMaintenanceList),
    ]).catch(error => {
      console.warn('[Assets] Memakai cache lokal karena API belum tersedia:', error);
    });

    return () => { active = false; };
  }, []);

  // Re-fetch finance/project records when a realtime write event arrives via
  // the shared WebSocket (focus is dispatched by the socket listener).
  useEffect(() => {
    if (!localStorage.getItem('authToken')) return;
    let active = true;
    const syncFinanceProject = async () => {
      try {
        const [projects, invoices, vendorInvoices, customerInvoices] = await Promise.all([
          api.request<Project[]>('/projects'), api.request<Invoice[]>('/invoices'),
          api.request<VendorInvoice[]>('/finance/vendor-invoices'), api.request<CustomerInvoice[]>('/finance/customer-invoices'),
        ]);
        if (!active) return;
        setProjectList(projects); setInvoiceList(invoices);
        setVendorInvoiceList(vendorInvoices); setCustomerInvoiceList(customerInvoices);
      } catch (error) { console.warn('[Finance/Project] Sync realtime gagal:', error); }
    };
    window.addEventListener('focus', syncFinanceProject);
    return () => { active = false; window.removeEventListener('focus', syncFinanceProject); };
  }, []);

  // One shared realtime channel for all transactional modules. A change event
  // reuses the existing focus-sync handlers so every page refreshes its own
  // backend data without maintaining separate socket connections.
  useEffect(() => {
    if (!localStorage.getItem('authToken')) return;
    const apiBase = String(import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/^http/, 'ws').replace(/\/$/, '');
    const socket = new WebSocket(`${apiBase}/realtime`);
    const onMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        if (message?.type === 'data.changed') window.dispatchEvent(new Event('focus'));
      } catch { /* ignore malformed broadcast */ }
    };
    socket.addEventListener('message', onMessage);
    return () => { socket.removeEventListener('message', onMessage); socket.close(); };
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('authToken')) return;

    let active = true;
    const syncQuotations = () => {
      api.request<Quotation[]>('/quotations')
        .then((items) => {
          if (active) setQuotationList(items);
        })
        .catch((error) => {
          console.warn('[Quotation] Memakai cache lokal karena API belum tersedia:', error);
        });
    };

    syncQuotations();
    const syncOnFocus = () => syncQuotations();
    window.addEventListener('focus', syncOnFocus);

    return () => {
      active = false;
      window.removeEventListener('focus', syncOnFocus);
    };
  }, []);
  const [poList, setPoList] = useStoredState<PurchaseOrder[]>('poList', []);
  const [vendorInvoiceList, setVendorInvoiceList] = useStoredState<VendorInvoice[]>('vendorInvoiceList', DEMO_MODE_ENABLED ? seedVendorInvoiceList as any : []);
  const [userList, setUserList] = useStoredState<User[]>('userList', []);
  const [projectList, setProjectList] = useStoredState<Project[]>('projectList', DEMO_MODE_ENABLED ? seedProjectList as any : []);
  const [dataCollectionList, setDataCollectionList] = useStoredState<DataCollection[]>('dataCollectionList', DEMO_MODE_ENABLED ? seedDataCollectionList as any : []);

  const refreshHumanCapital = React.useCallback(async () => {
    if (!localStorage.getItem('authToken')) return;
    const [employees, attendances] = await Promise.all([
      api.request<Employee[]>('/employees'),
      api.request<Attendance[]>('/attendances'),
    ]);
    setEmployeeList(employees);
    setAttendanceList(attendances);
  }, []);

  React.useEffect(() => {
    refreshHumanCapital().catch((error) => {
      console.warn('[Human Capital] Memakai cache lokal karena API belum tersedia:', error);
    });
  }, [refreshHumanCapital]);

  const refreshProcurementInventory = React.useCallback(async () => {
    if (!localStorage.getItem('authToken')) return;
    const [purchaseOrders, receivings, stockIns, stockOuts, stockItems, stockMovements, stockOpnames] = await Promise.all([
      api.request<PurchaseOrder[]>('/purchase-orders'),
      api.request<Receiving[]>('/receivings'),
      api.request<StockIn[]>('/inventory/stock-ins'),
      api.request<StockOut[]>('/inventory/stock-outs'),
      api.request<StockItem[]>('/inventory/items'),
      api.request<StockMovement[]>('/inventory/movements'),
      api.request<StockOpname[]>('/inventory/stock-opnames'),
    ]);
    setPoList(purchaseOrders);
    setReceivingList(receivings);
    setStockInList(stockIns);
    setStockOutList(stockOuts);
    setStockItemList(stockItems);
    setStockMovementList(stockMovements);
    setStockOpnameList(stockOpnames);
  }, []);

  React.useEffect(() => {
    refreshProcurementInventory().catch((error) => {
      console.warn('[Procurement/Inventory] Memakai cache lokal karena API belum tersedia:', error);
    });
    const syncOnFocus = () => { refreshProcurementInventory().catch(() => undefined); };
    window.addEventListener('focus', syncOnFocus);
    return () => {
      window.removeEventListener('focus', syncOnFocus);
    };
  }, [refreshProcurementInventory]);

  const refreshProductionFlow = React.useCallback(async () => {
    if (!localStorage.getItem('authToken')) return;
    const [workOrders, productionReports, qcInspections] = await Promise.all([
      api.request<WorkOrder[]>('/work-orders'),
      api.request<ProductionReport[]>('/production-reports'),
      api.request<QCInspection[]>('/qc-inspections'),
    ]);
    // Keep locally-created rows until the write is visible on the backend;
    // this prevents a fast navigation to LHP from hiding a just-created WO.
    const cachedWorkOrders = (() => { try { return JSON.parse(localStorage.getItem('gtp_erp_v1_workOrderList') || '[]') as WorkOrder[]; } catch { return []; } })();
    const mergedWorkOrders = [...workOrders, ...cachedWorkOrders.filter(local => !workOrders.some(server => server.id === local.id))];
    setWorkOrderList(mergedWorkOrders);
    setProductionReportList(productionReports);
    setQcInspectionList(qcInspections);
  }, []);

  React.useEffect(() => {
    refreshProductionFlow().catch((error) => {
      console.warn('[WO/LHP] Memakai cache lokal karena API belum tersedia:', error);
    });
    const syncOnFocus = () => { refreshProductionFlow().catch(() => undefined); };
    window.addEventListener('focus', syncOnFocus);
    return () => {
      window.removeEventListener('focus', syncOnFocus);
    };
  }, [refreshProductionFlow]);

  useEffect(() => {
    if (!localStorage.getItem('authToken')) return;
    let active = true;
    const syncDataCollections = () => api.request<DataCollection[]>('/data-collections')
      .then((items) => { if (active) setDataCollectionList(items); })
      .catch((error) => console.warn('[Data Collection] Memakai cache lokal karena API belum tersedia:', error));
    syncDataCollections();
    const syncOnFocus = () => syncDataCollections();
    window.addEventListener('focus', syncOnFocus);
    return () => { active = false; window.removeEventListener('focus', syncOnFocus); };
  }, []);
  const [payrollList, setPayrollList] = useStoredState<Payroll[]>('payrollList', []);
  const [workingExpenseSheets, setWorkingExpenseSheets] = useStoredState<WorkingExpenseSheet[]>('workingExpenseSheets', []);
  const [kasbonList, setKasbonList] = useStoredState<KasbonEntry[]>('kasbonList', []);
  const [kasbonTHLList, setKasbonTHLList] = useStoredState<KasbonTHLEntry[]>('kasbonTHLList', []);
  const [thlTimesheetList, setTHLTimesheetList] = useStoredState<THLTimesheetRecord[]>('thlTimesheetList', []);
  const [thlSettlementList, setTHLSettlementList] = useStoredState<THLKasbonSettlement[]>('thlSettlementList', []);
  const [suratMasukList, setSuratMasukList] = useStoredState<SuratMasuk[]>('suratMasukList', []);
  const [suratKeluarList, setSuratKeluarList] = useStoredState<SuratKeluar[]>('suratKeluarList', []);
  const [beritaAcaraList, setBeritaAcaraList] = useStoredState<BeritaAcara[]>('beritaAcaraList', DEMO_MODE_ENABLED ? seedBeritaAcaraList as any : []);
  const [templateSuratList, setTemplateSuratList] = useStoredState<TemplateSurat[]>('templateSuratList', []);
  const [leaveList, setLeaveList] = useStoredState<Leave[]>('leaveList', []);
  const [overtimeList, setOvertimeList] = useStoredState<OvertimeRequest[]>('overtimeList', []);
  const [onlineEmployeeList, setOnlineEmployeeList] = useStoredState<OnlineEmployee[]>('onlineEmployeeList', []);
  const [penilaianKinerjaList, setPenilaianKinerjaList] = useStoredState<any[]>('penilaianKinerjaList', []);
  const [pettyCashList, setPettyCashList] = useStoredState<PettyCashEntry[]>('pettyCashList', DEMO_MODE_ENABLED ? seedPettyCashList as any : []);
  const [topUpRequestList, setTopUpRequestList] = useStoredState<TopUpRequest[]>('topUpRequestList', []);
  const [pettyCashGudangList, setPettyCashGudangList] = useStoredState<PettyCashEntry[]>('pettyCashGudangList', []);
  const [topUpGudangRequestList, setTopUpGudangRequestList] = useStoredState<TopUpRequest[]>('topUpGudangRequestList', []);
  const [archiveRegistry, setArchiveRegistry] = useStoredState<ArchiveEntry[]>('archiveRegistry', []);
  const [payrollRecords, setPayrollRecords] = useStoredState<PayrollRecord[]>('payrollRecords', []);
  const [auditLogs, setAuditLogs] = useStoredState<AuditLog[]>('auditLogs', DEMO_MODE_ENABLED ? seedAuditLogs as any : []);

  // Payroll finance dipakai oleh Cash Flow dan General Ledger. Setelah login,
  // database adalah sumber utama agar angka tidak berubah antar browser/device.
  useEffect(() => {
    if (!localStorage.getItem('authToken')) return;
    let active = true;
    api.request<Payroll[]>('/payrolls')
      .then(items => { if (active) setPayrollList(items); })
      .catch(error => console.warn('[Finance Payroll] Memakai cache lokal karena API belum tersedia:', error));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('authToken')) return;

    let active = true;
    Promise.all([
      api.request<BackendUser[]>('/users'),
      api.request<AuditLog[]>('/audit-logs?limit=500'),
    ]).then(([users, logs]) => {
      if (!active) return;
      setUserList(users.map(mapBackendUser));
      setAuditLogs(logs);
    }).catch((error) => {
      console.warn('[Settings] Memakai cache lokal karena API belum tersedia:', error);
    });

    return () => { active = false; };
  }, []);
  
  // NEW: Vendor & Expense Management
  const [vendorList, setVendorList] = useStoredState<Vendor[]>('vendorList', DEMO_MODE_ENABLED ? seedVendorList as any : []);
  
  const [expenseList, setExpenseList] = useStoredState<VendorExpense[]>('expenseList', DEMO_MODE_ENABLED ? seedExpenseList as any : []);
  
  // NEW: Customer & AR Management
  const [customerList, setCustomerList] = useStoredState<Customer[]>('customerList', DEMO_MODE_ENABLED ? seedCustomerList as any : []);

  const [customerInvoiceList, setCustomerInvoiceList] = useStoredState<CustomerInvoice[]>('customerInvoiceList', DEMO_MODE_ENABLED ? seedCustomerInvoiceList as any : []);

  useEffect(() => {
    if (!localStorage.getItem('authToken')) return;
    let active = true;
    Promise.all([
      api.request<VendorInvoice[]>('/finance/vendor-invoices'),
      api.request<VendorExpense[]>('/finance/vendor-expenses'),
      api.request<CustomerInvoice[]>('/finance/customer-invoices'),
    ]).then(([vendorInvoices, vendorExpenses, customerInvoices]) => {
      if (!active) return;
      setVendorInvoiceList(vendorInvoices);
      setExpenseList(vendorExpenses);
      setCustomerInvoiceList(customerInvoices);
    }).catch(error => {
      console.warn('[Finance Approval] Memakai cache lokal karena API belum tersedia:', error);
    });
    return () => { active = false; };
  }, []);

  // Data inti ini sebelumnya hanya hidup di localStorage. Sekarang saat sesi sudah
  // ada, PostgreSQL menjadi sumber data untuk master dan dokumen yang dipakai
  // project/finance/correspondence.
  useEffect(() => {
    if (!localStorage.getItem('authToken')) return;

    let active = true;
    Promise.all([
      api.request<Project[]>('/projects'),
      api.request<unknown[]>('/data/vendors'),
      api.request<unknown[]>('/data/customers'),
      api.request<unknown[]>('/data/surat-jalan'),
      api.request<unknown[]>('/data/berita-acara'),
      api.request<Invoice[]>('/invoices'),
      api.request<SuratMasuk[]>('/surat-masuk'),
      api.request<SuratKeluar[]>('/surat-keluar'),
      api.request<TemplateSurat[]>('/template-surat'),
      api.request<ArchiveEntry[]>('/archive-registry'),
    ]).then(([projects, vendors, customers, suratJalan, beritaAcara, invoices, suratMasuk, suratKeluar, templates, archives]) => {
      if (!active) return;
      setProjectList(projects);
      setVendorList(vendors.map(row => unwrapDataEntity<Vendor>(row)));
      setCustomerList(customers.map(row => unwrapDataEntity<Customer>(row)));
      setSuratJalanList(suratJalan.map(row => unwrapDataEntity<SuratJalan>(row)));
      setBeritaAcaraList(beritaAcara.map(row => unwrapDataEntity<BeritaAcara>(row)));
      setInvoiceList(invoices);
      setSuratMasukList(suratMasuk);
      setSuratKeluarList(suratKeluar);
      setTemplateSuratList(templates);
      setArchiveRegistry(archives);
    }).catch(error => {
      console.warn('[Core Business Data] Memakai cache lokal karena API belum tersedia:', error);
    });

    return () => { active = false; };
  }, []);

  const [stockOpnameList, setStockOpnameList] = useStoredState<StockOpname[]>('stockOpnameList', []);
  const [thlList, setThlList] = useStoredState<THL[]>('thlList', DEMO_MODE_ENABLED ? seedThlList as any : []);
  const [resignationList, setResignationList] = useStoredState<Resignation[]>('resignationList', []);
  const [shiftList, setShiftList] = useStoredState<Shift[]>('shiftList', DEMO_MODE_ENABLED ? seedShiftList as any : []);
  const [shiftScheduleList, setShiftScheduleList] = useStoredState<ShiftSchedule[]>('shiftScheduleList', []);

  const [salaryHistoryList, setSalaryHistoryList] = useStoredState<SalaryHistory[]>('salaryHistoryList', []);
  const [payrollPolicyState, setPayrollPolicyState] = useStoredState<PayrollPolicy | null>('payrollPolicy', {
    id: 'policy-gtp-2024', policyName: 'GTP Payroll Policy 2024', effectiveDate: '2024-01-01',
    standardWorkDays: 25, standardWorkHours: 8, mealAllowancePerDay: 25000, overtimeRateMultiplier: 1.5,
    incentiveDeductionRules: [
      { minAttendancePct: 96, maxAttendancePct: 100, deductionPct: 0 },
      { minAttendancePct: 86, maxAttendancePct: 95, deductionPct: 25 },
      { minAttendancePct: 71, maxAttendancePct: 85, deductionPct: 50 },
      { minAttendancePct: 50, maxAttendancePct: 70, deductionPct: 75 },
      { minAttendancePct: 0, maxAttendancePct: 49, deductionPct: 100 },
    ],
    incentiveDeductionPerAbsencePercent: 25,
    bpjsJHTEmployer: 3.7, bpjsJHTEmployee: 2, bpjsJPEmployer: 2, bpjsJPEmployee: 1,
    bpjsJKKEmployer: 0.24, bpjsJKMEmployer: 0.3, bpjsKesEmployer: 4, bpjsKesEmployee: 1,
    roundingRule: 'nearest1000', signatoryPrepared: 'Syamsudin', signatoryChecked: 'Sri Rahayu',
    signatoryApproved: 'Syamsudin', companyName: 'PT Gema Teknik Perkasa', holidayDates: [],
  });
  const [employeeCompensationsState, setEmployeeCompensationsState] = useStoredState<EmployeeCompensation[]>('employeeCompensations', []);
  const [employeeAdvanceList, setEmployeeAdvanceList] = useStoredState<EmployeeAdvance[]>('employeeAdvanceList', []);
  const [payrollRunList, setPayrollRunList] = useStoredState<PayrollRun[]>('payrollRunList', []);

  useEffect(() => {
    if (!localStorage.getItem('authToken')) return;
    let active = true;
    const syncList = async <T extends { id: string }>(path: string, cached: T[], apply: (rows: T[]) => void) => {
      const rows = await api.request<T[]>(path);
      if (!active) return;
      if (rows.length > 0) apply(rows);
      // Backend is authoritative; an empty result must not trigger a bulk
      // write of cached/demo payroll rows (causes duplicate-ID/rate-limit errors).
    };
    Promise.all([
      syncList('/hr-payroll-policies', payrollPolicyState ? [payrollPolicyState] : [], rows => setPayrollPolicyState(rows[0] ?? null)),
      syncList('/hr-employee-compensations', employeeCompensationsState, setEmployeeCompensationsState),
      syncList('/hr-employee-advances', employeeAdvanceList, setEmployeeAdvanceList),
      syncList('/hr-payroll-runs', payrollRunList, setPayrollRunList),
      syncList('/finance-payroll-records', payrollRecords, setPayrollRecords),
      syncList('/finance-working-expense-sheets', workingExpenseSheets, setWorkingExpenseSheets),
    ]).catch(error => console.warn('[Human Capital Payroll] Memakai cache lokal:', error));
    return () => { active = false; };
  }, []);

  const upsertHrAlias = <T extends { id: string }>(path: string, value: T) => {
    return api.request<T>(path, { method: 'POST', body: JSON.stringify(value) })
      .catch(() => api.request<T>(`${path}/${encodeURIComponent(value.id)}`, {
        method: 'PATCH', body: JSON.stringify({ payload: value }),
      }))
      .catch(error => console.warn(`[Human Capital] Gagal menyimpan ${path}:`, error));
  };
  const persistHrAlias = <T extends { id: string }>(path: string, value: T): Promise<T> =>
    api.request<T>(path, { method: 'POST', body: JSON.stringify(value) }).catch(() =>
      api.request<T>(`${path}/${encodeURIComponent(value.id)}`, {
        method: 'PATCH', body: JSON.stringify({ payload: value }),
      })
    );

  // Kas kecil dan request top-up tetap memakai bentuk data UI yang lama, tetapi
  // sumber utamanya kini AppEntity di PostgreSQL. LocalStorage hanya fallback bila offline.
  useEffect(() => {
    if (!localStorage.getItem('authToken')) return;
    let active = true;
    const syncList = async <T extends { id: string }>(path: string, cached: T[], apply: (rows: T[]) => void) => {
      const rows = await api.request<T[]>(path);
      if (!active) return;
      if (rows.length > 0) apply(rows);
      else if (cached.length > 0) await api.request(`${path}/bulk`, { method: 'PUT', body: JSON.stringify(cached) });
    };

    Promise.all([
      syncList('/finance-petty-cash', pettyCashList, setPettyCashList),
      syncList('/finance-petty-cash-topups', topUpRequestList, setTopUpRequestList),
      syncList('/finance-warehouse-petty-cash', pettyCashGudangList, setPettyCashGudangList),
      syncList('/finance-warehouse-petty-cash-topups', topUpGudangRequestList, setTopUpGudangRequestList),
    ]).catch(error => console.warn('[Kas Kecil] Memakai cache lokal karena API belum tersedia:', error));

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('authToken')) return;
    let active = true;
    const sync = async <T extends { id: string }>(path: string, cached: T[], apply: (rows: T[]) => void) => {
      const rows = await api.request<T[]>(path);
      if (!active) return;
      if (rows.length > 0) apply(rows);
      else if (cached.length > 0) await api.request(`${path}/bulk`, { method: 'PUT', body: JSON.stringify(cached) });
    };
    const syncHumanCapitalLists = () => Promise.all([
      sync('/hr-leaves', leaveList, setLeaveList),
      sync('/hr-overtime-requests', overtimeList, setOvertimeList),
      sync('/hr-shifts', shiftList, setShiftList),
      sync('/hr-shift-schedules', shiftScheduleList, setShiftScheduleList),
      sync('/hr-performance-reviews', penilaianKinerjaList, setPenilaianKinerjaList),
      sync('/hr-resignations', resignationList, setResignationList),
      sync('/hr-online-status', onlineEmployeeList, setOnlineEmployeeList),
      sync('/hr-salary-histories', salaryHistoryList, setSalaryHistoryList),
      sync('/hr-kasbon-karyawan', kasbonList, setKasbonList),
      sync('/hr-thl-settlements', thlSettlementList, setTHLSettlementList),
    ]).catch(error => console.warn('[Human Capital Attendance] Memakai cache lokal:', error));
    syncHumanCapitalLists();
    const syncOnFocus = () => { syncHumanCapitalLists(); };
    window.addEventListener('focus', syncOnFocus);
    return () => { active = false; window.removeEventListener('focus', syncOnFocus); };
  }, []);

  const addSalaryHistory = (h: SalaryHistory) => {
    setSalaryHistoryList(prev => [h, ...prev]);
    upsertHrAlias('/hr-salary-histories', h);
  };
  const setPayrollPolicy = (p: PayrollPolicy) => {
    setPayrollPolicyState(p);
    upsertHrAlias('/hr-payroll-policies', p);
  };
  const setEmployeeCompensation = (comp: EmployeeCompensation) => {
    const previous = employeeCompensationsState;
    setEmployeeCompensationsState(prev => {
      return prev.find(c => c.employeeId === comp.employeeId) ? prev.map(c => c.employeeId === comp.employeeId ? comp : c) : [...prev, comp];
    });
    void persistHrAlias('/hr-employee-compensations', comp).catch(() => {
      setEmployeeCompensationsState(previous);
      toast.error('Kompensasi karyawan gagal disimpan');
    });
  };
  const addEmployeeAdvance = (a: EmployeeAdvance) => {
    setEmployeeAdvanceList(prev => [a, ...prev]);
    void persistHrAlias('/hr-employee-advances', a).catch(() => {
      setEmployeeAdvanceList(prev => prev.filter(item => item.id !== a.id));
      toast.error('Kasbon karyawan gagal disimpan');
    });
  };
  const updateEmployeeAdvance = (id: string, updates: Partial<EmployeeAdvance>) => {
    const previous = employeeAdvanceList.find(item => item.id === id);
    if (!previous) return;
    const next = { ...previous, ...updates };
    setEmployeeAdvanceList(prev => prev.map(item => item.id === id ? next : item));
    void persistHrAlias('/hr-employee-advances', next).catch(() => {
      setEmployeeAdvanceList(prev => prev.map(item => item.id === id ? previous : item));
      toast.error('Perubahan kasbon gagal disimpan');
    });
  };
  const addPayrollRun = (run: PayrollRun) => {
    setPayrollRunList(prev => [run, ...prev]);
    void persistHrAlias('/hr-payroll-runs', run).catch(() => {
      setPayrollRunList(prev => prev.filter(existing => existing.id !== run.id));
    });
  };
  const updatePayrollRun = (id: string, updates: Partial<PayrollRun>) => {
    const current = payrollRunList.find(run => run.id === id);
    if (!current) return;
    const next = { ...current, ...updates };
    setPayrollRunList(prev => prev.map(run => run.id === id ? next : run));
    if (!localStorage.getItem('authToken')) return;
    void persistHrAlias('/hr-payroll-runs', next).catch(error => {
      setPayrollRunList(prev => prev.map(run => run.id === id ? current : run));
      toast.error(`Payroll gagal diperbarui: ${error instanceof Error ? error.message : 'database tidak dapat dihubungi'}`);
    });
  };
  const disbursePayrollRun = async (id: string, updates: Partial<PayrollRun>) => {
    const current = payrollRunList.find(run => run.id === id);
    if (!current) throw new Error('Payroll tidak ditemukan');
    const next = { ...current, ...updates };
    setPayrollRunList(prev => prev.map(run => run.id === id ? next : run));
    try {
      const posted = await api.request<{ postedLoanIds: string[]; postedSavingMemberIds: string[]; employeeAdvances: Array<{ id: string; payload: EmployeeAdvance }> }>(`/koperasi/payroll-runs/${encodeURIComponent(id)}/post`, { method: 'POST', body: JSON.stringify({ period: next.period, run: next }) });
      if (posted.employeeAdvances.length > 0) {
        const updatedById = new Map(posted.employeeAdvances.map(row => [row.id, row.payload]));
        setEmployeeAdvanceList(prev => prev.map(advance => updatedById.get(advance.id) || advance));
      }
      if (posted.postedLoanIds.length > 0 || posted.postedSavingMemberIds.length > 0) {
        const summary = await api.request<{ simpanans: KoperasiSimpanan[]; pinjamans: KoperasiPinjaman[]; transactions: KoperasiCashTransaction[]; balance: number }>('/koperasi/summary');
        setKoperasiSimpananList(summary.simpanans);
        setKoperasiPinjamanList(summary.pinjamans);
        setKoperasiTransactions(summary.transactions);
        setKoperasiBalance(summary.balance);
      }
    } catch (error) {
      // Keep UI and persisted state aligned when either payroll or koperasi posting fails.
      setPayrollRunList(prev => prev.map(run => run.id === id ? current : run));
      throw error;
    }
  };
  const deletePayrollRun = (id: string) => {
    setPayrollRunList(prev => prev.filter(r => r.id !== id));
    void api.request(`/hr-payroll-runs/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .catch(error => console.warn('[Human Capital] Gagal menghapus payroll run:', error));
  };
  const [extraCategories, setExtraCategories] = useStoredState<string[]>('extraCategories', []);
  useEffect(() => {
    if (!localStorage.getItem('authToken')) return;
    let active = true;
    api.request<Array<{ id: string; name?: string }>>('/inventory-stock-categories')
      .then(rows => {
        if (!active) return;
        setExtraCategories(rows.map(row => row.name || row.id).filter(Boolean));
      })
      .catch(error => console.warn('[Kategori Gudang] Memakai cache lokal karena API belum tersedia:', error));
    return () => { active = false; };
  }, []);
  const addExtraCategory = (cat: string) => {
    const trimmed = cat.trim();
    if (!trimmed || extraCategories.includes(trimmed)) return;
    setExtraCategories(prev => [...prev, trimmed]);
    if (!localStorage.getItem('authToken')) return;
    const id = `STOCK-CATEGORY-${trimmed.replace(/[^a-z0-9]+/gi, '-').toUpperCase()}`;
    api.request('/inventory-stock-categories', {
      method: 'POST', body: JSON.stringify({ id, name: trimmed }),
    }).catch(error => {
      setExtraCategories(prev => prev.filter(category => category !== trimmed));
      toast.error(`Kategori gudang gagal disimpan: ${error.message}`);
    });
  };

  const [bankSaldoAwal, setBankSaldoAwalMap] = useStoredState<Record<string, number>>('bankSaldoAwal', {});
  const setBankSaldoAwal = async (bank: string, amount: number, options: BankOpeningBalanceOptions = {}) => {
    const date = options.date || new Date().toISOString().slice(0, 10);
    const period = options.period || date.slice(0, 7);
    const periodKey = bankOpeningBalanceKey(bank, period);
    const previousAmount = bankSaldoAwal[bank];
    const previousPeriodAmount = bankSaldoAwal[periodKey];
    setBankSaldoAwalMap(prev => ({ ...prev, [bank]: amount, [periodKey]: amount }));
    if (!localStorage.getItem('authToken')) return;
    const id = `BANK-BALANCE-${bank.replace(/[^a-z0-9]+/gi, '-').toUpperCase()}-${period}`;
    const payload = {
      id,
      date,
      periodLabel: `OPENING_BALANCE:${period}`,
      account: bank,
      description: 'Saldo Awal Bank',
      debit: 0,
      credit: 0,
      balance: amount,
      note: [options.note || 'Saldo awal rekening perusahaan', `Prioritas: ${options.priority || 'Normal'}`].join(' · '),
    };
    try {
      await api.request(`/finance/bank-reconciliations/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify(payload),
      }).catch(() => api.request('/finance/bank-reconciliations', {
        method: 'POST', body: JSON.stringify(payload),
      }));
    } catch (error) {
      setBankSaldoAwalMap(prev => {
        const next = { ...prev };
        if (typeof previousAmount === 'undefined') delete next[bank];
        else next[bank] = previousAmount;
        if (typeof previousPeriodAmount === 'undefined') delete next[periodKey];
        else next[periodKey] = previousPeriodAmount;
        return next;
      });
      throw error;
    }
  };

  const [bankManualEntryList, setBankManualEntryList] = useStoredState<BankManualEntry[]>('bankManualEntryList', []);
  const addBankManualEntry = async (entry: Omit<BankManualEntry, 'id'>) => {
    const next = { ...entry, id: `BME-${Date.now()}` };
    setBankManualEntryList(prev => [...prev, next]);
    if (localStorage.getItem('authToken')) {
      try {
        await api.request('/finance/bank-reconciliations', {
        method: 'POST',
        body: JSON.stringify({
          id: next.id,
          date: next.tanggal,
          periodLabel: next.tanggal.slice(0, 7),
          account: next.bank,
          description: next.keterangan,
          debit: next.tipe === 'Masuk' ? next.amount : 0,
          credit: next.tipe === 'Keluar' ? next.amount : 0,
          balance: 0,
          note: next.notes,
        }),
        });
      } catch (error) {
        setBankManualEntryList(prev => prev.filter(item => item.id !== next.id));
        throw error;
      }
    }
  };
  const deleteBankManualEntry = (id: string) => {
    const removed = bankManualEntryList.find(e => e.id === id);
    setBankManualEntryList(prev => prev.filter(e => e.id !== id));
    if (localStorage.getItem('authToken')) {
      api.request(`/finance/bank-reconciliations/${encodeURIComponent(id)}`, { method: 'DELETE' })
        .catch(error => {
          if (removed) setBankManualEntryList(prev => [...prev, removed]);
          toast.error(`Mutasi bank gagal dihapus: ${error.message}`);
        });
    }
  };

  React.useEffect(() => {
    if (!localStorage.getItem('authToken')) return;
    api.request<Array<{ id: string; date: string; periodLabel?: string; account?: string; description: string; debit: number; credit: number; balance: number; note?: string }>>('/finance/bank-reconciliations')
      .then(rows => {
        const balances: Record<string, number> = {};
        const manual: BankManualEntry[] = [];
        rows.forEach(row => {
          if (row.periodLabel?.startsWith('OPENING_BALANCE') && row.account) {
            const period = row.periodLabel.split(':')[1] || row.date.slice(0, 7);
            balances[bankOpeningBalanceKey(row.account, period)] = row.balance || 0;
            if (typeof balances[row.account] === 'undefined') balances[row.account] = row.balance || 0;
          } else if (row.id.startsWith('BME-') && row.account) {
            manual.push({
              id: row.id,
              tanggal: row.date,
              bank: row.account,
              keterangan: row.description,
              amount: row.debit > 0 ? row.debit : row.credit,
              tipe: row.debit > 0 ? 'Masuk' : 'Keluar',
              notes: row.note,
              createdAt: row.date,
            });
          }
        });
        setBankSaldoAwalMap(balances);
        setBankManualEntryList(manual);
      })
      .catch(error => console.warn('[Bank Reconciliation] Memakai cache lokal:', error));
  }, []);

  const [closedYearsList, setClosedYearsList] = useStoredState<ClosedYear[]>('closedYearsList', []);

  React.useEffect(() => {
    api.request<ClosedYear[]>('/finance/closed-years')
      .then(rows => setClosedYearsList(rows))
      .catch(error => console.warn('[Year-End Closing] Memakai cache lokal:', error));
  }, []);

  const addClosedYear = (entry: Omit<ClosedYear, 'id'>) => {
    const saved = { ...entry, id: `CY-${entry.year}` };
    const previous = closedYearsList;
    setClosedYearsList(prev => [...prev.filter(y => y.year !== entry.year), saved]);
    api.request('/finance/closed-years', {
      method: 'POST',
      body: JSON.stringify(saved),
    }).catch(async error => {
      try {
        await api.request(`/finance/closed-years/${encodeURIComponent(saved.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(saved),
        });
      } catch {
        console.error('[Year-End Closing] Gagal menyimpan tutup buku:', error);
        setClosedYearsList(previous);
      }
    });
  };
  const isYearClosed = (year: number) => closedYearsList.some(y => y.year === year);

  const clearAllPayrollRuns = () => {
    const previous = payrollRunList;
    setPayrollRunList([]);
    void api.request('/hr-payroll-runs/bulk', { method: 'PUT', body: JSON.stringify([]) })
      .catch(error => {
        setPayrollRunList(previous);
        toast.error(`Gagal menghapus semua payroll: ${error.message}`);
      });
  };

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const auth = useAuth();

  useEffect(() => {
    if (auth.currentUser) {
      setCurrentUser(auth.currentUser);
    }
  }, [auth.currentUser]);
  const [alerts, setAlerts] = useStoredState<any[]>('alerts', []);

  const addAuditLog = (log: Omit<AuditLog, 'id' | 'timestamp' | 'userId' | 'userName'>) => {
    const newLog: AuditLog = {
      ...log,
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser?.id || 'System',
      userName: currentUser?.fullName || 'System'
    };
    setAuditLogs(prev => [newLog, ...prev]);
    api.request<AuditLog>('/audit-logs', {
      method: 'POST',
      body: JSON.stringify(newLog),
    }).then((saved) => {
      setAuditLogs(prev => prev.map(item => item.id === newLog.id ? saved : item));
    }).catch(() => {
      // Audit trail tidak boleh menghambat transaksi utama bila koneksi sementara putus.
    });
  };

  const markAlertAsRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'Read' } : a));
  };

  // Stock Alert Generator
  useEffect(() => {
    const stockAlerts = stockItemList
      .filter(item => item.stok <= item.minStock)
      .map(item => ({
        id: `STK-ALERT-${item.id}`,
        type: 'Inventory',
        title: 'Low Stock Warning',
        message: `Material ${item.nama} (${item.kode}) mencapai batas minimum (${item.stok} ${item.satuan})`,
        status: 'Unread',
        severity: 'High',
        timestamp: new Date().toISOString()
      }));
    
    setAlerts(prev => {
      const existingIds = new Set(prev.map(a => a.id));
      const newAlerts = stockAlerts.filter(a => !existingIds.has(a.id));
      return [...prev, ...newAlerts];
    });
  }, [stockItemList]);

  const addPettyCashEntry = async (entry: Omit<PettyCashEntry, 'id'>) => {
    const next = { ...entry, id: crypto.randomUUID() };
    if (localStorage.getItem('authToken')) {
      try { const saved = await persistHrAlias('/finance-petty-cash', next); setPettyCashList(prev => [...prev, saved]); }
      catch { toast.error('Transaksi kas kecil gagal disimpan'); return; }
    } else setPettyCashList(prev => [...prev, next]);
  };

  const addTopUpRequest = (req: Omit<TopUpRequest, 'id' | 'status'>) => {
    const next: TopUpRequest = { ...req, id: `TUR-${Date.now()}`, status: 'Pending' };
    setTopUpRequestList(prev => [...prev, next]);
    void persistHrAlias('/finance-petty-cash-topups', next).catch(() => {
      setTopUpRequestList(prev => prev.filter(item => item.id !== next.id));
      toast.error('Permintaan top-up kas kecil gagal disimpan');
    });
  };

  const approveTopUpRequest = async (id: string, approverName: string) => {
    const req = topUpRequestList.find(r => r.id === id);
    if (!req) return;
    if (localStorage.getItem('authToken')) {
      const result = await api.request<{ request: TopUpRequest; entry: PettyCashEntry }>(`/finance/petty-cash-topups/${id}/approve`, { method: 'POST', body: JSON.stringify({ approverName }) });
      setTopUpRequestList(prev => prev.map(r => r.id === id ? result.request : r));
      setPettyCashList(prev => [...prev, result.entry]);
    } else {
      const approved = { ...req, status: 'Approved' as const, approvedBy: approverName, approvedAt: new Date().toISOString() };
      setTopUpRequestList(prev => prev.map(r => r.id === id ? approved : r));
    }
  };

  const rejectTopUpRequest = (id: string, reason: string) => {
    const request = topUpRequestList.find(r => r.id === id);
    if (!request) return;
    const rejected = { ...request, status: 'Rejected' as const, rejectedReason: reason };
    const previousRequests = topUpRequestList;
    setTopUpRequestList(prev => prev.map(r => r.id === id ? rejected : r));
    void persistHrAlias('/finance-petty-cash-topups', rejected).catch(() => {
      setTopUpRequestList(previousRequests);
      toast.error('Penolakan top-up kas kecil gagal disimpan');
    });
  };

  const addPettyCashGudangEntry = async (entry: Omit<PettyCashEntry, 'id'>) => {
    const next = { ...entry, id: crypto.randomUUID() };
    if (localStorage.getItem('authToken')) {
      try { const saved = await persistHrAlias('/finance-warehouse-petty-cash', next); setPettyCashGudangList(prev => [...prev, saved]); }
      catch { toast.error('Transaksi kas gudang gagal disimpan'); return; }
    } else setPettyCashGudangList(prev => [...prev, next]);
  };

  const updatePettyCashGudangEntry = (id: string, updates: Partial<PettyCashEntry>) => {
    const previous = pettyCashGudangList.find(e => e.id === id);
    if (!previous) return;
    const next = { ...previous, ...updates };
    setPettyCashGudangList(prev => prev.map(e => e.id === id ? next : e));
    void persistHrAlias('/finance-warehouse-petty-cash', next).catch(() => {
      setPettyCashGudangList(prev => prev.map(e => e.id === id ? previous : e));
      toast.error('Perubahan kas gudang gagal disimpan');
    });
  };

  const addTopUpGudangRequest = (req: Omit<TopUpRequest, 'id' | 'status'>) => {
    const next: TopUpRequest = { ...req, id: `TUG-${Date.now()}`, status: 'Pending' };
    setTopUpGudangRequestList(prev => [...prev, next]);
    void persistHrAlias('/finance-warehouse-petty-cash-topups', next).catch(() => {
      setTopUpGudangRequestList(prev => prev.filter(item => item.id !== next.id));
      toast.error('Permintaan top-up kas gudang gagal disimpan');
    });
  };

  const approveTopUpGudangRequest = async (id: string, approverName: string) => {
    const req = topUpGudangRequestList.find(r => r.id === id);
    if (!req) return;
    if (localStorage.getItem('authToken')) {
      // Approve lewat backend: request + entry kas + mutasi bank rekonsiliasi
      // dibuat atomik dalam satu transaksi PostgreSQL.
      const result = await api.request<{ request: TopUpRequest; entry: PettyCashEntry }>(`/finance/petty-cash-topups/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approverName, warehouse: true }),
      });
      setTopUpGudangRequestList(prev => prev.map(r => r.id === id ? result.request : r));
      setPettyCashGudangList(prev => [...prev, result.entry]);
      return;
    }
    // Fallback offline: perbarui state lokal saja.
    const approved = { ...req, status: 'Approved' as const, approvedBy: approverName, approvedAt: new Date().toISOString() };
    setTopUpGudangRequestList(prev => prev.map(r => r.id === id ? approved : r));
    const lastBalance = pettyCashGudangList.length > 0 ? pettyCashGudangList[pettyCashGudangList.length - 1].balance : 0;
    const entry: PettyCashEntry = {
      id: crypto.randomUUID(),
      date: req.date,
      accountCode: '00000',
      description: `Top-Up Kas Gudang dari ${req.bank}${req.notes ? ' — ${req.notes}' : ''}`,
      debit: req.amount,
      credit: 0,
      balance: lastBalance + req.amount,
      kasir: req.bank,
      sumberDana: req.bank,
    };
    setPettyCashGudangList(prev => [...prev, entry]);
  };

  const rejectTopUpGudangRequest = (id: string, reason: string) => {
    const request = topUpGudangRequestList.find(r => r.id === id);
    if (!request) return;
    const rejected = { ...request, status: 'Rejected' as const, rejectedReason: reason };
    setTopUpGudangRequestList(prev => prev.map(r => r.id === id ? rejected : r));
    void persistHrAlias('/finance-warehouse-petty-cash-topups', rejected).catch(() => {
      setTopUpGudangRequestList(prev => prev.map(r => r.id === id ? request : r));
      toast.error('Penolakan top-up kas gudang gagal disimpan');
    });
  };

  const addArchiveEntry = (entry: Omit<ArchiveEntry, 'id'>) => {
    const newEntry = { ...entry, id: crypto.randomUUID() };
    setArchiveRegistry(prev => [newEntry, ...prev]);
    if (!localStorage.getItem('authToken')) return;

    api.request<ArchiveEntry>('/archive-registry', {
      method: 'POST',
      body: JSON.stringify(newEntry),
    }).then(saved => {
      setArchiveRegistry(prev => prev.map(item => item.id === newEntry.id ? saved : item));
    }).catch(error => {
      setArchiveRegistry(prev => prev.filter(item => item.id !== newEntry.id));
      toast.error(`Register arsip gagal disimpan ke database: ${error.message}`);
    });
  };

  const addPayroll = (p: Payroll) => {
    setPayrollList(prev => [p, ...prev.filter(item => item.id !== p.id)]);
    if (!localStorage.getItem('authToken')) return;
    api.request<Payroll>('/payrolls', { method: 'POST', body: JSON.stringify(p) })
      .then(saved => setPayrollList(prev => prev.map(item => item.id === p.id ? saved : item)))
      .catch(error => {
        setPayrollList(prev => prev.filter(item => item.id !== p.id));
        toast.error(`Payroll gagal disimpan ke database: ${error.message}`);
      });
  };
  const addWorkingExpenseSheet = (s: WorkingExpenseSheet) => {
    setWorkingExpenseSheets(prev => [s, ...prev]);
    void persistHrAlias('/finance-working-expense-sheets', s).catch(() => {
      setWorkingExpenseSheets(prev => prev.filter(item => item.id !== s.id));
      toast.error('Working expense gagal disimpan');
    });
  };
  const updateWorkingExpenseSheet = (id: string, updates: Partial<WorkingExpenseSheet>) => {
    const previous = workingExpenseSheets.find(item => item.id === id);
    if (!previous) return;
    const next = { ...previous, ...updates };
    setWorkingExpenseSheets(prev => prev.map(item => item.id === id ? next : item));
    void persistHrAlias('/finance-working-expense-sheets', next).catch(() => {
      setWorkingExpenseSheets(prev => prev.map(item => item.id === id ? previous : item));
      toast.error('Perubahan working expense gagal disimpan');
    });
  };
  const addKasbon = (k: KasbonEntry) => {
    setKasbonList(prev => [k, ...prev]);
    upsertHrAlias('/hr-kasbon-karyawan', k);
  };
  const updateKasbon = (id: string, updates: Partial<KasbonEntry>) => setKasbonList(prev => prev.map(k => {
    if (k.id !== id) return k;
    const next = { ...k, ...updates };
    upsertHrAlias('/hr-kasbon-karyawan', next);
    return next;
  }));
  const deleteKasbon = (id: string) => {
    setKasbonList(prev => prev.filter(k => k.id !== id));
    void api.request(`/hr-kasbon-karyawan/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  };
  const addKasbonTHL = (k: KasbonTHLEntry) => {
    setKasbonTHLList(prev => [k, ...prev]);
    upsertHrAlias('/hr-kasbon-thl', k);
  };
  const updateKasbonTHL = (id: string, updates: Partial<KasbonTHLEntry>) => setKasbonTHLList(prev => prev.map(k => {
    if (k.id !== id) return k;
    const next = { ...k, ...updates };
    upsertHrAlias('/hr-kasbon-thl', next);
    return next;
  }));
  const deleteKasbonTHL = (id: string) => {
    setKasbonTHLList(prev => prev.filter(k => k.id !== id));
    void api.request(`/hr-kasbon-thl/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  };
  const addTHLTimesheet = (r: THLTimesheetRecord) => {
    setTHLTimesheetList(prev => [...prev, r]);
    upsertHrAlias('/hr-thl-timesheets', r);
  };
  const updateTHLTimesheet = (id: string, updates: Partial<THLTimesheetRecord>) => setTHLTimesheetList(prev => prev.map(r => {
    if (r.id !== id) return r;
    const next = { ...r, ...updates };
    upsertHrAlias('/hr-thl-timesheets', next);
    return next;
  }));
  const deleteTHLTimesheet = (id: string) => {
    setTHLTimesheetList(prev => prev.filter(r => r.id !== id));
    void api.request(`/hr-thl-timesheets/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  };
  const addTHLSettlement = (s: THLKasbonSettlement) => {
    setTHLSettlementList(prev => [s, ...prev]);
    upsertHrAlias('/hr-thl-settlements', s);
  };
  const deleteTHLSettlement = (id: string) => {
    setTHLSettlementList(prev => prev.filter(s => s.id !== id));
    void api.request(`/hr-thl-settlements/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  };

  const [thlPayrollRunList, setTHLPayrollRunList] = useStoredState<THLPayrollRun[]>('thlPayrollRunList', []);
  useEffect(() => {
    if (!localStorage.getItem('authToken')) return;
    let active = true;
    const sync = async <T extends { id: string }>(path: string, cached: T[], apply: (rows: T[]) => void) => {
      const rows = await api.request<T[]>(path);
      if (!active) return;
      if (rows.length > 0) apply(rows);
      else if (cached.length > 0) await api.request(`${path}/bulk`, { method: 'PUT', body: JSON.stringify(cached) });
    };
    Promise.all([
      sync('/hr-thl-contracts', thlList, setThlList),
      sync('/hr-thl-timesheets', thlTimesheetList, setTHLTimesheetList),
      sync('/hr-thl-payroll-runs', thlPayrollRunList, setTHLPayrollRunList),
      sync('/hr-kasbon-thl', kasbonTHLList, setKasbonTHLList),
    ]).catch(error => console.warn('[Human Capital THL] Memakai cache lokal:', error));
    return () => { active = false; };
  }, []);
  const addTHLPayrollRun = (run: THLPayrollRun) => {
    setTHLPayrollRunList(prev => [run, ...prev]);
    upsertHrAlias('/hr-thl-payroll-runs', run);
  };
  const updateTHLPayrollRun = (id: string, updates: Partial<THLPayrollRun>) =>
    setTHLPayrollRunList(prev => prev.map(r => {
      if (r.id !== id) return r;
      const next = { ...r, ...updates };
      upsertHrAlias('/hr-thl-payroll-runs', next);
      return next;
    }));
  const deleteTHLPayrollRun = (id: string) => {
    setTHLPayrollRunList(prev => prev.filter(r => r.id !== id));
    void api.request(`/hr-thl-payroll-runs/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  };
  const saveTHLTimesheetBatch = (thlId: string, periode: string, records: THLTimesheetRecord[]) => {
    setTHLTimesheetList(prev => [
      ...prev.filter(r => !(r.thlId === thlId && r.periode === periode)),
      ...records,
    ]);
    void api.request('/hr-thl-timesheets/bulk', { method: 'PUT', body: JSON.stringify(records) })
      .catch(error => console.warn('[Human Capital THL] Gagal menyimpan batch timesheet:', error));
  };
  const addPayrollRecord = (record: PayrollRecord) => {
    setPayrollRecords(prev => [record, ...prev]);
    void persistHrAlias('/finance-payroll-records', record).catch(() => {
      setPayrollRecords(prev => prev.filter(item => item.id !== record.id));
      toast.error('Record payroll gagal disimpan');
    });
  };
  const updatePayrollRecord = (id: string, updates: Partial<PayrollRecord>) => {
    const previous = payrollRecords.find(record => record.id === id);
    if (!previous) return;
    const next = { ...previous, ...updates };
    setPayrollRecords(prev => prev.map(record => record.id === id ? next : record));
    void persistHrAlias('/finance-payroll-records', next).catch(() => {
      setPayrollRecords(prev => prev.map(record => record.id === id ? previous : record));
      toast.error('Perubahan record payroll gagal disimpan');
    });
  };
  const markEmployeePaid = (recordId: string, employeeId: string) => {
    setPayrollRecords(prev => prev.map(r => {
      if (r.id !== recordId) return r;
      const entries = r.entries.map(e =>
        e.employeeId === employeeId ? { ...e, status: 'Paid' as const, paidDate: new Date().toISOString().split('T')[0] } : e
      );
      const allPaid = entries.every(e => e.status === 'Paid');
      const next = { ...r, entries, status: allPaid ? 'Paid' : r.status };
      upsertHrAlias('/finance-payroll-records', next);
      return next;
    }));
  };

  const login = (username: string) => {
    const user = userList.find(u => u.username === username);
    if (user) {
      setCurrentUser(user);
      toast.success(`Welcome back, ${user.fullName}`);
    } else {
      toast.error("User not found");
    }
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    const existing = userList.find(user => user.id === id);
    if (!existing) return;
    const next = { ...existing, ...updates };
    setUserList(prev => prev.map(user => user.id === id ? next : user));

    const payload: Record<string, unknown> = {
      username: next.username,
      name: next.fullName,
      role: roleLabelToBackend[next.role] || next.role,
      isActive: next.status !== 'Inactive',
    };
    if (next.email) payload.email = next.email;
    if (typeof next.phone !== 'undefined') payload.phone = next.phone;
    if (updates.password?.trim()) payload.password = updates.password.trim();

    api.request<BackendUser>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }).then((saved) => {
      setUserList(prev => prev.map(user => user.id === id ? mapBackendUser(saved) : user));
      toast.success('User berhasil diperbarui');
    }).catch((error) => {
      setUserList(prev => prev.map(user => user.id === id ? existing : user));
      toast.error(`User gagal diperbarui: ${error.message}`);
    });
  };

  const deleteUser = async (id: string): Promise<void> => {
    const existing = userList.find((user) => user.id === id);
    setUserList(prev => prev.filter((user) => user.id !== id));
    try {
      await api.request<void>(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast.success('User berhasil dihapus permanen');
    } catch (error) {
      if (existing) {
        setUserList(prev => [existing, ...prev.filter((user) => user.id !== id)]);
      }
      throw error;
    }
  };

  const addUser = async (user: User): Promise<BackendUser> => {
    const password = user.password?.trim();
    if (!password) {
      throw new Error('Password wajib diisi untuk user baru');
    }
    const saved = await api.request<BackendUser>('/users', {
      method: 'POST',
      body: JSON.stringify({
        email: user.email,
        username: user.username,
        name: user.fullName,
        phone: user.phone || undefined,
        password,
        role: roleLabelToBackend[user.role] || user.role,
      }),
    });
    setUserList(prev => [...prev, mapBackendUser(saved)]);
    toast.success('User berhasil ditambahkan');
    return saved;
  };
  const addPO = (po: PurchaseOrder) => {
    setPoList(prev => [...prev.filter(item => item.id !== po.id), po]);
    api.request<PurchaseOrder>('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(po),
    }).then(saved => {
      setPoList(prev => prev.map(item => item.id === saved.id ? saved : item));
    }).catch(error => {
      setPoList(prev => prev.filter(item => item.id !== po.id));
      toast.error(`PO gagal disimpan ke database: ${error.message}`);
    });
  };
  const addLeave = (leave: Leave) => {
    setLeaveList(prev => [...prev, leave]);
    return api.request<Leave>('/hr-leaves', { method: 'POST', body: JSON.stringify(leave) })
      .then(saved => {
        // ID pada form bersifat sementara. Selalu ganti baris optimistis dengan
        // respons kanonis backend agar tanggal, nomor cuti, dan jumlah hari sinkron.
        setLeaveList(prev => prev.map(item => item.id === leave.id ? saved : item));
        return saved;
      })
      .catch(error => {
        setLeaveList(prev => prev.filter(item => item.id !== leave.id));
        throw error;
      });
  };
  const updateLeave = (id: string, updates: Partial<Leave>) => setLeaveList(prev => prev.map(l => {
    if (l.id !== id) return l;
    const next = { ...l, ...updates };
    void api.request(`/hr-leaves/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(next) })
      .catch(error => console.warn('[Human Capital] Gagal memperbarui cuti:', error));
    return next;
  }));
  const addOvertime = (request: OvertimeRequest) => {
    setOvertimeList(prev => [request, ...prev]);
    upsertHrAlias('/hr-overtime-requests', request);
  };
  const updateOvertime = (id: string, updates: Partial<OvertimeRequest>) => setOvertimeList(prev => prev.map(r => {
    if (r.id !== id) return r;
    const next = { ...r, ...updates };
    upsertHrAlias('/hr-overtime-requests', next);
    return next;
  }));
  const addPenilaian = (p: any) => {
    setPenilaianKinerjaList(prev => [p, ...prev]);
    upsertHrAlias('/hr-performance-reviews', p);
  };
  const updatePenilaian = (id: string, updates: any) => setPenilaianKinerjaList(prev => prev.map(p => {
    if (p.id !== id) return p;
    const next = { ...p, ...updates };
    upsertHrAlias('/hr-performance-reviews', next);
    return next;
  }));
  const deletePenilaian = (id: string) => {
    setPenilaianKinerjaList(prev => prev.filter(p => p.id !== id));
    void api.request(`/hr-performance-reviews/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  };
  const addOnlineEmployee = (emp: OnlineEmployee) => {
    setOnlineEmployeeList(prev => [...prev, emp]);
    void api.request('/hr-online-status', { method: 'POST', body: JSON.stringify(emp) }).catch(() => {});
  };
  const updateOnlineEmployee = (id: string, updates: Partial<OnlineEmployee>) => setOnlineEmployeeList(prev => prev.map(e => {
    if (e.id !== id) return e;
    const next = { ...e, ...updates };
    void api.request(`/hr-online-status/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(next) }).catch(() => {});
    return next;
  }));
  const updateProject = async (id: string, updates: Partial<Project>): Promise<boolean> => {
    if (!localStorage.getItem('authToken')) {
      toast.error('Sesi login berakhir. Silakan login kembali.');
      return false;
    }
    try {
      const saved = await api.request<Project>(`/projects/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify(updates),
      });
      setProjectList(prev => prev.map(project => project.id === id ? saved : project));
      return true;
    } catch (error) {
      toast.error(`Project gagal diperbarui di database: ${error instanceof Error ? error.message : 'Terjadi kesalahan'}`);
      return false;
    }
  };
  const createProjectSpkWithWorkOrder = async (projectId: string, spk: Record<string, unknown>, workOrder: WorkOrder) => {
    const saved = await api.request<Project>(`/projects/${encodeURIComponent(projectId)}/spk-work-order`, {
      method: 'POST', body: JSON.stringify({ spk, workOrder }),
    });
    setProjectList(prev => prev.map(project => project.id === projectId ? saved : project));
    setWorkOrderList(prev => [...prev.filter(item => item.id !== workOrder.id), workOrder]);
  };
  const addEmployee = (employee: Employee) => {
    setEmployeeList(prev => [...prev.filter(item => item.id !== employee.id), employee]);
    api.request<Employee>('/employees', { method: 'POST', body: JSON.stringify(employee) })
      .then(saved => setEmployeeList(prev => prev.map(item => item.id === saved.id ? saved : item)))
      .catch(error => {
        setEmployeeList(prev => prev.filter(item => item.id !== employee.id));
        toast.error(`Karyawan gagal disimpan ke database: ${error.message}`);
      });
  };
  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    const current = employeeList.find(item => item.id === id);
    if (!current) return;
    const merged = { ...current, ...updates };
    setEmployeeList(prev => prev.map(item => item.id === id ? merged : item));
    api.request<Employee>(`/employees/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(updates) })
      .then(saved => setEmployeeList(prev => prev.map(item => item.id === id ? saved : item)))
      .catch(error => {
        setEmployeeList(prev => prev.map(item => item.id === id ? current : item));
        toast.error(`Data karyawan gagal diperbarui: ${error.message}`);
      });
  };
  const deleteEmployee = (id: string) => {
    const current = employeeList.find(item => item.id === id);
    setEmployeeList(prev => prev.filter(item => item.id !== id));
    api.request<void>(`/employees/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .catch(error => {
        if (current) setEmployeeList(prev => [...prev, current]);
        toast.error(`Karyawan gagal dihapus: ${error.message}`);
      });
  };
  const addAttendance = (attendance: Attendance) => {
    setAttendanceList(prev => [...prev.filter(item => item.id !== attendance.id), attendance]);
    api.request<Attendance>('/attendances', { method: 'POST', body: JSON.stringify(attendance) })
      .then(saved => setAttendanceList(prev => prev.map(item => item.id === saved.id ? saved : item)))
      .catch(error => {
        setAttendanceList(prev => prev.filter(item => item.id !== attendance.id));
        toast.error(`Kehadiran gagal disimpan: ${error.message}`);
      });
  };
  const addAttendanceBulk = (attendances: Attendance[]) => {
    if (attendances.length === 0) return;
    const ids = new Set(attendances.map(item => item.id));
    setAttendanceList(prev => [...prev.filter(item => !ids.has(item.id)), ...attendances]);
    api.request('/attendances/bulk', { method: 'PUT', body: JSON.stringify(attendances) })
      .catch(error => {
        setAttendanceList(prev => prev.filter(item => !ids.has(item.id)));
        toast.error(`Kehadiran massal gagal disimpan: ${error.message}`);
      });
  };
  const updateAttendance = (id: string, updates: Partial<Attendance>) => {
    const current = attendanceList.find(item => item.id === id);
    if (!current) return;
    const merged = { ...current, ...updates };
    setAttendanceList(prev => prev.map(item => item.id === id ? merged : item));
    api.request<Attendance>(`/attendances/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(updates) })
      .then(saved => setAttendanceList(prev => prev.map(item => item.id === id ? saved : item)))
      .catch(error => {
        setAttendanceList(prev => prev.map(item => item.id === id ? current : item));
        toast.error(`Kehadiran gagal diperbarui: ${error.message}`);
      });
  };
  const deleteAttendance = (id: string) => {
    const current = attendanceList.find(item => item.id === id);
    setAttendanceList(prev => prev.filter(item => item.id !== id));
    api.request<void>(`/attendances/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .catch(error => {
        if (current) setAttendanceList(prev => [...prev, current]);
        toast.error(`Kehadiran gagal dihapus: ${error.message}`);
      });
  };
  const addQCInspection = async (inspection: QCInspection) => {
    setQcInspectionList(prev => [...prev, inspection]);
    try {
      await api.request('/production/submit-qc', { method: 'POST', body: JSON.stringify({ inspection }) });
      await Promise.all([refreshProductionFlow(), refreshProcurementInventory()]);
    } catch (error) {
      setQcInspectionList(prev => prev.filter(item => item.id !== inspection.id));
      toast.error(`QC gagal disimpan: ${error instanceof Error ? error.message : 'kesalahan server'}`);
      await Promise.all([refreshProductionFlow().catch(() => undefined), refreshProcurementInventory().catch(() => undefined)]);
      throw error;
    }
  };
  const addWorkOrder = (wo: WorkOrder) => {
    setWorkOrderList(prev => [...prev, wo]);
    api.request<WorkOrder>('/work-orders', { method: 'POST', body: JSON.stringify(wo) })
      .then(() => refreshProductionFlow())
      .catch(error => { toast.error(`Work Order gagal disimpan: ${error.message}`); refreshProductionFlow().catch(() => undefined); });
  };
  const updateWorkOrder = (id: string, updates: Partial<WorkOrder>) => {
    const current = workOrderList.find(wo => wo.id === id);
    if (!current) return;
    const merged = { ...current, ...updates };
    setWorkOrderList(prev => prev.map(wo => wo.id === id ? merged : wo));
    api.request<WorkOrder>(`/work-orders/${id}`, { method: 'PATCH', body: JSON.stringify(merged) })
      .then(() => refreshProductionFlow())
      .catch(error => { toast.error(`Work Order gagal diperbarui: ${error.message}`); refreshProductionFlow().catch(() => undefined); });
  };
  const deleteWorkOrder = (id: string) => {
    setWorkOrderList(prev => prev.filter(wo => wo.id !== id));
    api.request<void>(`/work-orders/${id}`, { method: 'DELETE' })
      .then(() => refreshProductionFlow())
      .catch(error => { toast.error(`Work Order gagal dihapus: ${error.message}`); refreshProductionFlow().catch(() => undefined); });
  };

  // --- Consolidated Stock Logic (Zero Re-typing) ---
  const createStockOut = (so: StockOut) => {
    setStockOutList(prev => [...prev, so]);
    
    const updatedInventory = [...stockItemList];
    const newMovements: StockMovement[] = [];
    
    so.items.forEach(item => {
      const idx = updatedInventory.findIndex(i => i.kode === item.kode || i.nama === item.nama);
      if (idx !== -1) {
        const stockBefore = updatedInventory[idx].stok;
        updatedInventory[idx] = { ...updatedInventory[idx], stok: stockBefore - item.qty, lastUpdate: new Date().toISOString() };
        
        const project = projectList.find(p => p.id === so.projectId);
        newMovements.push({
          id: `MOV-${Date.now()}-${item.kode}`,
          tanggal: so.tanggal,
          type: 'OUT',
          refNo: so.noStockOut,
          refType: so.type === 'Project Issue' ? 'Project Issue' : 'Stock Out',
          itemKode: updatedInventory[idx].kode,
          itemNama: updatedInventory[idx].nama,
          qty: item.qty,
          unit: item.satuan || updatedInventory[idx].satuan,
          lokasi: updatedInventory[idx].lokasi,
          stockBefore: stockBefore,
          stockAfter: stockBefore - item.qty,
          createdBy: so.createdBy,
          projectId: so.projectId,
          projectName: project?.namaProject || so.projectId || undefined,
          batchNo: item.batchNo,
          notes: so.notes || (so.noWorkOrder ? `WO: ${so.noWorkOrder}` : undefined),
        });
      }
    });

    setStockItemList(updatedInventory);
    setStockMovementList(prev => [...newMovements, ...prev]);
    addAuditLog({ action: 'STOCK_OUT', module: 'Warehouse', details: `Stock out ${so.noStockOut} processed`, status: 'Success' });

    if (localStorage.getItem('authToken')) {
      api.request<StockOut>('/inventory/stock-outs', { method: 'POST', body: JSON.stringify(so) })
        .then(() => refreshProcurementInventory())
        .catch((error) => {
          console.error('[Stock Out] Gagal menyimpan ke database:', error);
          toast.error(`Stock Out ${so.noStockOut} gagal disimpan`, {
            description: error instanceof Error ? error.message : 'Periksa stok dan koneksi backend.',
          });
          refreshProcurementInventory().catch(() => undefined);
        });
    }
  };

  const createStockIn = (si: StockIn) => {
    setStockInList(prev => [...prev, si]);
    api.request<StockIn>('/inventory/stock-ins', { method: 'POST', body: JSON.stringify(si) })
      .then(() => refreshProcurementInventory())
      .catch(error => {
        setStockInList(prev => prev.filter(item => item.id !== si.id));
        toast.error(`Stock In gagal disimpan: ${error.message}`);
        refreshProcurementInventory().catch(() => undefined);
      });
  };

  const addStockItem = (item: StockItem) => {
    setStockItemList(prev => [...prev, item]);
    api.request<StockItem>('/inventory/items', { method: 'POST', body: JSON.stringify(item) })
      .then(() => refreshProcurementInventory())
      .catch(error => {
        setStockItemList(prev => prev.filter(existing => existing.id !== item.id));
        toast.error(`SKU gagal disimpan ke database: ${error.message}`);
      });
  };

  const updateStockIn = (id: string, updates: Partial<StockIn>) => {
    const current = stockInList.find(item => item.id === id);
    if (!current) return;
    const merged = { ...current, ...updates };
    setStockInList(prev => prev.map(item => item.id === id ? merged : item));
    api.request<StockIn>(`/inventory/stock-ins/${id}`, { method: 'PATCH', body: JSON.stringify(merged) })
      .then(() => refreshProcurementInventory())
      .catch(error => {
        toast.error(`Stock In gagal diperbarui: ${error.message}`);
        refreshProcurementInventory().catch(() => undefined);
      });
  };

  const addReceiving = (rcv: Receiving) => {
    setReceivingList(prev => [...prev, rcv]);

    // Receiving hanya memperbarui progress PO. Stock In dibuat terpisah dari
    // halaman Stock In dengan memilih dokumen Receiving sebagai referensi.
    // Blok optimistis ini hanya menjaga daftar PO tetap responsif sampai refresh.
    if (rcv.poId) {
      const po = poList.find(p => p.id === rcv.poId);
      if (po) {
        const updatedPOItems = po.items.map(poItem => {
          const receivedItem = rcv.items.find(ri => ri.itemKode === poItem.kode || ri.itemName === poItem.nama);
          if (receivedItem) {
            return {
              ...poItem,
              qtyReceived: (poItem.qtyReceived || 0) + (receivedItem.qtyReceived || 0)
            };
          }
          return poItem;
        });

        const allReceived = updatedPOItems.every(item => (item.qtyReceived || 0) >= item.qty);
        const someReceived = updatedPOItems.some(item => (item.qtyReceived || 0) > 0);
        
        let poStatus: PurchaseOrder['status'] = po.status;
        if (allReceived) poStatus = 'Received';
        else if (someReceived) poStatus = 'Partial';

        setPoList(prev => prev.map(item => item.id === rcv.poId
          ? { ...item, items: updatedPOItems, status: poStatus }
          : item));
      }
    }

    addAuditLog({
      action: 'MATERIAL_RECEIVED',
      module: 'Procurement',
      details: `Received materials for PO ${rcv.noPO} via GRN ${rcv.noReceiving}`,
      status: 'Success'
    });

    api.request<Receiving>('/receivings', {
      method: 'POST',
      body: JSON.stringify(rcv),
    }).then(() => refreshProcurementInventory())
      .catch(error => {
        toast.error(`Receiving gagal disimpan ke database: ${error.message}`);
        refreshProcurementInventory().catch(() => {});
      });
  };

  const handleProductionOutput = (woId: string, qty: number, _workerName: string, _selectedItem?: string) => {
    // Read current WO synchronously before updating state
    const wo = workOrderList.find(w => w.id === woId);
    if (!wo) return;

    const prevCompleted = wo.completedQty || 0;
    const newCompleted = prevCompleted + qty;
    // Stock Out, BOM consumption, and authoritative WO progress are created
    // transactionally by POST /production-reports. Keep only a temporary UI
    // projection here until refreshProductionFlow receives server data.
    const newStatus = newCompleted >= wo.targetQty ? 'QC' : 'In Progress';
    updateWorkOrder(woId, { completedQty: newCompleted, status: newStatus });

    // Temporary project progress projection; server data replaces it after save.
    if (wo.projectId) {
      const project = projectList.find(item => item.id === wo.projectId);
      const projectWOs = workOrderList
        .map(item => item.id === woId ? { ...item, completedQty: newCompleted } : item)
        .filter(item => item.projectId === wo.projectId);
      const totalTarget = projectWOs.reduce((sum, item) => sum + item.targetQty, 0);
      const totalCompleted = projectWOs.reduce((sum, item) => sum + (item.completedQty || 0), 0);
      const progress = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : project?.progress;
      if (typeof progress === 'number') updateProject(wo.projectId, { progress });
    }
  };

  const addProductionReport = async (report: ProductionReport) => {
    setProductionReportList(prev => [report, ...prev]);
    if (!localStorage.getItem('authToken')) return;

    try {
      // LHP yang terkait WO wajib masuk lewat command endpoint. Endpoint ini
      // menyimpan LHP, pemakaian BOM, mutasi stok, progress WO, dan progress
      // proyek dalam satu transaksi database.
      if ((report as any).workOrderId || (report as any).woId) {
        await api.request('/production/submit-lhp', {
          method: 'POST',
          body: JSON.stringify({
            report: {
              ...report,
              woId: (report as any).workOrderId || (report as any).woId,
              woNumber: (report as any).woNumber,
            },
          }),
        });
        await Promise.all([refreshProductionFlow(), refreshProcurementInventory()]);
        return;
      }

      // LHP tanpa WO tetap dicatat sebagai laporan mandiri; pengeluaran
      // material manualnya ditangani oleh flow Stock Out di page terkait.
      await api.request<ProductionReport>('/production-reports', { method: 'POST', body: JSON.stringify(report) });
      await refreshProductionFlow();
    } catch (error) {
      setProductionReportList(prev => prev.filter(item => item.id !== report.id));
      toast.error(`LHP gagal disimpan: ${error instanceof Error ? error.message : 'kesalahan server'}`);
      await refreshProductionFlow().catch(() => undefined);
      await refreshProcurementInventory().catch(() => undefined);
      throw error;
    }
  };
  const updateProductionReport = (id: string, updates: Partial<ProductionReport>) => {
    const current = productionReportList.find(report => report.id === id);
    if (!current) return;
    const merged = { ...current, ...updates };
    setProductionReportList(prev => prev.map(report => report.id === id ? merged : report));
    if (merged.projectId) {
      api.request<ProductionReport>(`/production-reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(merged),
      })
        .then(() => refreshProductionFlow())
        .catch(error => { toast.error(`LHP gagal diperbarui: ${error.message}`); refreshProductionFlow().catch(() => undefined); });
    }
  };
  const addBeritaAcara = (ba: BeritaAcara) => {
    setBeritaAcaraList(prev => [...prev.filter(item => item.id !== ba.id), ba]);
    if (!localStorage.getItem('authToken')) return;

    api.request<unknown>('/data/berita-acara', {
      method: 'POST',
      body: JSON.stringify({ entityId: ba.id, payload: ba }),
    }).then(saved => {
      const persisted = unwrapDataEntity<BeritaAcara>(saved);
      setBeritaAcaraList(prev => prev.map(item => item.id === ba.id ? persisted : item));
    }).catch(error => {
      setBeritaAcaraList(prev => prev.filter(item => item.id !== ba.id));
      toast.error(`Berita Acara gagal disimpan ke database: ${error.message}`);
    });
  };
  const updateBeritaAcara = (id: string, updates: Partial<BeritaAcara>) => {
    const current = beritaAcaraList.find(item => item.id === id);
    if (!current) return;
    const merged = { ...current, ...updates };
    setBeritaAcaraList(prev => prev.map(item => item.id === id ? merged : item));
    if (!localStorage.getItem('authToken')) return;

    api.request<unknown>(`/data/berita-acara/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ payload: merged }),
    }).then(saved => {
      const persisted = unwrapDataEntity<BeritaAcara>(saved);
      setBeritaAcaraList(prev => prev.map(item => item.id === id ? persisted : item));
    }).catch(error => {
      setBeritaAcaraList(prev => prev.map(item => item.id === id ? current : item));
      toast.error(`Berita Acara gagal diperbarui di database: ${error.message}`);
    });
  };
  const deleteBeritaAcara = (id: string) => {
    const removed = beritaAcaraList.find(item => item.id === id);
    setBeritaAcaraList(prev => prev.filter(item => item.id !== id));
    if (!localStorage.getItem('authToken')) return;

    api.request(`/data/berita-acara/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .catch(error => {
        if (removed) setBeritaAcaraList(prev => [...prev, removed]);
        toast.error(`Berita Acara gagal dihapus dari database: ${error.message}`);
      });
  };
  
  const addQuotation = async (q: Quotation): Promise<Quotation> => {
    setQuotationList(prev => [...prev.filter(item => item.id !== q.id), q]);
    try {
      const saved = await api.request<Quotation>('/quotations', {
        method: 'POST',
        body: JSON.stringify(q),
      });
      setQuotationList(prev => prev.map(item => item.id === saved.id ? saved : item));
      return saved;
    } catch (error) {
      setQuotationList(prev => prev.filter(item => item.id !== q.id));
      throw error;
    }
  };
  const updateQuotation = async (id: string, updates: Partial<Quotation>): Promise<Quotation | undefined> => {
    let previous: Quotation | undefined;
    setQuotationList(prev => {
      previous = prev.find(item => item.id === id);
      return prev.map(item => item.id === id ? { ...item, ...updates } : item);
    });
    try {
      const saved = await api.request<Quotation>(`/quotations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      setQuotationList(prev => prev.map(item => item.id === id ? saved : item));
      return saved;
    } catch (error) {
      if (previous) setQuotationList(prev => prev.map(item => item.id === id ? previous! : item));
      toast.error(`Quotation gagal diperbarui: ${error instanceof Error ? error.message : 'Kesalahan database'}`);
      return undefined;
    }
  };
  const deleteQuotation = (id: string) => {
    let removed: Quotation | undefined;
    setQuotationList(prev => {
      removed = prev.find(item => item.id === id);
      return prev.filter(item => item.id !== id);
    });
    api.request<void>(`/quotations/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .catch((error) => {
        if (removed) setQuotationList(prev => [...prev, removed!]);
        toast.error(`Quotation gagal dihapus: ${error.message}`);
      });
  };
  const addSuratJalan = (sj: SuratJalan) => {
    setSuratJalanList(prev => [...prev.filter(item => item.id !== sj.id), sj]);
    if (!localStorage.getItem('authToken')) return;

    api.request<unknown>('/data/surat-jalan', {
      method: 'POST',
      body: JSON.stringify({ entityId: sj.id, payload: sj }),
    }).then(saved => {
      const persisted = unwrapDataEntity<SuratJalan>(saved);
      setSuratJalanList(prev => prev.map(item => item.id === sj.id ? persisted : item));
    }).catch(error => {
      setSuratJalanList(prev => prev.filter(item => item.id !== sj.id));
      toast.error(`Surat Jalan gagal disimpan ke database: ${error.message}`);
    });
  };
  const createSuratJalanWithStockOut = async (sj: SuratJalan, stockOut?: StockOut) => {
    if (!localStorage.getItem('authToken')) {
      setSuratJalanList(prev => [...prev.filter(item => item.id !== sj.id), sj]);
      if (stockOut) setStockOutList(prev => [...prev.filter(item => item.id !== stockOut.id), stockOut]);
      return;
    }
    await api.request('/inventory/surat-jalan-issues', {
      method: 'POST',
      body: JSON.stringify({ suratJalan: sj, stockOut }),
    });
    await Promise.all([refreshCoreData(), refreshProcurementInventory()]);
  };
  const updateSuratJalan = (id: string, updates: Partial<SuratJalan>) => {
    const current = suratJalanList.find(item => item.id === id);
    if (!current) return;
    const merged = { ...current, ...updates };
    setSuratJalanList(prev => prev.map(item => item.id === id ? merged : item));
    if (!localStorage.getItem('authToken')) return;

    api.request<unknown>(`/data/surat-jalan/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ payload: merged }),
    }).then(saved => {
      const persisted = unwrapDataEntity<SuratJalan>(saved);
      setSuratJalanList(prev => prev.map(item => item.id === id ? persisted : item));
    }).catch(error => {
      setSuratJalanList(prev => prev.map(item => item.id === id ? current : item));
      toast.error(`Surat Jalan gagal diperbarui di database: ${error.message}`);
    });
  };
  const deleteSuratJalan = (id: string) => {
    const removed = suratJalanList.find(item => item.id === id);
    setSuratJalanList(prev => prev.filter(item => item.id !== id));
    if (!localStorage.getItem('authToken')) return;

    api.request(`/data/surat-jalan/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .catch(error => {
        if (removed) setSuratJalanList(prev => [...prev, removed]);
        toast.error(`Surat Jalan gagal dihapus dari database: ${error.message}`);
      });
  };
  const addAsset = (a: Asset) => {
    setAssetList(prev => [...prev, a]);
    if (!localStorage.getItem('authToken')) return;

    api.request<Asset>('/assets', { method: 'POST', body: JSON.stringify(a) })
      .then(saved => setAssetList(prev => prev.map(item => item.id === a.id ? saved : item)))
      .catch(error => {
        setAssetList(prev => prev.filter(item => item.id !== a.id));
        toast.error(`Asset gagal disimpan di database: ${error.message}`);
      });
  };
  const addMaintenance = (m: MaintenanceRecord) => {
    setMaintenanceList(prev => [m, ...prev]);
    addAuditLog({
      action: 'MAINTENANCE_LOGGED',
      module: 'Assets',
      details: `Recorded maintenance ${m.maintenanceNo} for unit ${m.equipmentName}`,
      status: 'Success'
    });
    if (!localStorage.getItem('authToken')) return;

    api.request<MaintenanceRecord>('/maintenances', { method: 'POST', body: JSON.stringify(m) })
      .then(saved => setMaintenanceList(prev => prev.map(item => item.id === m.id ? saved : item)))
      .catch(error => {
        setMaintenanceList(prev => prev.filter(item => item.id !== m.id));
        toast.error(`Maintenance gagal disimpan di database: ${error.message}`);
      });
  };
  const updateAsset = (id: string, updates: Partial<Asset>) => {
    const previous = assetList.find(item => item.id === id);
    if (!previous) return;
    const next = { ...previous, ...updates };
    setAssetList(prev => prev.map(item => item.id === id ? next : item));
    if (!localStorage.getItem('authToken')) return;

    api.request<Asset>(`/assets/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(updates) })
      .then(saved => setAssetList(prev => prev.map(item => item.id === id ? saved : item)))
      .catch(error => {
        setAssetList(prev => prev.map(item => item.id === id ? previous : item));
        toast.error(`Asset gagal diperbarui di database: ${error.message}`);
      });
  };
  const deleteAsset = (id: string) => {
    const previous = assetList.find(item => item.id === id);
    setAssetList(prev => prev.filter(item => item.id !== id));
    if (!localStorage.getItem('authToken')) return;

    api.request(`/assets/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .catch(error => {
        if (previous) setAssetList(prev => [...prev, previous]);
        toast.error(`Asset gagal dihapus dari database: ${error.message}`);
      });
  };

  const resolveInvoiceCustomerId = (invoice: Invoice) =>
    (invoice as Invoice & { customerId?: string }).customerId ||
    customerList.find((customer) =>
      customer.id === invoice.customer ||
      customer.namaCustomer === invoice.customer
    )?.id;

  const addInvoice = (inv: Invoice) => {
    setInvoiceList(prev => [...prev, inv]);
    if (!localStorage.getItem('authToken')) return;

    const customerId = resolveInvoiceCustomerId(inv);
    api.request<Invoice>('/invoices', {
      method: 'POST',
      body: JSON.stringify(toInvoiceApiPayload(inv, customerId)),
    }).then(saved => {
      setInvoiceList(prev => prev.map(item => item.id === inv.id ? saved : item));
    }).catch(error => {
      setInvoiceList(prev => prev.filter(item => item.id !== inv.id));
      console.error('Gagal menyimpan invoice', error);
      toast.error('Invoice gagal disimpan ke server');
    });
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    const current = invoiceList.find(invoice => invoice.id === id);
    if (!current) return;
    const merged = { ...current, ...updates };
    setInvoiceList(prev => prev.map(invoice => invoice.id === id ? merged : invoice));
    if (!localStorage.getItem('authToken')) return;

    const customerId = resolveInvoiceCustomerId(merged);
    api.request<Invoice>(`/invoices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(toInvoiceApiPayload(merged, customerId)),
    }).then(saved => {
      setInvoiceList(prev => prev.map(invoice => invoice.id === id ? saved : invoice));
    }).catch(error => {
      setInvoiceList(prev => prev.map(invoice => invoice.id === id ? current : invoice));
      console.error('Gagal memperbarui invoice', error);
      toast.error('Perubahan invoice gagal disimpan ke server');
    });
  };
  const createInvoiceWithAR = async (inv: Invoice): Promise<boolean> => {
    // Customer AR wajib mengacu ke master customer agar saldo piutang konsisten.
    const matchedCustomer = customerList.find(
      c => c.namaCustomer?.toLowerCase() === inv.customer?.toLowerCase()
    );
    const resolvedCustomerId = matchedCustomer?.id;
    if (!resolvedCustomerId) {
      toast.error('Pilih customer yang sudah terdaftar di Master Customer terlebih dahulu');
      return false;
    }
    // Resolve projectName from projectList
    const matchedProject = inv.projectId ? projectList.find(p => p.id === inv.projectId) : null;
    const arEntry: CustomerInvoice = {
      id: `AR-${inv.id}`,
      noInvoice: inv.noInvoice,
      tanggal: inv.tanggal,
      dueDate: inv.jatuhTempo,
      customerId: resolvedCustomerId,
      customerName: inv.customer,
      projectId: inv.projectId,
      projectName: matchedProject?.namaProject || undefined,
      perihal: inv.perihal || inv.items[0]?.deskripsi || 'Invoice',
      items: inv.items.map((it, idx) => ({
        id: `${inv.id}-item-${idx}`,
        deskripsi: it.deskripsi,
        qty: it.qty,
        satuan: it.unit,
        hargaSatuan: it.hargaSatuan,
        jumlah: it.total,
      })),
      subtotal: inv.subtotal,
      ppn: inv.ppn,
      pph: 0,
      totalNominal: inv.totalBayar,
      paidAmount: 0,
      outstandingAmount: inv.totalBayar,
      status: 'Pending',
      paymentHistory: [],
      noPO: inv.noPO,
      terminType: inv.terminType,
      terminLabel: inv.terminLabel,
      terminPercent: inv.terminPercent,
      termin: inv.terminLabel,
      quotationId: inv.quotationId,
      invoiceId: inv.id,
      createdBy: inv.createdBy || 'System',
      createdAt: inv.createdAt || new Date().toISOString(),
    };
    setInvoiceList(prev => [...prev, inv]);
    if (!localStorage.getItem('authToken')) {
      addCustomerInvoice(arEntry);
      toast.success('Invoice dibuat dan masuk ke Accounts Receivable');
      return true;
    }

    let invoiceCreated = false;
    try {
      const saved = await api.request<Invoice>('/invoices', {
        method: 'POST',
        body: JSON.stringify(toInvoiceApiPayload(inv, resolvedCustomerId)),
      });
      invoiceCreated = true;
      setInvoiceList(prev => prev.map(item => item.id === inv.id ? saved : item));
      const persistedAr = await api.request<CustomerInvoice>('/finance/customer-invoices', {
        method: 'POST',
        body: JSON.stringify(arEntry),
      });
      setCustomerInvoiceList(prev => [...prev.filter(item => item.id !== arEntry.id), persistedAr]);
      addAuditLog({
        action: 'Invoice Created',
        module: 'Finance',
        details: `Membuat invoice baru: ${arEntry.noInvoice} - ${arEntry.customerName} - Rp ${arEntry.totalNominal.toLocaleString('id-ID')}`,
        status: 'Success',
      });
      toast.success('Invoice dibuat dan masuk ke Accounts Receivable');
      return true;
    } catch (error) {
      // Invoice dan AR merupakan satu transaksi bisnis. Jangan sisakan invoice
      // tanpa piutang jika penyimpanan record AR gagal.
      if (invoiceCreated) {
        void api.request<void>(`/invoices/${encodeURIComponent(inv.id)}`, { method: 'DELETE' });
      }
      setInvoiceList(prev => prev.filter(item => item.id !== inv.id));
      setCustomerInvoiceList(prev => prev.filter(item => item.id !== arEntry.id));
      console.error('Gagal membuat invoice dan AR', error);
      toast.error('Invoice gagal disimpan lengkap ke Accounts Receivable');
      return false;
    }
  };
  const updatePO = (id: string, updates: Partial<any>) => {
    const current = poList.find(po => po.id === id);
    if (!current) return;
    const next = { ...current, ...updates };
    setPoList(prev => prev.map(po => po.id === id ? next : po));
    api.request<PurchaseOrder>(`/purchase-orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(next),
    }).then(saved => {
      setPoList(prev => prev.map(po => po.id === id ? saved : po));
    }).catch(error => {
      setPoList(prev => prev.map(po => po.id === id ? current : po));
      toast.error(`PO gagal diperbarui di database: ${error.message}`);
    });
  };
  const approveProject = (id: string, ownerName: string) => {
    const current = projectList.find(project => project.id === id);
    if (!current) return;

    const approvedAt = new Date().toISOString();
    const optimistic = { ...current, approvalStatus: 'Approved' as const, approvedBy: ownerName, approvedAt };
    setProjectList(prev => prev.map(project => project.id === id ? optimistic : project));

    if (!localStorage.getItem('authToken')) return;

    api.request<Project>(`/projects/${encodeURIComponent(id)}/approval`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'APPROVE' }),
    }).then(saved => {
      setProjectList(prev => prev.map(project => project.id === id ? saved : project));
    }).catch(error => {
      setProjectList(prev => prev.map(project => project.id === id ? current : project));
      toast.error(`Approval project gagal disimpan: ${error.message}`);
    });
  };
  const updateMaterialRequest = (id: string, updates: Partial<MaterialRequest>) => setMaterialRequestList(prev => prev.map(mr => mr.id === id ? { ...mr, ...updates } : mr));
  const issueMaterialRequest = (id: string, issuedBy: string) => setMaterialRequestList(prev => prev.map(mr => mr.id === id ? { ...mr, status: 'Issued' } : mr));
  const addDataCollection = (dc: DataCollection) => {
    setDataCollectionList(prev => [...prev.filter(item => item.id !== dc.id), dc]);
    api.request<DataCollection>('/data-collections', {
      method: 'POST',
      body: JSON.stringify(dc),
    }).then((saved) => {
      setDataCollectionList(prev => prev.map(item => item.id === saved.id ? saved : item));
    }).catch((error) => {
      setDataCollectionList(prev => prev.filter(item => item.id !== dc.id));
      toast.error(`Data Collection gagal disimpan: ${error.message}`);
    });
  };
  const updateDataCollection = (id: string, updates: Partial<DataCollection>) => {
    let previous: DataCollection | undefined;
    setDataCollectionList(prev => {
      previous = prev.find(item => item.id === id);
      return prev.map(item => item.id === id ? { ...item, ...updates } : item);
    });
    api.request<DataCollection>(`/data-collections/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }).then((saved) => {
      setDataCollectionList(prev => prev.map(item => item.id === id ? saved : item));
    }).catch((error) => {
      if (previous) setDataCollectionList(prev => prev.map(item => item.id === id ? previous! : item));
      toast.error(`Data Collection gagal diperbarui: ${error.message}`);
    });
  };
  const deleteDataCollection = (id: string) => {
    let removed: DataCollection | undefined;
    setDataCollectionList(prev => {
      removed = prev.find(item => item.id === id);
      return prev.filter(item => item.id !== id);
    });
    api.request<void>(`/data-collections/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .catch((error) => {
        if (removed) setDataCollectionList(prev => [...prev, removed!]);
        toast.error(`Data Collection gagal dihapus: ${error.message}`);
      });
  };
  const addProject = async (project: Project): Promise<Project | undefined> => {
    setProjectList(prev => [...prev.filter(item => item.id !== project.id), project]);
    if (!localStorage.getItem('authToken')) return project;

    try {
      // approvalStatus is controlled by the dedicated approval endpoint;
      // sending it in POST /projects is rejected by the backend.
      const { approvalStatus, ...projectPayload } = project as Project & { approvalStatus?: string };
      const saved = await api.request<Project>('/projects', {
        method: 'POST',
        body: JSON.stringify(projectPayload),
      });
      let finalProject = saved;
      if (approvalStatus === 'Approved') {
        finalProject = await api.request<Project>(`/projects/${encodeURIComponent(saved.id)}/approval`, {
          method: 'PATCH',
          body: JSON.stringify({ action: 'APPROVE' }),
        });
      }
      setProjectList(prev => prev.map(item => item.id === project.id ? finalProject : item));
      return finalProject;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('sudah dipakai oleh project lain')) {
        try {
          const remoteProjects = await api.request<Project[]>('/projects');
          const linked = remoteProjects.find(item => item.quotationId === project.quotationId);
          if (linked) {
            setProjectList(prev => [...prev.filter(item => item.id !== linked.id), linked]);
            toast.info(`Quotation sudah terhubung ke Project ${linked.kodeProject || linked.id}.`);
            return linked;
          }
        } catch {
          // Fall through to the normal error notification below.
        }
      }
      setProjectList(prev => prev.filter(item => item.id !== project.id));
      toast.error(`Project gagal disimpan ke database: ${message || 'Kesalahan database'}`);
      return undefined;
    }
  };
  const deleteProject = (id: string) => {
    const current = projectList.find(project => project.id === id);
    setProjectList(prev => prev.filter(project => project.id !== id));
    if (!localStorage.getItem('authToken')) return;

    api.request<void>(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
      .catch(error => {
        if (current) setProjectList(prev => [...prev, current]);
        toast.error(`Project gagal dihapus dari database: ${error.message}`);
      });
  };
  const addVendorInvoice = (inv: VendorInvoice) => {
    setVendorInvoiceList(prev => [...prev.filter(item => item.id !== inv.id), inv]);
    if (localStorage.getItem('authToken')) {
      api.request<VendorInvoice>('/finance/vendor-invoices', {
        method: 'POST', body: JSON.stringify(inv),
      }).then(saved => {
        setVendorInvoiceList(prev => prev.map(item => item.id === inv.id ? saved : item));
      }).catch(error => {
        setVendorInvoiceList(prev => prev.filter(item => item.id !== inv.id));
        toast.error(`Invoice vendor gagal disimpan ke database: ${error.message}`);
      });
    }
  };
  const updateVendorInvoice = (id: string, updates: Partial<VendorInvoice>) => {
    const current = vendorInvoiceList.find(inv => inv.id === id);
    const merged = current ? { ...current, ...updates } : null;
    setVendorInvoiceList(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv));
    if (merged && localStorage.getItem('authToken')) {
      api.request<VendorInvoice>(`/finance/vendor-invoices/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify(merged),
      }).catch(error => {
        if (current) setVendorInvoiceList(prev => prev.map(inv => inv.id === id ? current : inv));
        toast.error(`Hutang vendor gagal disimpan ke database: ${error.message}`);
      });
    }
  };

  // Pembayaran AP harus lewat endpoint payment server: validasi nominal,
  // update saldo, payment history, dan record rekonsiliasi bank terjadi
  // atomik dalam satu transaksi PostgreSQL.
  const payVendorInvoice = async (id: string, payment: { tanggal: string; nominal: number; metodeBayar?: string; noBukti?: string; bank?: string; noRekening?: string; keterangan?: string }): Promise<VendorInvoice> => {
    const current = vendorInvoiceList.find(inv => inv.id === id);
    if (!current) throw new Error('Invoice vendor tidak ditemukan');
    const saved = await api.request<VendorInvoice>(`/finance/vendor-invoices/${encodeURIComponent(id)}/payments`, {
      method: 'POST',
      body: JSON.stringify(payment),
    });
    setVendorInvoiceList(prev => prev.map(inv => inv.id === id ? { ...inv, ...saved } : inv));
    return saved;
  };
  const generatePayroll = (month: string, year: string) => {
    addPayroll({ id: `PAY-${Date.now()}`, month, year: parseInt(year), totalPayroll: 0, status: 'Pending', employeeCount: 0 });
  };
  const addSuratMasuk = (surat: SuratMasuk) => {
    setSuratMasukList(prev => [...prev, surat]);
    if (!localStorage.getItem('authToken')) return;
    api.request<SuratMasuk>('/surat-masuk', { method: 'POST', body: JSON.stringify(surat) })
      .then(saved => setSuratMasukList(prev => prev.map(item => item.id === surat.id ? saved : item)))
      .catch(error => {
        setSuratMasukList(prev => prev.filter(item => item.id !== surat.id));
        toast.error(`Surat masuk gagal disimpan: ${error.message}`);
      });
  };
  const updateSuratMasuk = (id: string, updates: Partial<SuratMasuk>) => {
    const current = suratMasukList.find(item => item.id === id);
    if (!current) return;
    const merged = { ...current, ...updates };
    setSuratMasukList(prev => prev.map(item => item.id === id ? merged : item));
    if (!localStorage.getItem('authToken')) return;
    api.request<SuratMasuk>(`/surat-masuk/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(merged) })
      .then(saved => setSuratMasukList(prev => prev.map(item => item.id === id ? saved : item)))
      .catch(error => {
        setSuratMasukList(prev => prev.map(item => item.id === id ? current : item));
        toast.error(`Surat masuk gagal diperbarui: ${error.message}`);
      });
  };
  const deleteSuratMasuk = (id: string) => {
    const removed = suratMasukList.find(item => item.id === id);
    setSuratMasukList(prev => prev.filter(item => item.id !== id));
    if (!localStorage.getItem('authToken')) return;
    api.request(`/surat-masuk/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(error => {
      if (removed) setSuratMasukList(prev => [...prev, removed]);
      toast.error(`Surat masuk gagal dihapus: ${error.message}`);
    });
  };
  const addSuratKeluar = (surat: SuratKeluar) => {
    setSuratKeluarList(prev => [...prev, surat]);
    if (!localStorage.getItem('authToken')) return;
    api.request<SuratKeluar>('/surat-keluar', { method: 'POST', body: JSON.stringify(surat) })
      .then(saved => setSuratKeluarList(prev => prev.map(item => item.id === surat.id ? saved : item)))
      .catch(error => {
        setSuratKeluarList(prev => prev.filter(item => item.id !== surat.id));
        toast.error(`Surat keluar gagal disimpan: ${error.message}`);
      });
  };
  const updateSuratKeluar = (id: string, updates: Partial<SuratKeluar>) => {
    const current = suratKeluarList.find(item => item.id === id);
    if (!current) return;
    const merged = { ...current, ...updates };
    setSuratKeluarList(prev => prev.map(item => item.id === id ? merged : item));
    if (!localStorage.getItem('authToken')) return;
    api.request<SuratKeluar>(`/surat-keluar/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(merged) })
      .then(saved => setSuratKeluarList(prev => prev.map(item => item.id === id ? saved : item)))
      .catch(error => {
        setSuratKeluarList(prev => prev.map(item => item.id === id ? current : item));
        toast.error(`Surat keluar gagal diperbarui: ${error.message}`);
      });
  };
  const deleteSuratKeluar = (id: string) => {
    const removed = suratKeluarList.find(item => item.id === id);
    setSuratKeluarList(prev => prev.filter(item => item.id !== id));
    if (!localStorage.getItem('authToken')) return;
    api.request(`/surat-keluar/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(error => {
      if (removed) setSuratKeluarList(prev => [...prev, removed]);
      toast.error(`Surat keluar gagal dihapus: ${error.message}`);
    });
  };

  const addEquipmentUsage = (usage: EquipmentUsage) => {
    setProjectList(prev => prev.map(p => {
      if (p.id === usage.projectId) {
        return { ...p, equipmentUsage: [...(p.equipmentUsage || []), usage] };
      }
      return p;
    }));
    addAuditLog({
      action: 'EQUIPMENT_USAGE_LOG',
      module: 'Operations',
      details: `Logged ${usage.hoursUsed}h for ${usage.equipmentName} on project ${usage.projectId}`,
      status: 'Success'
    });
  };

  const addMaterialRequest = (request: MaterialRequest) => {
    // Sync both global list and project internal list
    setMaterialRequestList(prev => [...prev, request]);
    setProjectList(prev => prev.map(p => {
      if (p.id === request.projectId) {
        return { ...p, materialRequests: [...(p.materialRequests || []), request] };
      }
      return p;
    }));
    addAuditLog({
      action: 'MATERIAL_REQUEST_SUBMITTED',
      module: 'Procurement',
      details: `Requested ${request.quantity} ${request.unit} of ${request.itemName} for project ${request.projectId}`,
      status: 'Success'
    });
  };

  const updateMaterialRequestStatus = (projectId: string, requestId: string, status: MaterialRequest['status']) => {
    // Sync both global list and project internal list
    setMaterialRequestList(prev => prev.map(r => r.id === requestId ? { ...r, status } : r));
    setProjectList(prev => prev.map(p => {
      if (p.id === projectId) {
        const updatedRequests = (p.materialRequests || []).map(r => 
          r.id === requestId ? { ...r, status } : r
        );
        return { ...p, materialRequests: updatedRequests };
      }
      return p;
    }));
  };

  const addStockIn = (si: StockIn) => createStockIn(si);
  const addStockOut = (so: StockOut) => createStockOut(so);
  const recordProduction = async (woId: string, qty: number) => handleProductionOutput(woId, qty, currentUser?.fullName || 'System');

  const convertDataCollectionToQuotation = (dcId: string) => {
    const dc = dataCollectionList.find(d => d.id === dcId);
    if (!dc) return;

    const newQuo: Quotation = {
      id: `QUO-${Date.now()}`,
      nomorQuotation: `QUO/GTP/${new Date().getFullYear()}/${(quotationList.length + 1).toString().padStart(3, '0')}`,
      tanggal: new Date().toISOString().split('T')[0],
      customer: {
        nama: dc.namaResponden,
        alamat: dc.lokasi,
      },
      perihal: dc.tipePekerjaan,
      grandTotal: 0, // Needs calculation in UI
      status: 'Draft',
      materials: dc.materials?.map(m => ({ ...m, unitPrice: 0, total: 0 })),
      manpower: dc.manpower?.map(m => ({ ...m, unitPrice: 0, total: 0 })),
      equipment: dc.equipment?.map(e => ({ ...e, unitPrice: 0, total: 0 })),
      dataCollectionId: dc.id,
      type: dc.jenisKontrak === 'Project' ? 'Project' : 'Direct'
    };

    addQuotation(newQuo);
    updateDataCollection(dcId, { status: 'Completed' });
    toast.success("Survey data converted to Quotation Draft successfully!");
  };

  const convertQuotationToProject = async (quoId: string) => {
    const quo = quotationList.find(q => q.id === quoId);
    if (!quo) return;

    // Avoid posting the same quotation twice when the user reopens the
    // approval page or double-clicks the conversion CTA.
    let existingProject = projectList.find(project => project.quotationId === quoId);
    // Refresh the authoritative list because this page can be opened with a
    // stale in-memory project list after a previous conversion.
    if (!existingProject && localStorage.getItem('authToken')) {
      try {
        const remoteProjects = await api.request<Project[]>('/projects');
        existingProject = remoteProjects.find(project => project.quotationId === quoId);
        if (existingProject) setProjectList(prev => [...prev.filter(p => p.id !== existingProject!.id), existingProject!]);
      } catch {
        // The normal create path below will surface any API error.
      }
    }
    if (existingProject) {
      toast.info(`Quotation sudah dikonversi ke Project ${existingProject.kodeProject || existingProject.id}.`);
      return existingProject;
    }

    if (!quo.grandTotal || quo.grandTotal === 0) {
      toast.error("Grand Total masih Rp 0. Isi harga di Quotation sebelum konversi ke Project.");
      return;
    }

    // Build descriptive project name: "Perihal — Customer"
    const customerName = quo.customer?.nama || quo.kepada || 'N/A';
    const namaProject = quo.perihal
      ? `${quo.perihal} — ${customerName}`
      : customerName;

    // BOQ: merge materials + manpower + equipment
    const boqMaterials = (quo.materials || []).map((m: any) => ({
      materialName: m.materialName || m.keterangan || m.description || '-',
      itemKode: m.itemKode || m.id || `M-${Date.now()}`,
      category: 'Material',
      qtyEstimate: m.qty || m.qtyEstimate || m.jumlah || 0,
      qtyActual: 0,
      unit: m.unit || m.satuan || 'pcs',
      unitPrice: m.unitPrice || m.hargaUnit || 0,
    }));

    const boqManpower = (quo.manpower || []).map((m: any, i: number) => ({
      materialName: m.position || m.keterangan || m.materialName || `Manpower ${i + 1}`,
      itemKode: m.id || `MP-${i + 1}`,
      category: 'Manpower',
      qtyEstimate: m.quantity || m.qty || m.jumlah || 0,
      qtyActual: 0,
      unit: m.unit || 'Orang',
      unitPrice: m.unitPrice || m.hargaUnit || 0,
    }));

    const boqEquipment = (quo.equipment || []).map((e: any, i: number) => ({
      materialName: e.equipmentName || e.keterangan || e.materialName || `Equipment ${i + 1}`,
      itemKode: e.id || `EQ-${i + 1}`,
      category: 'Equipment',
      qtyEstimate: e.quantity || e.qty || e.jumlah || 0,
      qtyActual: 0,
      unit: e.unit || 'Unit',
      unitPrice: e.unitPrice || e.hargaUnit || 0,
    }));

    const boqSections = (quo.sections || []).flatMap((section: any, sectionIndex: number) =>
      (section.items || []).map((item: any, itemIndex: number) => ({
        materialName: item.keterangan || item.description || `Item ${itemIndex + 1}`,
        itemKode: item.id || `Q-${sectionIndex + 1}-${itemIndex + 1}`,
        category: section.nama || section.label || section.title || 'Quotation',
        qtyEstimate: item.qty || item.jumlah || 0,
        qtyActual: 0,
        unit: item.satuan || item.unit || 'Unit',
        unitPrice: item.hargaUnit || item.costPerUnit || 0,
      })),
    );

    const newProj: Project = {
      id: `PRJ-${Date.now()}`,
      kodeProject: `GTP-PRJ-${new Date().getFullYear()}-${(projectList.length + 1).toString().padStart(3, '0')}`,
      namaProject,
      customer: customerName,
      nilaiKontrak: quo.grandTotal,
      status: 'Planning',
      approvalStatus: 'Approved',
      progress: 0,
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      quotationId: quo.id,
      boq: boqSections.length > 0 ? boqSections : [...boqMaterials, ...boqManpower, ...boqEquipment],
      materialRequests: [],
      workingExpenses: [],
      fieldAttendance: []
    };

    // PATCH quotation with convertedToProject=true makes the backend create
    // the linked project atomically. Do not POST the project a second time:
    // that would trigger the duplicate-quotation constraint.
    const approvedQuotation = await updateQuotation(quoId, { status: 'Approved', convertedToProject: true });
    if (!approvedQuotation) return;
    try {
      const remoteProjects = await api.request<Project[]>('/projects');
      const savedProject = remoteProjects.find(project => project.quotationId === quoId);
      if (savedProject) {
        setProjectList(prev => [...prev.filter(project => project.id !== savedProject.id), savedProject]);
      }
    } catch {
      // The quotation update already succeeded; project list can refresh later.
    }
    // Quotation tetap Approved setelah dikonversi; progres/penyelesaian
    // dikelola pada Project sampai pekerjaan dan QC benar-benar selesai.
    toast.success("Quotation converted to Active Project successfully!");
  };

  const applyTemplate = (templateId: string, variables: Record<string, string>) => {
    const template = templateSuratList.find(t => t.id === templateId);
    if (!template) return "";
    let content = template.content;
    Object.entries(variables).forEach(([key, val]) => {
      content = content.replace(`{{${key}}}`, val);
    });
    return content;
  };

  const updateReservedStock = (materials: any[], type: 'reserve' | 'release') => {
    setStockItemList(prev => prev.map(item => {
      const mat = materials.find(m => m.kode === item.kode);
      if (mat) {
        return { ...item, stok: type === 'reserve' ? item.stok - mat.qty : item.stok + mat.qty };
      }
      return item;
    }));
  };

  const refreshAll = () => {
    if (!DEMO_MODE_ENABLED) return;

    if (auditLogs.length === 0) setAuditLogs(seedAuditLogs as any);
    if (userList.length === 0) {
      setUserList([
        { id: '1', username: 'admin', fullName: 'Administrator', role: 'Admin', status: 'Active', password: '' },
        { id: '2', username: 'owner', fullName: 'Owner / Direktur', role: 'Owner', status: 'Active', password: '', department: 'Direksi' },
        { id: '3', username: 'finance', fullName: 'Finance Manager', role: 'Finance & Accounting', status: 'Active', password: '', department: 'Finance & Accounting' },
        { id: '4', username: 'sales', fullName: 'Sales Manager', role: 'Sales & Marketing', status: 'Active', password: '', department: 'Sales & Marketing' },
        { id: '5', username: 'ops', fullName: 'Operasional Manager', role: 'Operasional & Produksi', status: 'Active', password: '', department: 'Operasional & Produksi' },
        { id: '6', username: 'hrd', fullName: 'HRD Manager', role: 'HR', status: 'Active', password: '', department: 'HR' },
        { id: '7', username: 'hse', fullName: 'HSE Officer', role: 'HSE', status: 'Active', password: '', department: 'HSE' },
      ]);
    }
    if (projectList.length === 0) setProjectList(seedRefreshProjects as any);
    if (quotationList.length === 0 || !quotationList.some(q => q.id === 'QO-2026-002')) setQuotationList(seedRefreshQuotations as any);
    if (workOrderList.length === 0) {
      setWorkOrderList([{ id: 'WO-001', woNumber: 'SPK/GTP/2026/001', projectId: 'PRJ-2026-001', projectName: 'Pembangunan Gudang Logistik B', itemToProduce: 'Pondasi Struktur Utama', targetQty: 100, completedQty: 45, status: 'In Progress', priority: 'Urgent', deadline: '2026-03-30', leadTechnician: 'DEDE IRWAN' }] as any);
    }
    if (stockItemList.length === 0) {
      setStockItemList([
        { id: 'ST-001', kode: 'MTL-001', nama: 'Semen Tiga Roda 50kg', stok: 500, satuan: 'Sack', kategori: 'Material', minStock: 50, hargaSatuan: 65000, lokasi: 'Gudang Utama' },
        { id: 'ST-002', kode: 'MTL-002', nama: 'Baja WF 200', stok: 24, satuan: 'Batang', kategori: 'Besi/Baja', minStock: 5, hargaSatuan: 4500000, lokasi: 'Area Terbuka' },
        { id: 'ST-003', kode: 'TL-001', nama: 'Mesin Las Lincoln', stok: 2, satuan: 'Unit', kategori: 'Tools', minStock: 1, hargaSatuan: 12000000, lokasi: 'Tool Room' },
      ] as any);
    }
    // Generate opening balance movements for any stock item that has no movement history yet
    if (stockMovementList.length === 0 && stockItemList.length > 0) {
      setStockMovementList(stockItemList.map((item, i) => ({
        id: `MOV-OB-${item.id || i}`,
        tanggal: '2026-01-01',
        type: 'IN' as const,
        refNo: 'OB-2026',
        refType: 'Opening Balance',
        itemKode: item.kode,
        itemNama: item.nama,
        qty: item.stok,
        unit: item.satuan,
        lokasi: item.lokasi || 'Gudang Utama',
        stockBefore: 0,
        stockAfter: item.stok,
        createdBy: 'System',
      })));
    }
    if (archiveRegistry.length === 0) {
      setArchiveRegistry([{ id: 'REC-001', date: '2025-11-14', ref: 'INV/GTP/2025/11/001', description: 'Pembayaran Vendor Baja Utama', amount: 125000000, project: 'Warehouse Cikande', admin: 'Aris S.', type: 'AP', source: 'Finance' }] as any);
    }
    if (employeeList.length === 0) {
      setEmployeeList(seedRefreshEmployees as any);
      // Keep demo compensation rows local. They are fixtures, not transactional
      // records, and must never be auto-posted to a real/empty backend.
      setEmployeeCompensationsState(seedEmployeeCompensations as any);
    }
    if (!attendanceList.some(a => a.date.startsWith('2026-08'))) {
      setAttendanceList(prev => [...prev, ...(seedAttendanceAug2026 as any)]);
    }
  };

  const resetAllData = () => {
    if (!DEMO_MODE_ENABLED) {
      toast.error('Reset data demo hanya tersedia pada mode demo.');
      return;
    }

    setProjectList([]);
    setInvoiceList([]);
    setStockItemList([]);
    setEmployeeList([]);
    setAttendanceList([]);
    setArchiveRegistry([]);
    refreshAll();
  };

  // Vendor Management Functions
  const addVendor = (vendor: Vendor) => {
    setVendorList(prev => [...prev.filter(item => item.id !== vendor.id), vendor]);
    if (localStorage.getItem('authToken')) {
      api.request<unknown>('/data/vendors', {
        method: 'POST',
        body: JSON.stringify({ entityId: vendor.id, payload: vendor }),
      }).then(saved => {
        const normalized = unwrapDataEntity<Vendor>(saved);
        setVendorList(prev => prev.map(item => item.id === vendor.id ? normalized : item));
      }).catch(error => {
        setVendorList(prev => prev.filter(item => item.id !== vendor.id));
        toast.error(`Vendor gagal disimpan ke database: ${error.message}`);
      });
    }
    toast.success(`Vendor ${vendor.namaVendor} berhasil ditambahkan!`);
    addAuditLog({
      action: 'Vendor Added',
      module: 'Finance',
      details: `Menambahkan vendor baru: ${vendor.namaVendor}`,
      status: 'Success'
    });
  };

  const updateVendor = (id: string, updates: Partial<Vendor>) => {
    const current = vendorList.find(vendor => vendor.id === id);
    if (!current) return;
    const merged = { ...current, ...updates };
    setVendorList(prev => prev.map(vendor => vendor.id === id ? merged : vendor));
    if (localStorage.getItem('authToken')) {
      api.request<unknown>(`/data/vendors/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ payload: merged }),
      }).then(saved => {
        const normalized = unwrapDataEntity<Vendor>(saved);
        setVendorList(prev => prev.map(vendor => vendor.id === id ? normalized : vendor));
      }).catch(error => {
        setVendorList(prev => prev.map(vendor => vendor.id === id ? current : vendor));
        toast.error(`Vendor gagal diperbarui di database: ${error.message}`);
      });
    }
    addAuditLog({
      action: 'Vendor Updated',
      module: 'Finance',
      details: `Update vendor: ${updates.namaVendor || id}`,
      status: 'Success'
    });
  };

  const deleteVendor = (id: string) => {
    const vendor = vendorList.find(v => v.id === id);
    setVendorList(prev => prev.filter(v => v.id !== id));
    if (localStorage.getItem('authToken')) {
      api.request<void>(`/data/vendors/${encodeURIComponent(id)}`, { method: 'DELETE' })
        .catch(error => {
          if (vendor) setVendorList(prev => [...prev, vendor]);
          toast.error(`Vendor gagal dihapus dari database: ${error.message}`);
        });
    }
    addAuditLog({
      action: 'Vendor Deleted',
      module: 'Finance',
      details: `Menghapus vendor: ${vendor?.namaVendor}`,
      status: 'Success'
    });
  };

  // Expense Management Functions
  const addExpense = (expense: VendorExpense) => {
    setExpenseList(prev => [...prev.filter(item => item.id !== expense.id), expense]);
    if (localStorage.getItem('authToken')) {
      api.request<VendorExpense>('/finance/vendor-expenses', {
        method: 'POST', body: JSON.stringify(expense),
      }).then(saved => {
        setExpenseList(prev => prev.map(item => item.id === expense.id ? saved : item));
      }).catch(error => {
        setExpenseList(prev => prev.filter(item => item.id !== expense.id));
        toast.error(`Tambahan biaya gagal disimpan ke database: ${error.message}`);
      });
    }
    addAuditLog({
      action: 'Expense Added',
      module: 'Finance',
      details: `Menambahkan expense baru: ${expense.noExpense} - ${expense.keterangan} (Rp ${expense.totalNominal.toLocaleString('id-ID')})`,
      status: 'Success'
    });
  };

  const updateExpense = (id: string, updates: Partial<VendorExpense>) => {
    const current = expenseList.find(e => e.id === id);
    const merged = current ? { ...current, ...updates } : null;
    setExpenseList(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    if (merged && localStorage.getItem('authToken')) {
      api.request<VendorExpense>(`/finance/vendor-expenses/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify(merged),
      }).then(saved => {
        setExpenseList(prev => prev.map(item => item.id === id ? saved : item));
      }).catch(error => {
        if (current) setExpenseList(prev => prev.map(item => item.id === id ? current : item));
        toast.error(`Tambahan biaya gagal disimpan ke database: ${error.message}`);
      });
    }
  };

  const deleteExpense = (id: string) => {
    const expense = expenseList.find(e => e.id === id);
    setExpenseList(prev => prev.filter(e => e.id !== id));
    if (localStorage.getItem('authToken')) {
      api.request<void>(`/finance/vendor-expenses/${encodeURIComponent(id)}`, { method: 'DELETE' })
        .catch(error => {
          if (expense) setExpenseList(prev => [...prev, expense]);
          toast.error(`Tambahan biaya gagal dihapus dari database: ${error.message}`);
        });
    }
    addAuditLog({
      action: 'Expense Deleted',
      module: 'Finance',
      details: `Menghapus expense: ${expense?.noExpense}`,
      status: 'Success'
    });
  };

  const approveExpense = (id: string, approver: string) => {
    const current = expenseList.find(e => e.id === id);
    const approvedAt = new Date().toISOString();
    setExpenseList(prev => prev.map(e => 
      e.id === id 
        ? { ...e, status: 'Approved', approvedBy: approver, approvedAt }
        : e
    ));
    if (current && localStorage.getItem('authToken')) {
      api.request<VendorExpense>(`/finance/vendor-expenses/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify({ ...current, status: 'Approved', approvedBy: approver, approvedAt }),
      }).catch(error => {
        if (current) setExpenseList(prev => prev.map(e => e.id === id ? current : e));
        toast.error(`Approval biaya gagal disimpan ke database: ${error.message}`);
      });
    }
    const expense = expenseList.find(e => e.id === id);
    toast.success(`Expense ${expense?.noExpense} telah disetujui!`);
    addAuditLog({
      action: 'Expense Approved',
      module: 'Finance',
      details: `Menyetujui expense: ${expense?.noExpense} - Rp ${expense?.totalNominal.toLocaleString('id-ID')}`,
      status: 'Success'
    });
  };

  const rejectExpense = (id: string, reason: string) => {
    const current = expenseList.find(e => e.id === id);
    const rejectedBy = currentUser?.fullName || 'System';
    const rejectedAt = new Date().toISOString();
    setExpenseList(prev => prev.map(e => 
      e.id === id 
        ? { 
            ...e, 
            status: 'Rejected', 
            rejectedBy,
            rejectedAt,
            rejectReason: reason
          }
        : e
    ));
    if (current && localStorage.getItem('authToken')) {
      api.request<VendorExpense>(`/finance/vendor-expenses/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify({ ...current, status: 'Rejected', rejectedBy, rejectedAt, rejectReason: reason }),
      }).catch(error => {
        if (current) setExpenseList(prev => prev.map(e => e.id === id ? current : e));
        toast.error(`Penolakan biaya gagal disimpan ke database: ${error.message}`);
      });
    }
    const expense = expenseList.find(e => e.id === id);
    toast.error(`Expense ${expense?.noExpense} ditolak!`);
    addAuditLog({
      action: 'Expense Rejected',
      module: 'Finance',
      details: `Menolak expense: ${expense?.noExpense} - Alasan: ${reason}`,
      status: 'Warning'
    });
  };

  // Customer Management Functions
  const addCustomer = (customer: Customer) => {
    setCustomerList(prev => [...prev.filter(item => item.id !== customer.id), customer]);
    if (localStorage.getItem('authToken')) {
      api.request<unknown>('/data/customers', {
        method: 'POST',
        body: JSON.stringify({ entityId: customer.id, payload: customer }),
      }).then(saved => {
        const normalized = unwrapDataEntity<Customer>(saved);
        setCustomerList(prev => prev.map(item => item.id === customer.id ? normalized : item));
      }).catch(error => {
        setCustomerList(prev => prev.filter(item => item.id !== customer.id));
        toast.error(`Customer gagal disimpan ke database: ${error.message}`);
      });
    }
    toast.success(`Customer ${customer.namaCustomer} berhasil ditambahkan!`);
    addAuditLog({
      action: 'Customer Added',
      module: 'Finance',
      details: `Menambahkan customer baru: ${customer.namaCustomer}`,
      status: 'Success'
    });
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    const current = customerList.find(customer => customer.id === id);
    if (!current) return;
    const merged = { ...current, ...updates };
    setCustomerList(prev => prev.map(customer => customer.id === id ? merged : customer));
    if (localStorage.getItem('authToken')) {
      api.request<unknown>(`/data/customers/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ payload: merged }),
      }).then(saved => {
        const normalized = unwrapDataEntity<Customer>(saved);
        setCustomerList(prev => prev.map(customer => customer.id === id ? normalized : customer));
      }).catch(error => {
        setCustomerList(prev => prev.map(customer => customer.id === id ? current : customer));
        toast.error(`Customer gagal diperbarui di database: ${error.message}`);
      });
    }
    addAuditLog({
      action: 'Customer Updated',
      module: 'Finance',
      details: `Mengupdate data customer`,
      status: 'Success'
    });
  };

  const deleteCustomer = (id: string) => {
    const customer = customerList.find(c => c.id === id);
    setCustomerList(prev => prev.filter(c => c.id !== id));
    if (localStorage.getItem('authToken')) {
      api.request<void>(`/data/customers/${encodeURIComponent(id)}`, { method: 'DELETE' })
        .catch(error => {
          if (customer) setCustomerList(prev => [...prev, customer]);
          toast.error(`Customer gagal dihapus dari database: ${error.message}`);
        });
    }
    addAuditLog({
      action: 'Customer Deleted',
      module: 'Finance',
      details: `Menghapus customer: ${customer?.namaCustomer}`,
      status: 'Success'
    });
  };

  // Customer Invoice Management Functions
  const addCustomerInvoice = (invoice: CustomerInvoice) => {
    setCustomerInvoiceList(prev => [...prev.filter(item => item.id !== invoice.id), invoice]);
    if (localStorage.getItem('authToken')) {
      api.request<CustomerInvoice>('/finance/customer-invoices', {
        method: 'POST', body: JSON.stringify(invoice),
      }).then(saved => {
        setCustomerInvoiceList(prev => prev.map(item => item.id === invoice.id ? saved : item));
      }).catch(error => {
        setCustomerInvoiceList(prev => prev.filter(item => item.id !== invoice.id));
        toast.error(`Invoice customer gagal disimpan ke database: ${error.message}`);
      });
    }
    toast.success(`Invoice ${invoice.noInvoice} berhasil dibuat!`);
    addAuditLog({
      action: 'Invoice Created',
      module: 'Finance',
      details: `Membuat invoice baru: ${invoice.noInvoice} - ${invoice.customerName} - Rp ${invoice.totalNominal.toLocaleString('id-ID')}`,
      status: 'Success'
    });
  };

  const updateCustomerInvoice = (id: string, updates: Partial<CustomerInvoice>) => {
    const current = customerInvoiceList.find(inv => inv.id === id);
    const merged = current ? { ...current, ...updates } : null;
    setCustomerInvoiceList(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv));
    if (merged && localStorage.getItem('authToken')) {
      api.request<CustomerInvoice>(`/finance/customer-invoices/${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify(merged),
      }).then(saved => {
        setCustomerInvoiceList(prev => prev.map(item => item.id === id ? saved : item));
      }).catch(error => {
        if (current) setCustomerInvoiceList(prev => prev.map(item => item.id === id ? current : item));
        toast.error(`Invoice customer gagal disimpan ke database: ${error.message}`);
      });
    }
    const invoice = customerInvoiceList.find(inv => inv.id === id);
    if (updates.status === 'Pending') {
      addAuditLog({ action: 'Invoice Submitted', module: 'Finance', details: `Invoice ${invoice?.noInvoice} dikirim ke Approval Center`, status: 'Success' });
    }
    if (updates.status === 'Approved') {
      addAuditLog({ action: 'Invoice Approved', module: 'Finance', details: `Invoice ${invoice?.noInvoice} disetujui`, status: 'Success' });
    }
    if (updates.status === 'Rejected') {
      addAuditLog({ action: 'Invoice Rejected', module: 'Finance', details: `Invoice ${invoice?.noInvoice} ditolak: ${(updates as any).approvalHistory?.slice(-1)[0]?.reason || '-'}`, status: 'Warning' });
    }
    if (updates.status === 'Revision') {
      addAuditLog({ action: 'Invoice Revision', module: 'Finance', details: `Invoice ${invoice?.noInvoice} perlu revisi: ${(updates as any).approvalHistory?.slice(-1)[0]?.reason || '-'}`, status: 'Warning' });
    }
  };

  const deleteCustomerInvoice = (id: string) => {
    const invoice = customerInvoiceList.find(inv => inv.id === id);
    setCustomerInvoiceList(prev => prev.filter(inv => inv.id !== id));
    if (localStorage.getItem('authToken')) {
      api.request<void>(`/finance/customer-invoices/${encodeURIComponent(id)}`, { method: 'DELETE' })
        .catch(error => {
          if (invoice) setCustomerInvoiceList(prev => [...prev, invoice]);
          toast.error(`Invoice customer gagal dihapus dari database: ${error.message}`);
        });
    }
    toast.success(`Invoice ${invoice?.noInvoice} berhasil dihapus!`);
    addAuditLog({
      action: 'Invoice Deleted',
      module: 'Finance',
      details: `Menghapus invoice: ${invoice?.noInvoice}`,
      status: 'Success'
    });
  };

  const approveCustomerInvoice = (id: string, approvedBy: string) => {
    const arInv = customerInvoiceList.find(inv => inv.id === id);
    if (!arInv) return;
    const approvedAt = new Date().toISOString();
    updateCustomerInvoice(id, {
      status: 'Approved' as const,
      approvedAt,
      approvedBy,
      approvalHistory: [
        ...(arInv.approvalHistory || []),
        { action: 'Approved' as const, by: approvedBy, date: approvedAt },
      ],
    } as Partial<CustomerInvoice>);
    // Advance linked Invoice from Draft → Unpaid so AR-aware pages pick it up
    if (arInv.invoiceId) {
      setInvoiceList(prev => prev.map(inv => inv.id === arInv.invoiceId && inv.status === 'Draft'
        ? { ...inv, status: 'Unpaid' as Invoice['status'] }
        : inv
      ));
    }
    toast.success(`Invoice ${arInv.noInvoice} disetujui & dikirim ke customer.`);
    addAuditLog({ action: 'Invoice Approved', module: 'Finance', details: `Approve invoice ${arInv.noInvoice}`, status: 'Success' });
  };

  const addInvoicePayment = async (invoiceId: string, payment: InvoicePayment) => {
    const linkedInvId = invoiceId.startsWith('AR-') ? invoiceId.slice(3) : invoiceId;
    const current = customerInvoiceList.find(inv =>
      inv.id === invoiceId || inv.id === linkedInvId || (inv as any).invoiceId === linkedInvId,
    );
    if (!current) {
      toast.error('Invoice AR tidak ditemukan. Pembayaran tidak dapat dicatat.');
      return false;
    }

    if (!Number.isFinite(payment.nominal) || payment.nominal <= 0) {
      toast.error('Nominal pembayaran harus lebih besar dari nol.');
      return false;
    }
    const outstandingBeforePayment = Math.max(0, current.totalNominal - current.paidAmount);
    if (payment.nominal > outstandingBeforePayment) {
      toast.error('Nominal pembayaran melebihi sisa tagihan invoice.');
      return false;
    }

    if (!localStorage.getItem('authToken')) {
      toast.error('Sesi login berakhir. Silakan login kembali sebelum mencatat pembayaran.');
      return false;
    }

    {
      try {
        const saved = await api.request<CustomerInvoice>(`/finance/customer-invoices/${encodeURIComponent(current.id)}/payments`, {
          method: 'POST', body: JSON.stringify(payment),
        });
        setCustomerInvoiceList(prev => prev.map(inv => inv.id === current.id ? saved : inv));
        setInvoiceList(prev => prev.map(inv => inv.id === linkedInvId || inv.noInvoice === current.noInvoice
          ? { ...inv, paidAmount: saved.paidAmount, status: saved.status === 'Paid' ? 'Paid' : 'Partial' } : inv));
      } catch (error) {
        toast.error(`Pembayaran gagal disimpan ke database: ${error instanceof Error ? error.message : 'Terjadi kesalahan'}`);
        return false;
      }
    }

    toast.success(`Pembayaran Rp ${payment.nominal.toLocaleString('id-ID')} berhasil dicatat!`);
    void addAuditLog({
      action: 'Payment Received',
      module: 'Finance',
      details: `Menerima pembayaran invoice ${current.noInvoice} sebesar Rp ${payment.nominal.toLocaleString('id-ID')}`,
      status: 'Success'
    });
    return true;
  };

  // Stock Opname Functions
  const addStockOpname = (opname: StockOpname) => {
    setStockOpnameList(prev => [...prev, opname]);
    api.request<StockOpname>('/inventory/stock-opnames', { method: 'POST', body: JSON.stringify(opname) })
      .then(saved => {
        setStockOpnameList(prev => prev.map(item => item.id === opname.id ? saved : item));
        return refreshProcurementInventory();
      })
      .catch(error => {
        setStockOpnameList(prev => prev.filter(item => item.id !== opname.id));
        toast.error(`Stock Opname gagal disimpan ke database: ${error.message}`);
      });
    toast.success(`Stock Opname ${opname.noOpname} berhasil dibuat!`);
    addAuditLog({
      action: 'Stock Opname Created',
      module: 'Inventory',
      details: `Membuat stock opname: ${opname.noOpname} - ${opname.lokasi}`,
      status: 'Success'
    });
  };

  const confirmStockOpname = (id: string, confirmedBy: string) => {
    const opname = stockOpnameList.find(o => o.id === id);
    if (!opname) return;
    const previousItems = stockItemList;
    const completedAt = new Date().toISOString();
    setStockOpnameList(prev => prev.map(item => item.id === id ? {
      ...item, status: 'Completed' as const, confirmedBy, confirmedAt: completedAt,
    } : item));
    setStockItemList(prev => prev.map(stock => {
      const counted = opname.items.find(item => item.itemId === stock.id);
      return counted ? { ...stock, stok: counted.physicalQty, lastUpdate: completedAt } : stock;
    }));
    api.request<StockOpname>(`/inventory/stock-opnames/${encodeURIComponent(id)}/confirm`, {
      method: 'POST', body: JSON.stringify({ confirmedBy }),
    }).then(saved => {
      setStockOpnameList(prev => prev.map(item => item.id === id ? saved : item));
      return refreshProcurementInventory();
    }).catch(error => {
      setStockItemList(previousItems);
      setStockOpnameList(prev => prev.map(item => item.id === id ? opname : item));
      toast.error(`Konfirmasi Stock Opname gagal: ${error.message}`);
    });
    toast.success(`Stock Opname ${opname?.noOpname} dikonfirmasi!`);
    addAuditLog({
      action: 'Stock Opname Confirmed',
      module: 'Inventory',
      details: `Konfirmasi stock opname: ${opname?.noOpname}`,
      status: 'Success'
    });
  };

  const addTHL = (thl: THL) => {
    setThlList(prev => [...prev, thl]);
    upsertHrAlias('/hr-thl-contracts', thl);
  };
  const updateTHL = (id: string, updates: Partial<THL>) => setThlList(prev => prev.map(t => {
    if (t.id !== id) return t;
    const next = { ...t, ...updates };
    upsertHrAlias('/hr-thl-contracts', next);
    return next;
  }));
  const deleteTHL = (id: string) => {
    setThlList(prev => prev.filter(t => t.id !== id));
    void api.request(`/hr-thl-contracts/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  };

  const addResignation = (r: Resignation) => {
    setResignationList(prev => [...prev, r]);
    upsertHrAlias('/hr-resignations', r);
  };
  const updateResignation = (id: string, updates: Partial<Resignation>) => setResignationList(prev => prev.map(r => {
    if (r.id !== id) return r;
    const next = { ...r, ...updates };
    upsertHrAlias('/hr-resignations', next);
    return next;
  }));

  const addShift = (s: Shift) => {
    setShiftList(prev => [...prev, s]);
    upsertHrAlias('/hr-shifts', s);
  };
  const updateShift = (id: string, updates: Partial<Shift>) => setShiftList(prev => prev.map(s => {
    if (s.id !== id) return s;
    const next = { ...s, ...updates };
    upsertHrAlias('/hr-shifts', next);
    return next;
  }));
  const deleteShift = (id: string) => {
    setShiftList(prev => prev.filter(s => s.id !== id));
    void api.request(`/hr-shifts/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  };

  const addShiftSchedule = (s: ShiftSchedule) => {
    setShiftScheduleList(prev => [...prev, s]);
    upsertHrAlias('/hr-shift-schedules', s);
  };
  const deleteShiftSchedule = (id: string) => {
    setShiftScheduleList(prev => prev.filter(s => s.id !== id));
    void api.request(`/hr-shift-schedules/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  };

  // Kas Koperasi uses dedicated PostgreSQL tables. Local state is updated only
  // after the API confirms the write so the displayed balance cannot diverge.
  const addKoperasiMember = async (member: KoperasiMember) => {
    const saved = await api.request<KoperasiMember>('/koperasi/members', { method: 'POST', body: JSON.stringify(member) });
    setKoperasiMembers(prev => [...prev.filter(item => item.id !== saved.id), saved]);
    setKoperasiBalance(prev => prev + saved.simpananPokok);
    return saved;
  };
  const updateKoperasiMember = async (id: string, updates: Partial<KoperasiMember>) => {
    const saved = await api.request<KoperasiMember>(`/koperasi/members/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(updates) });
    setKoperasiMembers(prev => prev.map(member => member.id === id ? saved : member));
    return saved;
  };
  const addKoperasiSimpanan = async (simpanan: KoperasiSimpanan) => {
    const saved = await api.request<KoperasiSimpanan>('/koperasi/simpanan', { method: 'POST', body: JSON.stringify(simpanan) });
    setKoperasiSimpananList(prev => [...prev.filter(item => item.id !== saved.id), saved]);
    setKoperasiBalance(prev => prev + saved.amount);
    return saved;
  };
  const addKoperasiPinjaman = async (pinjaman: KoperasiPinjaman) => {
    const saved = await api.request<KoperasiPinjaman>('/koperasi/pinjaman', { method: 'POST', body: JSON.stringify(pinjaman) });
    setKoperasiPinjamanList(prev => [...prev.filter(item => item.id !== saved.id), saved]);
    return saved;
  };
  const approveKoperasiPinjaman = async (id: string) => {
    const saved = await api.request<KoperasiPinjaman>(`/koperasi/pinjaman/${encodeURIComponent(id)}/approve`, { method: 'POST' });
    setKoperasiPinjamanList(prev => prev.map(pinjaman => pinjaman.id === id ? saved : pinjaman));
    setKoperasiBalance(prev => prev - saved.amount);
    return saved;
  };
  const bayarKoperasiAngsuran = async (id: string) => {
    const current = koperasiPinjamanList.find(pinjaman => pinjaman.id === id);
    if (!current) throw new Error('Pinjaman tidak ditemukan; muat ulang halaman');
    const saved = await api.request<KoperasiPinjaman>(`/koperasi/pinjaman/${encodeURIComponent(id)}/installments`, {
      method: 'POST', body: JSON.stringify({ installmentNumber: current.paidInstallments + 1 }),
    });
    setKoperasiPinjamanList(prev => prev.map(pinjaman => pinjaman.id === id ? saved : pinjaman));
    // Replay responses must not increment the displayed balance twice.
    void api.request<{ balance: number }>('/koperasi/summary')
      .then(summary => setKoperasiBalance(summary.balance))
      .catch(() => undefined);
    return saved;
  };
  const topUpKoperasi = async (topUp: { id: string; date: string; amount: number; bankAccount: string; notes?: string }) => {
    const saved = await api.request<KoperasiCashTransaction>('/koperasi/top-ups', { method: 'POST', body: JSON.stringify(topUp) });
    setKoperasiTransactions(prev => [saved, ...prev.filter(item => item.id !== saved.id)]);
    setKoperasiBalance(prev => prev + saved.amount);
    return saved;
  };

  useEffect(() => {
    if (!localStorage.getItem('authToken')) return;
    let active = true;
    const syncKoperasi = () => api.request<{ members: KoperasiMember[]; simpanans: KoperasiSimpanan[]; pinjamans: KoperasiPinjaman[]; transactions: KoperasiCashTransaction[]; balance: number }>('/koperasi/summary')
      .then((summary) => {
        if (!active) return;
        setKoperasiMembers(summary.members);
        setKoperasiSimpananList(summary.simpanans);
        setKoperasiPinjamanList(summary.pinjamans);
        setKoperasiTransactions(summary.transactions);
        setKoperasiBalance(summary.balance);
      })
      .catch((error) => console.warn('[Kas Koperasi] Memakai cache lokal karena API belum tersedia:', error));
    syncKoperasi();
    const syncOnFocus = () => { syncKoperasi(); };
    window.addEventListener('focus', syncOnFocus);
    return () => { active = false; window.removeEventListener('focus', syncOnFocus); };
  }, []);

  useEffect(() => {
    refreshAll();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return (
    <AppContext.Provider
      value={{
        projectList,
        invoiceList,
        stockItemList,
        employeeList,
        koperasiMembers,
        addKoperasiMember,
        updateKoperasiMember,
        koperasiSimpananList,
        addKoperasiSimpanan,
        koperasiPinjamanList,
        addKoperasiPinjaman,
        approveKoperasiPinjaman,
        bayarKoperasiAngsuran,
        koperasiBalance,
        koperasiTransactions,
        topUpKoperasi,
        attendanceList,
        workOrderList,
        productionReportList,
        productionTrackerList,
        qcInspectionList,
        stockInList,
        stockOutList,
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
        addPayroll,
        workingExpenseSheets,
        addWorkingExpenseSheet,
        updateWorkingExpenseSheet,
        kasbonList,
        addKasbon,
        updateKasbon,
        deleteKasbon,
        kasbonTHLList,
        addKasbonTHL,
        updateKasbonTHL,
        deleteKasbonTHL,
        thlTimesheetList,
        addTHLTimesheet,
        updateTHLTimesheet,
        deleteTHLTimesheet,
        saveTHLTimesheetBatch,
        thlSettlementList,
        addTHLSettlement,
        deleteTHLSettlement,
        thlPayrollRunList,
        addTHLPayrollRun,
        updateTHLPayrollRun,
        deleteTHLPayrollRun,
        suratMasukList,
        suratKeluarList,
        beritaAcaraList,
        templateSuratList,
        archiveRegistry,
        auditLogs,
        vendorList,
        expenseList,
        currentUser,
        login,
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
        updateStockIn,
        createStockOut,
        addStockIn,
        addStockOut,
        addReceiving,
        addInvoice,
        updateInvoice,
        createInvoiceWithAR,
        addProductionReport,
        updateProductionReport,
        handleProductionOutput,
        updatePO,
        approveProject,
        updateMaterialRequest,
        issueMaterialRequest,
        addDataCollection,
        updateDataCollection,
        deleteDataCollection,
        addProject,
        createProjectSpkWithWorkOrder,
        deleteProject,
        addQuotation,
        updateQuotation,
        deleteQuotation,
        addVendorInvoice,
        updateVendorInvoice,
      payVendorInvoice,
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
        createSuratJalanWithStockOut,
        updateSuratJalan,
        deleteSuratJalan,
        addAsset,
        addMaintenance,
        updateAsset,
        deleteAsset,
        pettyCashList,
        addPettyCashEntry,
        topUpRequestList,
        addTopUpRequest,
        approveTopUpRequest,
        rejectTopUpRequest,
        pettyCashGudangList,
        addPettyCashGudangEntry,
        updatePettyCashGudangEntry,
        topUpGudangRequestList,
        addTopUpGudangRequest,
        approveTopUpGudangRequest,
        rejectTopUpGudangRequest,
        leaveList,
        overtimeList,
        addOvertime,
        updateOvertime,
        onlineEmployeeList,
        addUser,
      deleteUser,
        addPO,
        addLeave,
        updateLeave,
        penilaianKinerjaList,
        addPenilaian,
        updatePenilaian,
        deletePenilaian,
        addOnlineEmployee,
        updateOnlineEmployee,
        stockItems: stockItemList,
        addArchiveEntry,
        payrollRecords,
        addPayrollRecord,
        updatePayrollRecord,
        markEmployeePaid,
        addEquipmentUsage,
        addMaterialRequest,
        updateMaterialRequestStatus,
        convertDataCollectionToQuotation,
        convertQuotationToProject,
        applyTemplate,
        updateReservedStock,
        addStockItem,
        setStockItemList,
        setStockMovementList,
        setPoList,
        refreshAll,
        resetAllData,
        alerts,
        markAlertAsRead,
        addVendor,
        updateVendor,
        deleteVendor,
        addExpense,
        updateExpense,
        deleteExpense,
        approveExpense,
        rejectExpense,
        customerList,
        customerInvoiceList,
        stockOpnameList,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addCustomerInvoice,
        updateCustomerInvoice,
        deleteCustomerInvoice,
        approveCustomerInvoice,
        addInvoicePayment,
        addStockOpname,
        confirmStockOpname,
        thlList,
        addTHL,
        updateTHL,
        deleteTHL,
        resignationList,
        addResignation,
        updateResignation,
        shiftList,
        addShift,
        updateShift,
        deleteShift,
        shiftScheduleList,
        addShiftSchedule,
        deleteShiftSchedule,
        salaryHistoryList,
        addSalaryHistory,
        payrollPolicy: payrollPolicyState,
        setPayrollPolicy,
        employeeCompensations: employeeCompensationsState,
        setEmployeeCompensation,
        employeeAdvanceList,
        addEmployeeAdvance,
        updateEmployeeAdvance,
        payrollRunList,
        addPayrollRun,
        updatePayrollRun,
        disbursePayrollRun,
        deletePayrollRun,
        clearAllPayrollRuns,
        extraCategories,
        addExtraCategory,
        bankSaldoAwal,
        setBankSaldoAwal,
        bankManualEntryList,
        addBankManualEntry,
        deleteBankManualEntry,
        closedYearsList,
        addClosedYear,
        isYearClosed,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
