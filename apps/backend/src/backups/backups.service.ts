/**
 * @file backups.service.ts
 * @description Real backup pipeline:
 *   1. pg_dump → SQL file
 *   2. Tar uploads directory (if includeUploads)
 *   3. Write manifest.json (table counts, version, generatedAt)
 *   4. tar.gz everything
 *   5. (optional) sync to R2
 *   6. Persist BackupJob + BackupArtifact records
 *   7. Apply retention (keep N most recent successful)
 *
 * Restore is in restore.service.ts.
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as tar from 'tar';
import {
  BackupStatus,
  BackupType,
  BackupArtifactKind,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ActivityService } from '../common/activity/activity.service';
import { LocalStorageProvider } from '../common/uploads/storage/local-storage.provider';
import { R2StorageProvider } from './storage/r2-storage.provider';
import { CreateBackupDto, UpdateBackupPolicyDto } from './dto/backups.dto';

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly storage: LocalStorageProvider,
    private readonly r2: R2StorageProvider,
  ) {}

  // ──────────────────────────────────────── POLICY
  async getPolicy() {
    let policy = await this.prisma.backupPolicy.findFirst();
    if (!policy) {
      policy = await this.prisma.backupPolicy.create({ data: {} });
    }
    return policy;
  }

  async updatePolicy(dto: UpdateBackupPolicyDto, userId: string) {
    const policy = await this.getPolicy();
    const updated = await this.prisma.backupPolicy.update({
      where: { id: policy.id },
      data: dto,
    });
    await this.activity.log({
      action: 'CONFIG_CHANGE' as any,
      entityType: 'BACKUP_POLICY' as any,
      entityId: updated.id,
      userId,
      message: `Backup policy updated`,
      metadata: dto as any,
    } as any);
    return updated;
  }

  // ──────────────────────────────────────── HISTORY
  async listJobs() {
    return this.prisma.backupJob.findMany({
      orderBy: { createdAt: 'desc' },
      include: { artifacts: true, _count: { select: { restores: true } } },
      take: 100,
    });
  }

  async findJob(id: string) {
    const j = await this.prisma.backupJob.findUnique({
      where: { id },
      include: {
        artifacts: true,
        restores: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!j) throw new NotFoundException('Backup job not found');
    return j;
  }

  async signedUrl(id: string) {
    const j = await this.findJob(id);
    if (!j.remoteKey) throw new BadRequestException('Backup not synced to R2');
    const url = await this.r2.signedDownloadUrl(j.remoteKey, 3600);
    return { url, expiresInSeconds: 3600 };
  }

  // ──────────────────────────────────────── CREATE
  async createBackup(
    opts: CreateBackupDto,
    userId: string,
    type: BackupType = BackupType.MANUAL,
  ) {
    const policy = await this.getPolicy();
    if (!policy.isEnabled && type === BackupType.SCHEDULED) {
      throw new BadRequestException('Backup policy is disabled');
    }

    const job = await this.prisma.backupJob.create({
      data: {
        type,
        status: BackupStatus.PENDING,
        triggeredById: userId,
      },
    });

    // Run async; mark RUNNING immediately
    await this.prisma.backupJob.update({
      where: { id: job.id },
      data: { status: BackupStatus.RUNNING, startedAt: new Date() },
    });

    try {
      const result = await this.runBackupPipeline(job.id, {
        includeUploads: opts.includeUploads ?? policy.includeUploads,
        syncToR2: opts.syncToR2 ?? policy.remoteSync,
      });

      const completed = await this.prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: BackupStatus.COMPLETED,
          completedAt: new Date(),
          totalSizeBytes: result.totalSize,
          archivePath: result.archivePath,
          remoteKey: result.remoteKey,
          manifest: result.manifest as any,
        },
      });

      await this.activity.log({
        action: 'CREATE' as any,
        entityType: 'BACKUP_JOB' as any,
        entityId: completed.id,
        userId,
        message: `Backup ${type === BackupType.SCHEDULED ? 'scheduled' : 'manual'} completed (${(result.totalSize / 1024 / 1024).toFixed(1)}MB)`,
        metadata: { remoteKey: result.remoteKey },
      } as any);

      // Apply retention
      await this.applyRetention(policy.retentionKeep);

      return completed;
    } catch (err: any) {
      this.logger.error(`Backup failed: ${err?.message}`, err?.stack);
      await this.prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: BackupStatus.FAILED,
          completedAt: new Date(),
          errorMessage: err?.message ?? String(err),
        },
      });
      throw err;
    }
  }

  // ──────────────────────────────────────── PIPELINE
  private async runBackupPipeline(
    jobId: string,
    opts: { includeUploads: boolean; syncToR2: boolean },
  ) {
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), `acad-bkp-${jobId}-`),
    );
    const dumpFile = path.join(tmpRoot, 'database.sql');
    const uploadsTar = path.join(tmpRoot, 'uploads.tar.gz');
    const manifestFile = path.join(tmpRoot, 'manifest.json');
    const archiveName = `acadchestra-${Date.now()}.tar.gz`;
    const archivePath = path.join(this.backupsDir(), archiveName);
    fs.mkdirSync(this.backupsDir(), { recursive: true });

    // 1. pg_dump
    await this.runPgDump(dumpFile);
    const dumpStat = fs.statSync(dumpFile);
    await this.prisma.backupArtifact.create({
      data: {
        backupJobId: jobId,
        kind: BackupArtifactKind.DATABASE_DUMP,
        path: dumpFile,
        sizeBytes: dumpStat.size,
      },
    });

    // 2. Uploads tarball
    if (opts.includeUploads) {
      const uploadsRoot = this.storage.rootDir();
      if (fs.existsSync(uploadsRoot)) {
        await tar.create(
          { gzip: true, file: uploadsTar, cwd: path.dirname(uploadsRoot) },
          [path.basename(uploadsRoot)],
        );
        const tarStat = fs.statSync(uploadsTar);
        await this.prisma.backupArtifact.create({
          data: {
            backupJobId: jobId,
            kind: BackupArtifactKind.UPLOADS_TARBALL,
            path: uploadsTar,
            sizeBytes: tarStat.size,
          },
        });
      }
    }

    // 3. Manifest
    const manifest = await this.buildManifest();
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    await this.prisma.backupArtifact.create({
      data: {
        backupJobId: jobId,
        kind: BackupArtifactKind.MANIFEST,
        path: manifestFile,
        sizeBytes: fs.statSync(manifestFile).size,
      },
    });

    // 4. Bundle into single .tar.gz
    const filesToInclude = ['database.sql', 'manifest.json'];
    if (opts.includeUploads && fs.existsSync(uploadsTar))
      filesToInclude.push('uploads.tar.gz');
    await tar.create(
      { gzip: true, file: archivePath, cwd: tmpRoot },
      filesToInclude,
    );
    const archiveStat = fs.statSync(archivePath);
    await this.prisma.backupArtifact.create({
      data: {
        backupJobId: jobId,
        kind: BackupArtifactKind.ARCHIVE,
        path: archivePath,
        sizeBytes: archiveStat.size,
      },
    });

    // 5. Sync to R2
    let remoteKey: string | undefined;
    if (opts.syncToR2) {
      try {
        if (await this.r2.isConfigured()) {
          const key = `backups/${archiveName}`;
          await this.r2.uploadFile(archivePath, key);
          remoteKey = key;
        } else {
          this.logger.warn('R2 not configured, skipping remote sync');
        }
      } catch (err: any) {
        this.logger.error(`R2 sync failed: ${err?.message}`);
      }
    }

    // Cleanup temp
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}

    return {
      archivePath,
      remoteKey,
      totalSize: archiveStat.size,
      manifest,
    };
  }

  private backupsDir() {
    return path.resolve(process.env.BACKUPS_DIR || './backups');
  }

  private async buildManifest() {
    const [tenants, users, students, teachers, classes, payments] =
      await Promise.all([
        this.prisma.tenant.count(),
        this.prisma.user.count(),
        this.prisma.student.count(),
        this.prisma.teacher.count(),
        this.prisma.class.count(),
        this.prisma.feePayment.count(),
      ]);
    return {
      version: 'v2',
      generatedAt: new Date().toISOString(),
      counts: { tenants, users, students, teachers, classes, payments },
    };
  }

  private async runPgDump(outFile: string) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL not set');
    const pgDump = process.env.PG_DUMP_PATH || 'pg_dump';

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        pgDump,
        [
          '--no-owner',
          '--no-privileges',
          '--clean',
          '--if-exists',
          '-Fc',
          '-d',
          url,
          '-f',
          outFile,
        ],
        {
          stdio: ['ignore', 'inherit', 'inherit'],
        },
      );
      proc.on('error', reject);
      proc.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`pg_dump exited with code ${code}`));
      });
    });
  }

  // ──────────────────────────────────────── RETENTION
  async applyRetention(keep: number) {
    const successful = await this.prisma.backupJob.findMany({
      where: { status: BackupStatus.COMPLETED },
      orderBy: { createdAt: 'desc' },
    });
    const toExpire = successful.slice(keep);
    for (const job of toExpire) {
      try {
        if (job.archivePath && fs.existsSync(job.archivePath)) {
          fs.unlinkSync(job.archivePath);
        }
        if (job.remoteKey) {
          try {
            await this.r2.deleteObject(job.remoteKey);
          } catch (e) {
            /* ignore */
          }
        }
      } catch (e) {
        this.logger.warn(`Retention cleanup error: ${(e as any)?.message}`);
      }
      await this.prisma.backupJob.update({
        where: { id: job.id },
        data: { status: BackupStatus.EXPIRED },
      });
    }
    return { expired: toExpire.length };
  }
}
