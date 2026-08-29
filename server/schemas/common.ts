import { z } from "@/server/openapi/zod";

export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string(),
  details: z.unknown().optional(),
});

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const projectSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  ownerId: z.string().uuid(),
  currentVersionId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const projectVersionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  revision: z.number().int().min(1),
  label: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  storageKey: z.string(),
  storageBucket: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  checksumSha256: z.string(),
  fileCount: z.number().int().nonnegative(),
  restoredFromVersionId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(5000).nullable().optional(),
});

export const createProjectVersionSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  description: z.string().max(5000).optional(),
  restoreFromVersionId: z.string().uuid().optional(),
});

const passwordSchema = z.string().min(8).max(128);

export const signUpSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email().trim().toLowerCase(),
  password: passwordSchema,
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(160).optional(),
  country: z.string().trim().max(100).optional(),
});

export const signInSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: passwordSchema,
});
export const forgotPasswordSchema = z.object({
  email: z.email().trim().toLowerCase(),
});
export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: passwordSchema })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const projectListResponseSchema = z.object({
  projects: z.array(projectSchema),
  total: z.number().int().nonnegative(),
});

export const projectVersionListResponseSchema = z.object({
  versions: z.array(projectVersionSchema),
  total: z.number().int().nonnegative(),
});
