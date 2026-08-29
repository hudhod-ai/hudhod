import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/server/env";
import type { StorageProvider, StoredArchive } from "@/server/storage/types";

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT,
      forcePathStyle: env.STORAGE_DRIVER === "minio",
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY,
        secretAccessKey: env.STORAGE_SECRET_KEY,
      },
      tls: env.APP_ENV === "production" ? true : false,
    });
  }

  async putObject(input: {
    bucket: string;
    key: string;
    body: Buffer | Uint8Array;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<StoredArchive> {
    const body = Buffer.isBuffer(input.body)
      ? input.body
      : Buffer.from(input.body);
    const checksum = await this.sha256(body);

    await this.client.send(
      new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
        Body: body,
        ContentType: input.contentType ?? "application/gzip",
        Metadata: input.metadata,
      }),
    );

    return {
      key: input.key,
      bucket: input.bucket,
      sizeBytes: body.length,
      checksumSha256: checksum,
      contentType: input.contentType ?? "application/gzip",
    };
  }

  async getObject(input: { bucket: string; key: string }): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
      }),
    );

    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  async deleteObject(input: { bucket: string; key: string }): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
      }),
    );
  }

  async getPresignedUrl(input: {
    bucket: string;
    key: string;
    expiresInSeconds?: number;
  }): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds ?? 60,
    });
  }

  async exists(input: { bucket: string; key: string }): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: input.bucket,
          Key: input.key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  private async sha256(buffer: Buffer): Promise<string> {
    const hash = await import("node:crypto").then((crypto) =>
      crypto.createHash("sha256"),
    );
    return hash.update(buffer).digest("hex");
  }
}
