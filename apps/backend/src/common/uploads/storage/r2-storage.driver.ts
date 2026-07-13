/**
 * @file r2-storage.driver.ts
 * @description Cloudflare R2 (S3-compatible) storage driver. Used in
 *   production when STORAGE_DRIVER=r2. Public assets via CDN, private via
 *   presigned URLs.
 */

import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as path from 'path';
import * as crypto from 'crypto';
import { UploadCategory } from '@prisma/client';
import {
  StorageDriver,
  SaveInput,
  SaveResult,
  UrlOptions,
} from './storage-driver.interface';

@Injectable()
export class R2StorageDriver implements StorageDriver, OnModuleInit {
  readonly name = 'r2';
  private readonly logger = new Logger(R2StorageDriver.name);
  private client: S3Client | null = null;
  private bucket = '';
  private cdnBaseUrl?: string;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    const bucket = this.config.get<string>('R2_BUCKET');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');

    if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'R2 credentials not configured — driver disabled. Set R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY to enable.',
      );
      return;
    }

    this.bucket = bucket;
    this.cdnBaseUrl = this.config
      .get<string>('R2_CDN_BASE_URL')
      ?.replace(/\/+$/, '');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.enabled = true;
    this.logger.log(`R2 driver ready (bucket=${bucket})`);
  }

  isEnabled() {
    return this.enabled;
  }

  // ------------------------------------------------------------------
  private buildKey(
    tenantId: string | null,
    category: UploadCategory,
    storedName: string,
  ) {
    const cat = category.toLowerCase();
    return tenantId
      ? path.posix.join('tenants', tenantId, cat, storedName)
      : path.posix.join('system', cat, storedName);
  }

  private buildStoredName(originalName: string) {
    const ext = path.extname(originalName).toLowerCase().slice(0, 16);
    const id = crypto.randomBytes(16).toString('hex');
    return `${id}${ext}`;
  }

  private requireClient(): S3Client {
    if (!this.client) {
      throw new Error('R2 driver not configured');
    }
    return this.client;
  }

  // ------------------------------------------------------------------
  async save(input: SaveInput): Promise<SaveResult> {
    const client = this.requireClient();
    const storedName = this.buildStoredName(input.originalName);
    const storagePath = this.buildKey(
      input.tenantId,
      input.category,
      storedName,
    );

    const checksum = crypto
      .createHash('sha256')
      .update(input.buffer)
      .digest('hex');

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
        Body: input.buffer,
        ContentType: input.mimeType,
        Metadata: {
          'original-name': encodeURIComponent(input.originalName),
          'tenant-id': input.tenantId ?? 'system',
          category: input.category,
          checksum,
        },
      }),
    );

    return {
      storedName,
      storagePath,
      checksum,
      sizeBytes: input.buffer.byteLength,
    };
  }

  async delete(storagePath: string): Promise<void> {
    const client = this.requireClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: storagePath }),
    );
  }

  async buildUrl(
    storagePath: string,
    opts: UrlOptions = {},
  ): Promise<string> {
    const client = this.requireClient();

    // Public CDN path for unsigned reads
    if (this.cdnBaseUrl && !opts.signed) {
      return `${this.cdnBaseUrl}/${storagePath}`;
    }

    // Signed URL for private assets
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storagePath,
      ResponseContentDisposition: opts.downloadAs
        ? `attachment; filename="${encodeURIComponent(opts.downloadAs)}"`
        : undefined,
      ResponseContentType: opts.mimeType,
    });
    return getSignedUrl(client, command, {
      expiresIn: opts.expiresInSeconds ?? 900,
    });
  }

  async readStream(storagePath: string): Promise<NodeJS.ReadableStream> {
    const client = this.requireClient();
    const out = await client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: storagePath }),
    );
    return out.Body as NodeJS.ReadableStream;
  }

  async exists(storagePath: string): Promise<boolean> {
    const client = this.requireClient();
    try {
      await client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: storagePath }),
      );
      return true;
    } catch (err: any) {
      if (
        err.name === 'NotFound' ||
        err.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw err;
    }
  }
}
