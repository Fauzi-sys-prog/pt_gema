import { z } from "zod";

export const dataCollectionSchema = z
  .object({
    id: z.string().min(1),
  })
  .passthrough();

export const dataCollectionBulkSchema = z.array(dataCollectionSchema);
