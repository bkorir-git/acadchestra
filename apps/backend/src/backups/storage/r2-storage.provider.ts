/**
 * @file r2-storage.provider.ts
 * @description Cloudflare R2 (S3-compatible) storage. Credentials resolved
 *   from the Config table FIRST (category=infrastructure, key=r2.*), with
 *   fallback to environment variables.
 *
 *   When unconfigured, uploadObject() throws BadRequestException — the caller
 *   should detect this and skip remote sync gracefully.
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '../../common/config/config.service';
import * as fs from 'fs';
import { Readable } from 'stream';

export interface R2Credentials {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBucket?: string;
}

@Injectable()
export class R2StorageProvider {
  private readonly logger = new Logger(R2StorageProvider.name);

  constructor(private readonly config: ConfigService) {}

  async resolveCredentials(): Promise<R2Credentials | null> {
    // 1. Try Config table (any tenant — these are infrastructure-level configs
    //    stored under the demo tenant or first available). The Config service
    //    is per-tenant, so we check ALL tenants until we find r2 settings.
    //    Simpler: store under a sentinel "PLATFORM" tenantId when needed; for
    //    now, iterate over tenants until we find one with r2 settings.
    const fromDb = await this.tryLoadFromDb();
    if (fromDb) return fromDb;

    // 2. Fall back to env
    const ep = process.env.R2_ENDPOINT;
    const ak = process.env.R2_ACCESS_KEY_ID;
    const sk = process.env.R2_SECRET_ACCESS_KEY;
    const bk = process.env.R2_BUCKET;
    const pbk = process.env.R2_PUBLIC_BUCKET;
    if (ep && ak && sk && bk) {
      return {
        endpoint: ep,
        accessKeyId: ak,
        secretAccessKey: sk,
        bucket: bk,
        publicBucket: pbk,
      };
    }
    return null;
  }

  private async tryLoadFromDb(): Promise<R2Credentials | null> {
    // We deliberately don't bind to a specific tenant; we look at any tenant
    // that has the infrastructure config set. This lets a SuperAdmin set R2
    // creds globally via /system/configurations.
    try {
      // The ConfigService is keyed on tenantId — to keep R2 creds global
      // we look at the first tenant; SuperAdmin maintains this row.
      // Future: introduce a tenant-less SystemConfig model. For now this works.
      const tenant = await (this.config as any).prisma?.tenant?.findFirst({
        where: { isActive: true },
        select: { id: true },
      });
      if (!tenant) return null;
      const cat = await this.config.getCategory<any>(
        tenant.id,
        'infrastructure',
      );
      const r2 = cat?.r2;
      if (
        !r2 ||
        !r2.endpoint ||
        !r2.accessKeyId ||
        !r2.secretAccessKey ||
        !r2.bucket
      ) {
        return null;
      }
      return {
        endpoint: r2.endpoint,
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
        bucket: r2.bucket,
        publicBucket: r2.publicBucket,
      };
    } catch {
      return null;
    }
  }

  async client(): Promise<{ s3: S3Client; creds: R2Credentials }> {
    const creds = await this.resolveCredentials();
    if (!creds) {
      throw new BadRequestException(
        'R2 credentials not configured. Set R2_* env vars or configure under /system/configurations',
      );
    }
    const s3 = new S3Client({
      region: 'auto',
      endpoint: creds.endpoint,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
      },
    });
    return { s3, creds };
  }

  async isConfigured(): Promise<boolean> {
    const creds = await this.resolveCredentials();
    return !!creds;
  }

  async uploadFile(
    localPath: string,
    remoteKey: string,
  ): Promise<{ key: string; size: number }> {
    const { s3, creds } = await this.client();
    const stat = fs.statSync(localPath);
    const stream = fs.createReadStream(localPath);
    const upload = new Upload({
      client: s3,
      params: { Bucket: creds.bucket, Key: remoteKey, Body: stream },
    });
    await upload.done();
    return { key: remoteKey, size: stat.size };
  }

  async deleteObject(remoteKey: string) {
    const { s3, creds } = await this.client();
    await s3.send(
      new DeleteObjectCommand({ Bucket: creds.bucket, Key: remoteKey }),
    );
  }

  async signedDownloadUrl(remoteKey: string, expiresIn = 3600) {
    const { s3, creds } = await this.client();
    const cmd = new GetObjectCommand({ Bucket: creds.bucket, Key: remoteKey });
    return getSignedUrl(s3, cmd, { expiresIn });
  }

  async downloadToFile(remoteKey: string, localPath: string) {
    const { s3, creds } = await this.client();
    const res = await s3.send(
      new GetObjectCommand({ Bucket: creds.bucket, Key: remoteKey }),
    );
    if (!res.Body) throw new Error('Empty body from R2');
    const stream = res.Body as Readable;
    await new Promise<void>((resolve, reject) => {
      const ws = fs.createWriteStream(localPath);
      stream.pipe(ws).on('finish', resolve).on('error', reject);
    });
  }
}
