/**
 * @file restore.service.ts
 * @description Restore from a BackupJob. Requires SuperAdmin password
 *   confirmation. The flow:
 *     1. Verify the user is SuperAdmin (route guard) and validate password
 *     2. Acquire archive (download from R2 if remote-only)
 *     3. Extract to temp dir
 *     4. pg_restore over the existing DB (overwrites)
 *     5. (optional) Restore uploads tarball over uploads dir
 *     6. Persist RestoreJob record + audit
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as tar from 'tar';
import { spawn } from 'child_process';
import { RestoreStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ActivityService } from '../common/activity/activity.service';
import { LocalStorageProvider } from '../common/uploads/storage/local-storage.provider';
import { R2StorageProvider } from './storage/r2-storage.provider';
import { RestoreBackupDto } from './dto/backups.dto';

@Injectable()
export class RestoreService {
  private readonly logger = new Logger(RestoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly storage: LocalStorageProvider,
    private readonly r2: R2StorageProvider,
  ) {}

  async listRestores() {
    return this.prisma.restoreJob.findMany({
      orderBy: { createdAt: 'desc' },
      include: { backupJob: true },
      take: 50,
    });
  }

  async restore(dto: RestoreBackupDto, userId: string) {
    // 1. Verify password
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    const valid = await bcrypt.compare(dto.adminPassword, user.password);
    if (!valid) throw new UnauthorizedException('Invalid SuperAdmin password');

    // Confirm SuperAdmin
    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    const isSuper = roles.some((r) => r.role?.name === 'SuperAdmin');
    if (!isSuper)
      throw new UnauthorizedException('Only SuperAdmin may restore');

    // 2. Locate the backup
    const backup = await this.prisma.backupJob.findUnique({
      where: { id: dto.backupJobId },
    });
    if (!backup) throw new BadRequestException('Backup not found');
    if (backup.status !== 'COMPLETED') {
      throw new BadRequestException(
        `Cannot restore from job in status ${backup.status}`,
      );
    }

    const restoreJob = await this.prisma.restoreJob.create({
      data: {
        backupJobId: backup.id,
        triggeredById: userId,
        confirmationHash: await bcrypt.hash(dto.adminPassword, 10),
        notes: dto.notes,
        status: RestoreStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    try {
      // 3. Get the archive locally
      const tmp = fs.mkdtempSync(
        path.join(os.tmpdir(), `acad-restore-${restoreJob.id}-`),
      );
      let archivePath = backup.archivePath ?? '';
      if (!archivePath || !fs.existsSync(archivePath)) {
        if (!backup.remoteKey)
          throw new Error('Archive missing locally and no remoteKey');
        archivePath = path.join(tmp, 'archive.tar.gz');
        await this.r2.downloadToFile(backup.remoteKey, archivePath);
      }

      // 4. Extract
      await tar.extract({ file: archivePath, cwd: tmp });
      const dumpFile = path.join(tmp, 'database.sql');
      const uploadsTar = path.join(tmp, 'uploads.tar.gz');

      if (!fs.existsSync(dumpFile))
        throw new Error('database.sql missing in archive');

      // 5. pg_restore
      await this.runPgRestore(dumpFile);

      // 6. Restore uploads if present
      if (fs.existsSync(uploadsTar)) {
        const uploadsRoot = this.storage.rootDir();
        const parent = path.dirname(uploadsRoot);
        try {
          // remove existing uploads dir contents
          if (fs.existsSync(uploadsRoot)) {
            fs.rmSync(uploadsRoot, { recursive: true, force: true });
          }
          fs.mkdirSync(parent, { recursive: true });
          await tar.extract({ file: uploadsTar, cwd: parent });
        } catch (e: any) {
          this.logger.warn(`Uploads restore warning: ${e?.message}`);
        }
      }

      try {
        fs.rmSync(tmp, { recursive: true, force: true });
      } catch {}

      const completed = await this.prisma.restoreJob.update({
        where: { id: restoreJob.id },
        data: { status: RestoreStatus.COMPLETED, completedAt: new Date() },
      });

      await this.activity.log({
        action: 'CONFIG_CHANGE' as any,
        entityType: 'BACKUP_JOB' as any,
        entityId: backup.id,
        userId,
        message: `Database restored from backup ${backup.id}`,
        metadata: { restoreJobId: restoreJob.id },
      } as any);

      return completed;
    } catch (err: any) {
      this.logger.error(`Restore failed: ${err?.message}`);
      await this.prisma.restoreJob.update({
        where: { id: restoreJob.id },
        data: {
          status: RestoreStatus.FAILED,
          completedAt: new Date(),
          errorMessage: err?.message ?? String(err),
        },
      });
      throw err;
    }
  }

  private async runPgRestore(dumpFile: string) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL not set');
    const pgRestore = process.env.PG_RESTORE_PATH || 'pg_restore';

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        pgRestore,
        [
          '--clean',
          '--if-exists',
          '--no-owner',
          '--no-privileges',
          '-d',
          url,
          dumpFile,
        ],
        { stdio: ['ignore', 'inherit', 'inherit'] },
      );
      proc.on('error', reject);
      proc.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`pg_restore exited with code ${code}`));
      });
    });
  }
}
