export interface StoredArchive {
  key: string;
  bucket: string;
  sizeBytes: number;
  checksumSha256: string;
  contentType: string;
  url?: string;
}

export interface StorageProvider {
  putObject(input: {
    bucket: string;
    key: string;
    body: Buffer | Uint8Array;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<StoredArchive>;

  getObject(input: { bucket: string; key: string }): Promise<Buffer>;

  deleteObject(input: { bucket: string; key: string }): Promise<void>;

  getPresignedUrl(input: {
    bucket: string;
    key: string;
    expiresInSeconds?: number;
  }): Promise<string>;

  exists(input: { bucket: string; key: string }): Promise<boolean>;
}
