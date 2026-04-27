/**
 * @file backups.scheduler.ts
 * @description Cron scheduler that runs backups according to BackupPolicy.
 *   Reads the policy on app boot AND on every tick (cheap) so admin changes
 *   take effect by the next minute.
 *
 *   Uses @nestjs/schedule. Make sure `ScheduleModule.forRoot()` is imported in AppModule.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { BackupType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { BackupsService } from './backups.service';

@Injectable()
export class BackupsScheduler {
  private readonly logger = new Logger(BackupsScheduler.name);
  private readonly jobName = 'acadchestra-backup-cron';

  constructor(
    private readonly prisma: PrismaService,
    private readonly backups: BackupsService,
    private readonly registry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    await this.refresh();
  }

  /** Re-read policy and re-schedule if cron has changed. */
  @Cron(CronExpression.EVERY_6_HOURS)
  async refresh() {
    const policy = await this.prisma.backupPolicy.findFirst();
    if (!policy) return;
    if (!policy.isEnabled) {
      this.removeJob();
      return;
    }
    // Stop existing
    this.removeJob();
    try {
      const job = new CronJob(policy.scheduleCron, () => this.runScheduled());
      this.registry.addCronJob(this.jobName, job as any);
      job.start();
      this.logger.log(`Scheduled backup with cron "${policy.scheduleCron}"`);
    } catch (err: any) {
      this.logger.error(`Invalid cron "${policy.scheduleCron}": ${err?.message}`);
    }
  }

  private removeJob() {
    try { this.registry.deleteCronJob(this.jobName); } catch { /* ignore */ }
  }

  async runScheduled() {
    try {
      const policy = await this.backups.getPolicy();
      this.logger.log('Starting scheduled backup');
      // Fake "system" user — pass null userId via empty string; service tolerates undefined.
      await this.backups.createBackup(
        { includeUploads: policy.includeUploads, syncToR2: policy.remoteSync },
        '', // triggeredById = '' for scheduled
        BackupType.SCHEDULED,
      );
    } catch (err: any) {
      this.logger.error(`Scheduled backup failed: ${err?.message}`);
    }
  }
}
