import type { DocStatus } from "./auth";

export interface QuotationSectionItem {
  id: string;
  keterangan: string;
  satuan: string;
  hargaUnit: number;
  jumlah: number;
  total: number;
}

export interface QuotationSection {
  id: string;
  label: string;
  title: string;
  items: QuotationSectionItem[];
  subtotal: number;
}

export interface Quotation {
  id: string;
  noPenawaran: string;
  revisi: string;
  tanggal: string;
  jenisQuotation: "Jasa" | "Material";
  kepada: string;
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
  dataCollectionId?: string;
  terminology?: "RAB" | "SOW";
  type?: "Direct" | "Project";
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

export type QuotationItem = QuotationSectionItem;
