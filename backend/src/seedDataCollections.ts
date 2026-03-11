import "dotenv/config";
import { prisma } from "./prisma";

const sampleDataCollection = {
  id: "DC-2026-EXAMPLE-001",
  status: "Completed",
  date: "2026-03-01",
  rev: "0",
  versi: "A",
  up: "Bpk. Alois",
  namaResponden: "Bpk. Alois",
  namaProyek: "Repair Furnace Boiler",
  customer: "PT StarMortar",
  lokasi: "Subang",
  durasiProyekHari: 14,
  tipePekerjaan: "Repair Furnace Boiler",
  notes:
    "Material existing brick diganti castable. Scaffolding support area utara/barat/timur.",
  scopeOfWork: [
    "Bongkar material existing",
    "Pemasangan anchor baru",
    "Pemasangan castable",
    "Dry out mengikuti manufaktur",
  ],
  tools: [
    { nama: "Mixer Paddle", jenis: "Unit", jumlah: 1, keterangan: "" },
    { nama: "Vibrator", jenis: "Unit", jumlah: 2, keterangan: "" },
    { nama: "Trafo Las", jenis: "Unit", jumlah: 1, keterangan: "" },
    { nama: "Jack Hammer Angin", jenis: "Unit", jumlah: 2, keterangan: "" },
  ],
  manpower: [
    { jabatan: "Supervisor", jumlah: 1, sertifikat: "", keterangan: "" },
    { jabatan: "Safety", jumlah: 1, sertifikat: "", keterangan: "" },
    { jabatan: "Welder", jumlah: 1, sertifikat: "", keterangan: "" },
    { jabatan: "Helper", jumlah: 5, sertifikat: "", keterangan: "Lokal" },
  ],
  schedule: [
    {
      deskripsi: "Mock Up Bongkar Material Lama",
      jumlahHari: 7,
      keterangan: "Cleaning surface",
    },
    { deskripsi: "Pemasangan Anchor", jumlahHari: 3, keterangan: "Paralel" },
    { deskripsi: "Pemasangan Scaffolding", jumlahHari: 2, keterangan: "" },
    { deskripsi: "Pemasangan Castable", jumlahHari: 5, keterangan: "" },
  ],
  consumables: [
    { deskripsi: "Triplek 12 mm", unit: "Lembar", jumlah: 15, keterangan: "" },
    { deskripsi: "Paku 7", unit: "Kg", jumlah: 10, keterangan: "" },
    { deskripsi: "Kawat Stainless", unit: "Kg", jumlah: 5, keterangan: "" },
  ],
  dibuatOleh: ["Anwar", "Aji"],
  mengetahui: "JT 5",
};

async function run() {
  await prisma.dataCollection.upsert({
    where: { id: sampleDataCollection.id },
    update: {
      namaResponden: sampleDataCollection.namaResponden,
      lokasi: sampleDataCollection.lokasi,
      tipePekerjaan: sampleDataCollection.tipePekerjaan,
      status: sampleDataCollection.status,
      tanggalSurvey: sampleDataCollection.date,
      payload: sampleDataCollection,
    },
    create: {
      id: sampleDataCollection.id,
      namaResponden: sampleDataCollection.namaResponden,
      lokasi: sampleDataCollection.lokasi,
      tipePekerjaan: sampleDataCollection.tipePekerjaan,
      status: sampleDataCollection.status,
      tanggalSurvey: sampleDataCollection.date,
      payload: sampleDataCollection,
    },
  });

  console.log("Seed data collection done:", sampleDataCollection.id);
}

run()
  .catch((err) => {
    console.error("Seed data collection failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
