import { sanitizeRichHtml } from "../utils/sanitizeRichHtml";

export function mapLogisticsSuratJalanToLegacyPayload(row: {
  id: string;
  noSurat: string;
  tanggal: Date;
  sjType: string;
  tujuan: string;
  alamat: string;
  upPerson: string | null;
  noPO: string | null;
  projectId: string | null;
  assetId: string | null;
  sopir: string | null;
  noPolisi: string | null;
  pengirim: string | null;
  deliveryStatus: string;
  podName: string | null;
  podTime: Date | null;
  podPhoto: string | null;
  podSignature: string | null;
  expectedReturnDate: Date | null;
  actualReturnDate: Date | null;
  returnStatus: string | null;
  workflowStatus: string;
  items: Array<{
    itemKode: string | null;
    namaItem: string;
    jumlah: number;
    satuan: string;
    batchNo: string | null;
    keterangan: string | null;
  }>;
}) {
  return {
    id: row.id,
    noSurat: row.noSurat,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    sjType: row.sjType,
    tujuan: row.tujuan,
    alamat: row.alamat,
    upPerson: row.upPerson ?? undefined,
    noPO: row.noPO ?? undefined,
    projectId: row.projectId ?? undefined,
    assetId: row.assetId ?? undefined,
    sopir: row.sopir ?? undefined,
    noPolisi: row.noPolisi ?? undefined,
    pengirim: row.pengirim ?? undefined,
    deliveryStatus: row.deliveryStatus,
    podName: row.podName ?? undefined,
    podTime: row.podTime ? row.podTime.toISOString() : undefined,
    podPhoto: row.podPhoto ?? undefined,
    podSignature: row.podSignature ?? undefined,
    expectedReturnDate: row.expectedReturnDate ? row.expectedReturnDate.toISOString().slice(0, 10) : undefined,
    actualReturnDate: row.actualReturnDate ? row.actualReturnDate.toISOString().slice(0, 10) : undefined,
    returnStatus: row.returnStatus ?? undefined,
    workflowStatus: row.workflowStatus,
    status: row.workflowStatus,
    items: row.items.map((item) => ({
      itemKode: item.itemKode ?? undefined,
      namaItem: item.namaItem,
      jumlah: item.jumlah,
      satuan: item.satuan,
      batchNo: item.batchNo ?? undefined,
      keterangan: item.keterangan ?? undefined,
    })),
  };
}

export function mapLogisticsProofOfDeliveryToLegacyPayload(row: {
  id: string;
  suratJalanId: string;
  projectId: string | null;
  workOrderId: string | null;
  status: string;
  receiverName: string;
  deliveredAt: Date;
  photo: string | null;
  signature: string | null;
  noSurat: string | null;
  tujuan: string | null;
  receiver: string | null;
  driver: string | null;
  plate: string | null;
  note: string | null;
  items: Array<{
    itemKode: string | null;
    namaItem: string;
    jumlah: number;
    satuan: string;
    batchNo: string | null;
    keterangan: string | null;
  }>;
}) {
  return {
    id: row.id,
    suratJalanId: row.suratJalanId,
    projectId: row.projectId ?? undefined,
    workOrderId: row.workOrderId ?? undefined,
    status: row.status,
    receiverName: row.receiverName,
    deliveredAt: row.deliveredAt.toISOString(),
    photo: row.photo ?? undefined,
    signature: row.signature ?? undefined,
    noSurat: row.noSurat ?? undefined,
    tujuan: row.tujuan ?? undefined,
    receiver: row.receiver ?? undefined,
    driver: row.driver ?? undefined,
    plate: row.plate ?? undefined,
    note: row.note ?? undefined,
    items: row.items.map((item) => ({
      itemKode: item.itemKode ?? undefined,
      namaItem: item.namaItem,
      jumlah: item.jumlah,
      satuan: item.satuan,
      batchNo: item.batchNo ?? undefined,
      keterangan: item.keterangan ?? undefined,
    })),
  };
}

export function mapProjectBeritaAcaraToLegacyPayload(row: {
  id: string;
  noBA: string;
  tanggal: Date;
  jenisBA: string;
  pihakPertama: string;
  pihakPertamaJabatan: string | null;
  pihakPertamaNama: string | null;
  pihakKedua: string;
  pihakKeduaJabatan: string | null;
  pihakKeduaNama: string | null;
  lokasi: string | null;
  contentHTML: string;
  refSuratJalan: string | null;
  refProject: string | null;
  ttdPihakPertama: string | null;
  ttdPihakKedua: string | null;
  saksi1: string | null;
  saksi2: string | null;
  createdBy: string | null;
  status: string;
  noPO: string | null;
  tanggalPO: Date | null;
  tanggalPelaksanaanMulai: Date | null;
  tanggalPelaksanaanSelesai: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  projectId: string | null;
  projectName: string | null;
}) {
  return {
    id: row.id,
    noBA: row.noBA,
    tanggal: row.tanggal.toISOString().slice(0, 10),
    jenisBA: row.jenisBA,
    pihakPertama: row.pihakPertama,
    pihakPertamaJabatan: row.pihakPertamaJabatan ?? undefined,
    pihakPertamaNama: row.pihakPertamaNama ?? undefined,
    pihakKedua: row.pihakKedua,
    pihakKeduaJabatan: row.pihakKeduaJabatan ?? undefined,
    pihakKeduaNama: row.pihakKeduaNama ?? undefined,
    lokasi: row.lokasi ?? undefined,
    contentHTML: sanitizeRichHtml(row.contentHTML),
    content: sanitizeRichHtml(row.contentHTML),
    refSuratJalan: row.refSuratJalan ?? undefined,
    refProject: row.refProject ?? undefined,
    ttdPihakPertama: row.ttdPihakPertama ?? undefined,
    ttdPihakKedua: row.ttdPihakKedua ?? undefined,
    saksi1: row.saksi1 ?? undefined,
    saksi2: row.saksi2 ?? undefined,
    createdBy: row.createdBy ?? undefined,
    status: row.status,
    noPO: row.noPO ?? undefined,
    tanggalPO: row.tanggalPO ? row.tanggalPO.toISOString().slice(0, 10) : undefined,
    tanggalPelaksanaanMulai: row.tanggalPelaksanaanMulai ? row.tanggalPelaksanaanMulai.toISOString().slice(0, 10) : undefined,
    tanggalPelaksanaanSelesai: row.tanggalPelaksanaanSelesai ? row.tanggalPelaksanaanSelesai.toISOString().slice(0, 10) : undefined,
    approvedBy: row.approvedBy ?? undefined,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : undefined,
    projectId: row.projectId ?? undefined,
    projectName: row.projectName ?? undefined,
  };
}

export function mapProjectSpkToLegacyPayload(row: {
  id: string;
  projectId: string | null;
  workOrderId: string | null;
  spkNumber: string;
  title: string;
  pekerjaan: string | null;
  date: Date;
  urgent: boolean;
  status: string;
  technicians: Array<{ name: string }>;
  attachments: Array<{ url: string }>;
}) {
  return {
    id: row.id,
    projectId: row.projectId ?? undefined,
    workOrderId: row.workOrderId ?? undefined,
    noSPK: row.spkNumber,
    spkNumber: row.spkNumber,
    title: row.title,
    pekerjaan: row.pekerjaan ?? row.title,
    tanggal: row.date.toISOString().slice(0, 10),
    date: row.date.toISOString().slice(0, 10),
    urgent: row.urgent,
    status: row.status,
    teknisi: row.technicians.map((item) => item.name),
    invoiceImages: row.attachments.map((item) => item.url),
  };
}
