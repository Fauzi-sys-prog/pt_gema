import { z } from "zod";

const resourceSchema = z.string().min(2).max(80).regex(/^[a-z0-9_-]+$/i);

export const resourceParamSchema = z.object({
  resource: resourceSchema,
});

export const resourceEntityParamSchema = z.object({
  resource: resourceSchema,
  entityId: z.string().min(1),
});

export const createEntitySchema = z.object({
  entityId: z.string().min(1).optional(),
  payload: z.unknown(),
});

export const updateEntitySchema = z.object({
  payload: z.unknown(),
});
