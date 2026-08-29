import "server-only";
import { z } from "zod";

const envSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  STORAGE_BUCKET: z.string().min(1).default("project-archives"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export const env = envSchema.parse(process.env);

export type AppEnv = z.infer<typeof envSchema>;
