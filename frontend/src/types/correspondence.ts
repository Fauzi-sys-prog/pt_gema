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
