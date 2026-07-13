/**
 * @file storage-driver.interface.ts
 * @description Pluggable storage driver contract. Implement once per backend
 *   (local disk, Cloudflare R2, AWS S3, GCS). The service layer is unaware of
 *   which driver wrote a given file — it looks up by `storageDriver` column.
 */

import { UploadCategory } from '@prisma/client';

export interface SaveInput {
  tenantId: string | null;
  category: UploadCategory;
  originalName: string;
  buffer: Buffer;
  mimeType: string;
}

export interface SaveResult {
  storedName: string;
  storagePath: string;
  checksum: string;
  sizeBytes: number;
}

export interface UrlOptions {
  /** Generate a time-limited signed URL (for private assets) */
  signed?: boolean;
  /** Signed URL TTL in seconds (default 900 = 15min) */
  expiresInSeconds?: number;
  /** Force browser to download with this filename */
  downloadAs?: string;
  /** Override Content-Type header for response */
  mimeType?: string;
}

export interface StorageDriver {
  /** Stable identifier persisted in `UploadAsset.storageDriver` */
  readonly name: string;

  save(input: SaveInput): Promise<SaveResult>;
  delete(storagePath: string): Promise<void>;
  buildUrl(storagePath: string, opts?: UrlOptions): Promise<string> | string;
  readStream(storagePath: string): Promise<NodeJS.ReadableStream>;
  exists(storagePath: string): Promise<boolean>;
}
