import type { DocStatus } from "../types/auth";
import type { Quotation } from "../types/quotation";

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

export const normalizeQuotationStatus = (value: unknown): DocStatus => {
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

export const normalizeQuotationForUi = (input: unknown): Quotation => {
  const src =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, any>)
      : {};

  const id = typeof src.id === "string" && src.id.trim() ? src.id : uid("QUO");
  const noPenawaranRaw =
    typeof src.noPenawaran === "string" && src.noPenawaran.trim()
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
    createdBy: (typeof src.createdBy === "string" && src.createdBy.trim()) || "System",
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

export const normalizeQuotationForApi = (input: unknown): Record<string, unknown> => {
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
