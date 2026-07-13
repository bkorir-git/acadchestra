/**
 * @file local-storage.driver.ts
 * @description Local filesystem storage driver. Files stored under
 *   `{UPLOAD_ROOT}/tenants/{tenantId}/{category}/{name}` for tenant assets,
 *   `{UPLOAD_ROOT}/system/{category}/{name}` for system assets. Served via
 *   the static handler mounted at `UPLOAD_PUBLIC_MOUNT` (default /uploads).

 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
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
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';
  private readonly logger = new Logger(LocalStorageDriver.name);
  private readonly root: string;
  private readonly publicBaseUrl: string;
  private readonly publicMountPath: string;

  constructor(private readonly config: ConfigService) {
    this.root = path.resolve(
      this.config.get<string>('UPLOAD_ROOT', './uploads'),
    );
    this.publicBaseUrl = (
      this.config.get<string>('PUBLIC_BASE_URL') ?? ''
    ).replace(/\/+$/, '');
    this.publicMountPath = (
      this.config.get<string>('UPLOAD_PUBLIC_MOUNT', '/uploads')
    ).replace(/\/+$/, '');
  }

  // ------------------------------------------------------------------
  // Path helpers
  // ------------------------------------------------------------------
  private buildRelativeDir(tenantId: string | null, category: UploadCategory) {
    const cat = category.toLowerCase();
    return tenantId
      ? path.posix.join('tenants', tenantId, cat)
      : path.posix.join('system', cat);
  }

  private buildStoredName(originalName: string) {
    const ext = path.extname(originalName).toLowerCase().slice(0, 16);
    const id = crypto.randomBytes(16).toString('hex');
    return `${id}${ext}`;
  }

  /** Defense-in-depth: prevent traversal & escape from root. */
  private toAbsolute(storagePath: string): string {
    if (!storagePath || storagePath.includes('\0')) {
      throw new Error(`Invalid storage path`);
    }
    const normalized = path.posix.normalize(storagePath).replace(/^\/+/, '');
    if (normalized.startsWith('..') || normalized.includes('../')) {
      throw new Error(`Path traversal blocked: ${storagePath}`);
    }
    const abs = path.resolve(this.root, normalized);
    if (!abs.startsWith(this.root + path.sep) && abs !== this.root) {
      throw new Error(`Storage path escapes root: ${storagePath}`);
    }
    return abs;
  }

  // ------------------------------------------------------------------
  // StorageDriver interface
  // ------------------------------------------------------------------
  async save(input: SaveInput): Promise<SaveResult> {
    const relDir = this.buildRelativeDir(input.tenantId, input.category);
    const absDir = path.resolve(this.root, relDir);
    await fs.mkdir(absDir, { recursive: true });

    const storedName = this.buildStoredName(input.originalName);
    const storagePath = path.posix.join(relDir, storedName);
    const absPath = this.toAbsolute(storagePath);

    await fs.writeFile(absPath, input.buffer);

    const checksum = crypto
      .createHash('sha256')
      .update(input.buffer)
      .digest('hex');

    this.logger.debug(`saved ${storagePath} (${input.buffer.byteLength}B)`);

    return {
      storedName,
      storagePath,
      checksum,
      sizeBytes: input.buffer.byteLength,
    };
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await fs.unlink(this.toAbsolute(storagePath));
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  buildUrl(storagePath: string, opts: UrlOptions = {}): string {
    const base = this.publicBaseUrl
      ? `${this.publicBaseUrl}${this.publicMountPath}`
      : this.publicMountPath; // relative — frontend prepends API base
    const url = `${base}/${storagePath}`;
    if (opts.downloadAs) {
      return `${url}?download=${encodeURIComponent(opts.downloadAs)}`;
    }
    return url;
  }

  async readStream(storagePath: string): Promise<NodeJS.ReadableStream> {
    return createReadStream(this.toAbsolute(storagePath));
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await fs.access(this.toAbsolute(storagePath));
      return true;
    } catch {
      return false;
    }
  }

  rootDir() {
    return this.root;
  }

  publicMount() {
    return this.publicMountPath;
  }
}
