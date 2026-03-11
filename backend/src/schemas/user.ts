import { Role } from "@prisma/client";
import { z } from "zod";

const roleValues = Object.values(Role) as [Role, ...Role[]];
const passwordSchema = z
  .string()
  .min(10, "Password minimal 10 karakter")
  .max(128, "Password maksimal 128 karakter")
  .regex(/[A-Za-z]/, "Password wajib mengandung huruf")
  .regex(/[0-9]/, "Password wajib mengandung angka");

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9._-]+$/, "Username hanya boleh huruf kecil, angka, titik, underscore, dash"),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  password: passwordSchema,
  role: z.enum(roleValues),
}).strict();

export const updateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9._-]+$/, "Username hanya boleh huruf kecil, angka, titik, underscore, dash")
    .optional(),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(roleValues).optional(),
  isActive: z.boolean().optional(),
}).strict();

export const bootstrapOwnerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9._-]+$/, "Username hanya boleh huruf kecil, angka, titik, underscore, dash"),
  name: z.string().trim().max(120).optional(),
  password: passwordSchema,
}).strict();

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: passwordSchema,
});
