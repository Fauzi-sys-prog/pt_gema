import { z } from "zod";

export const quotationSchema = z
  .object({
    id: z.string().min(1),
  })
  .passthrough();

export const quotationBulkSchema = z.array(quotationSchema);
