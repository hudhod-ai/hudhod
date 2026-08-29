import { env } from "@/server/env";
import { S3StorageProvider } from "@/server/storage/s3";
import type { StorageProvider } from "@/server/storage/types";

export function getStorageProvider(): StorageProvider {
  return new S3StorageProvider();
}

export const storageDriver = env.STORAGE_DRIVER;
