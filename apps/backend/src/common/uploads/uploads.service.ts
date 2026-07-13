/**
 * @file uploads.service.ts
 * @description Tenant-isolated upload service. All assets stored on local disk
 *   under tenant-scoped folders, with metadata persisted in `UploadAsset`.
 *
 *   Allowed mime types per category are validated; unknown categories fall
 *   through to GENERAL.
 */
/**
 * @file uploads.service.ts
 * @description Tenant-isolated upload service. Validates MIME / size per
 *   category, persists metadata, and returns assets enriched with a freshly
 *   computed `publicUrl` (NEVER stored in DB). Private categories yield
 *   short-lived signed URLs in production.
 *
 * commit: 
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  UploadAsset,
  UploadCategory,
  UploadStatus,
  ActivityAction,
  ActivityEntityType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { StorageService } from './storage/storage.service';
import { UrlOptions } from './storage/storage-driver.interface';
import {
  RequestActor,
  isSuperAdmin,
} from '../../common/types/request-actor.type';

// ----------------------------------------------------------------------
// Validation tables — single source of truth for per-category rules.
// ----------------------------------------------------------------------
const MIME_RULES: Record<UploadCategory, RegExp> = {
  TENANT_LOGO: /^image\/(png|jpeg|jpg|webp|svg\+xml)$/,
  TENANT_FAVICON: /^image\/(png|jpeg|x-icon|vnd\.microsoft\.icon|svg\+xml)$/,
  STUDENT_PHOTO: /^image\/(png|jpeg|webp)$/,
  STUDENT_DOCUMENT: /^(application\/pdf|image\/(png|jpeg))$/,
  STAFF_PHOTO: /^image\/(png|jpeg|webp)$/,
  STAFF_DOCUMENT: /^(application\/pdf|image\/(png|jpeg))$/,
  CERTIFICATE: /^application\/pdf$/,
  IMPORT_STAGING:
    /^(text\/csv|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)$/,
  GENERAL: /.*/,
};

const MAX_BYTES: Record<UploadCategory, number> = {
  TENANT_LOGO: 2 * 1024 * 1024,
  TENANT_FAVICON: 512 * 1024,
  STUDENT_PHOTO: 5 * 1024 * 1024,
  STUDENT_DOCUMENT: 10 * 1024 * 1024,
  STAFF_PHOTO: 5 * 1024 * 1024,
  STAFF_DOCUMENT: 10 * 1024 * 1024,
  CERTIFICATE: 10 * 1024 * 1024,
  IMPORT_STAGING: 50 * 1024 * 1024,
  GENERAL: 20 * 1024 * 1024,
};

/** Categories whose URLs MUST be signed (short-lived) in production. */
const PRIVATE_CATEGORIES = new Set<UploadCategory>([
  UploadCategory.STUDENT_DOCUMENT,
  UploadCategory.STAFF_DOCUMENT,
  UploadCategory.CERTIFICATE,
  UploadCategory.IMPORT_STAGING,
]);

export interface MappedUploadAsset extends UploadAsset {
  publicUrl: string;
  tenant?: { id: string; name: string } | null;
}

export interface UploadFileInput {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface UploadParams {
  file: UploadFileInput;
  category: UploadCategory;
  tenantId?: string | null;
  ownerType?: 'USER' | 'TENANT' | 'SYSTEM';
  metadata?: Prisma.InputJsonValue;
}

export interface ListUploadsQuery {
  tenantId?: string;
  category?: UploadCategory;
  search?: string;
  take?: number;
  skip?: number;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  // ====================================================================
  // THE SINGLE URL MAPPER — derive, never store
  // ====================================================================
  async mapAsset(
    asset: UploadAsset & { tenant?: { id: string; name: string } | null },
    opts: UrlOptions = {},
  ): Promise<MappedUploadAsset> {
    const driver = this.storage.getByName(asset.storageDriver);
    const isPrivate = PRIVATE_CATEGORIES.has(asset.category);

    const url = await driver.buildUrl(asset.storagePath, {
      ...opts,
      signed: opts.signed ?? isPrivate,
      mimeType: opts.mimeType ?? asset.mimeType,
    });

    return { ...asset, publicUrl: url };
  }

  private async mapMany(
    assets: (UploadAsset & {
      tenant?: { id: string; name: string } | null;
    })[],
  ): Promise<MappedUploadAsset[]> {
    return Promise.all(assets.map((a) => this.mapAsset(a)));
  }

  // ====================================================================
  // Tenant resolution
  // ====================================================================
  private resolveTenantId(
    actor: RequestActor,
    requested?: string | null,
  ): string | null {
    if (isSuperAdmin(actor)) {
      // SuperAdmin can target any tenant or upload as system (null)
      return requested ?? null;
    }
    if (!actor.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    if (requested && requested !== actor.tenantId) {
      throw new ForbiddenException('Cannot upload to another tenant');
    }
    return actor.tenantId;
  }

  // ====================================================================
  // Validation
  // ====================================================================
  private validate(file: UploadFileInput, category: UploadCategory) {
    if (!file?.buffer || file.size === 0) {
      throw new BadRequestException('Empty file');
    }
    const rule = MIME_RULES[category];
    if (!rule.test(file.mimetype)) {
      throw new BadRequestException(
        `MIME type "${file.mimetype}" not allowed for ${category}`,
      );
    }
    const max = MAX_BYTES[category];
    if (file.size > max) {
      throw new BadRequestException(
        `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB > ${(max / 1024 / 1024).toFixed(2)}MB`,
      );
    }
  }

  // ====================================================================
  // CREATE
  // ====================================================================
  async upload(
    actor: RequestActor,
    params: UploadParams,
  ): Promise<MappedUploadAsset> {
    const { file, category } = params;
    this.validate(file, category);

    const tenantId = this.resolveTenantId(actor, params.tenantId);

    const driver = this.storage.getDefault();
    const saved = await driver.save({
      tenantId,
      category,
      originalName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    });

    const asset = await this.prisma.uploadAsset.create({
      data: {
        category,
        fileName: file.originalname,
        storedName: saved.storedName,
        mimeType: file.mimetype,
        sizeBytes: saved.sizeBytes,
        checksum: saved.checksum,
        storagePath: saved.storagePath,
        storageDriver: driver.name,
        ownerId: actor.id ?? null,
        ownerType: params.ownerType ?? 'USER',
        tenantId: tenantId ?? null,
        metadata: params.metadata ?? Prisma.JsonNull,
      },
      include: { tenant: { select: { id: true, name: true } } },
    });

    await this.activity
      .log({
        action: ActivityAction.CREATE,
        entityType: ActivityEntityType.UPLOAD_ASSET,
        entityId: asset.id,
        tenantId: tenantId ?? undefined,
        userId: actor.id,
        message: `Uploaded ${category} (${file.originalname})`,
        metadata: {
          sizeBytes: saved.sizeBytes,
          mimeType: file.mimetype,
          driver: driver.name,
        },
      })
      .catch((err) => this.logger.warn(`activity log failed: ${err?.message}`));

    return this.mapAsset(asset);
  }

  // ====================================================================
  // READ
  // ====================================================================
  async list(
    actor: RequestActor,
    query: ListUploadsQuery = {},
  ): Promise<MappedUploadAsset[]> {
    const where: Prisma.UploadAssetWhereInput = {
      status: UploadStatus.ACTIVE,
    };

    if (isSuperAdmin(actor)) {
      if (query.tenantId === '__SYSTEM__') {
        where.tenantId = null;
      } else if (query.tenantId) {
        where.tenantId = query.tenantId;
      }
    } else {
      where.tenantId = actor.tenantId;
    }

    if (query.category) where.category = query.category;
    if (query.search) {
      where.OR = [
        { fileName: { contains: query.search, mode: 'insensitive' } },
        { storedName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const assets = await this.prisma.uploadAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { tenant: { select: { id: true, name: true } } },
      take: Math.min(query.take ?? 200, 500),
      skip: query.skip ?? 0,
    });

    return this.mapMany(assets);
  }

  async findOne(id: string, actor: RequestActor): Promise<MappedUploadAsset> {
    const asset = await this.prisma.uploadAsset.findUnique({
      where: { id },
      include: { tenant: { select: { id: true, name: true } } },
    });
    if (!asset) throw new NotFoundException('Upload not found');

    if (
      !isSuperAdmin(actor) &&
      asset.tenantId &&
      asset.tenantId !== actor.tenantId
    ) {
      throw new ForbiddenException('Cannot access asset from another tenant');
    }
    return this.mapAsset(asset);
  }

  /** Generate a signed download URL (always expires) for sensitive viewing. */
  async getDownloadUrl(
    id: string,
    actor: RequestActor,
    opts: { downloadAs?: string; expiresInSeconds?: number } = {},
  ): Promise<{ url: string; expiresAt: Date }> {
    const asset = await this.prisma.uploadAsset.findUnique({
      where: { id },
      include: { tenant: { select: { id: true, name: true } } },
    });
    if (!asset) throw new NotFoundException('Upload not found');
    if (
      !isSuperAdmin(actor) &&
      asset.tenantId &&
      asset.tenantId !== actor.tenantId
    ) {
      throw new ForbiddenException();
    }

    const driver = this.storage.getByName(asset.storageDriver);
    const expiresIn = opts.expiresInSeconds ?? 900;
    const url = await driver.buildUrl(asset.storagePath, {
      signed: true,
      expiresInSeconds: expiresIn,
      downloadAs: opts.downloadAs ?? asset.fileName,
      mimeType: asset.mimeType,
    });
    return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }

  // ====================================================================
  // DELETE
  // ====================================================================
  async remove(id: string, actor: RequestActor): Promise<{ deleted: true }> {
    const asset = await this.prisma.uploadAsset.findUnique({
      where: { id },
    });
    if (!asset) throw new NotFoundException('Upload not found');
    if (
      !isSuperAdmin(actor) &&
      asset.tenantId &&
      asset.tenantId !== actor.tenantId
    ) {
      throw new ForbiddenException();
    }

    const driver = this.storage.getByName(asset.storageDriver);
    await driver.delete(asset.storagePath).catch((err) => {
      this.logger.warn(
        `Storage delete failed for ${asset.storagePath}: ${err?.message}`,
      );
    });

    await this.prisma.uploadAsset.update({
      where: { id },
      data: { status: UploadStatus.DELETED },
    });

    await this.activity
      .log({
        action: ActivityAction.DELETE,
        entityType: ActivityEntityType.UPLOAD_ASSET,
        entityId: id,
        tenantId: asset.tenantId ?? undefined,
        userId: actor.id,
        message: `Deleted upload ${asset.fileName}`,
      })
      .catch(() => undefined);

    return { deleted: true };
  }
}
