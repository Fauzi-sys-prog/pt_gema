import { z } from "zod";

export const projectSchema = z
  .object({
    id: z.string().min(1),
    namaProject: z.string().min(1),
    customer: z.string().min(1),
    nilaiKontrak: z.number().finite(),
    status: z.string().min(1),
    progress: z.number().min(0).max(100),
    endDate: z.string().min(1),
  })
  .passthrough();

export const projectBulkSchema = z.array(projectSchema);
