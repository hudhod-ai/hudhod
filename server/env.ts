import "server-only";

import { z } from "zod";

const envSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  AUTH_DEMO_USER_ID: z
    .string()
    .uuid()
    .default("00000000-0000-4000-8000-000000000001"),
  STORAGE_DRIVER: z.enum(["minio", "supabase"]).default("minio"),
  STORAGE_ENDPOINT: z.string().url().default("http://localhost:9000"),
  STORAGE_BUCKET: z.string().min(1, "STORAGE_BUCKET is required."),
  STORAGE_REGION: z.string().default("us-east-1"),
  STORAGE_ACCESS_KEY: z.string().min(1, "STORAGE_ACCESS_KEY is required."),
  STORAGE_SECRET_KEY: z.string().min(1, "STORAGE_SECRET_KEY is required."),
  STORAGE_PUBLIC_BASE_URL: z
    .string()
    .url()
    .default("http://localhost:9000/project-archives"),
});

export const env = envSchema.parse(process.env);

export type AppEnv = z.infer<typeof envSchema>;
