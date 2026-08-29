import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/server";
import { env } from "@/server/env";
import { SupabaseStorageProvider } from "@/server/storage/supabase";
import type { StorageProvider } from "@/server/storage/types";

export async function getStorageProvider(
  client?: SupabaseClient,
): Promise<StorageProvider> {
  return new SupabaseStorageProvider(
    client ?? (await createClient()),
    env.STORAGE_BUCKET,
  );
}
