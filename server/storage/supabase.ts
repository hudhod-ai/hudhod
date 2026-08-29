import type { SupabaseClient } from "@supabase/supabase-js";

import type { StorageProvider, StoredArchive } from "@/server/storage/types";

export class SupabaseStorageProvider implements StorageProvider {
  constructor(
    private readonly client: SupabaseClient,
    private readonly defaultBucket: string,
  ) {}

  async putObject(input: {
    bucket: string;
    key: string;
    body: Buffer | Uint8Array;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<StoredArchive> {
    const body = Buffer.from(input.body);
    const checksum = await this.sha256(body);
    const bucket = input.bucket || this.defaultBucket;
    const { error } = await this.client.storage.from(bucket).upload(input.key, body, {
      contentType: input.contentType ?? "application/json",
      upsert: false,
      metadata: input.metadata,
    });

    if (error) throw error;

    return {
      key: input.key,
      bucket,
      sizeBytes: body.length,
      checksumSha256: checksum,
      contentType: input.contentType ?? "application/json",
    };
  }

  async getObject(input: { bucket: string; key: string }): Promise<Buffer> {
    const { data, error } = await this.client.storage
      .from(input.bucket || this.defaultBucket)
      .download(input.key);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  }

  async deleteObject(input: { bucket: string; key: string }): Promise<void> {
    const { error } = await this.client.storage
      .from(input.bucket || this.defaultBucket)
      .remove([input.key]);
    if (error) throw error;
  }

  async getPresignedUrl(input: {
    bucket: string;
    key: string;
    expiresInSeconds?: number;
  }): Promise<string> {
    const { data, error } = await this.client.storage
      .from(input.bucket || this.defaultBucket)
      .createSignedUrl(input.key, input.expiresInSeconds ?? 60);
    if (error || !data) throw error ?? new Error("Could not sign archive URL.");
    return data.signedUrl;
  }

  async exists(input: { bucket: string; key: string }): Promise<boolean> {
    const lastSlash = input.key.lastIndexOf("/");
    const { data, error } = await this.client.storage
      .from(input.bucket || this.defaultBucket)
      .list(lastSlash === -1 ? "" : input.key.slice(0, lastSlash), {
        search: lastSlash === -1 ? input.key : input.key.slice(lastSlash + 1),
      });
    if (error) return false;
    return data.some((entry) => entry.name === input.key.slice(lastSlash + 1));
  }

  private async sha256(buffer: Buffer): Promise<string> {
    const crypto = await import("node:crypto");
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }
}
