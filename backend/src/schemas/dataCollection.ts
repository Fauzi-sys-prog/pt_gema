import { z } from "zod";

export const dataCollectionSchema = z
  .object({
    id: z.string().min(1),
    noKoleksi: z.string().optional(),
    namaResponden: z.string().optional(),
    kategori: z.string().optional(),
    tanggalPengumpulan: z.string().optional(),
    lokasi: z.string().optional(),
    namaKolektor: z.string().optional(),
    tipePekerjaan: z.string().optional(),
    jenisKontrak: z.string().optional(),
    dataFields: z.array(z.unknown()).optional(),
    materials: z.array(z.unknown()).optional(),
    manpower: z.array(z.unknown()).optional(),
    schedule: z.array(z.unknown()).optional(),
    consumables: z.array(z.unknown()).optional(),
    equipment: z.array(z.unknown()).optional(),
    scopeOfWork: z.array(z.string()).optional(),
    exclusions: z.array(z.string()).optional(),
    status: z.string().optional(),
    notes: z.string().optional(),
    priority: z.string().optional(),
    tags: z.array(z.string()).optional(),
    signature: z.string().optional(),
    title: z.string().optional(),
    sourceType: z.string().optional(),
    sourceFileName: z.string().optional(),
    sourceFile: z.string().optional(),
    importBatchId: z.string().optional(),
    importedAt: z.string().optional(),
    detectedCategory: z.string().optional(),
    effectiveCategory: z.string().optional(),
    fieldFit: z.string().optional(),
    recommendedModules: z.array(z.string()).optional(),
    mismatchNotes: z.array(z.string()).optional(),
    extracted: z.unknown().optional(),
  })
  .passthrough();

export const dataCollectionBulkSchema = z.array(dataCollectionSchema);
