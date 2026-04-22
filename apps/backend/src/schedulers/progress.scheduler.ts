/**
 * @scheduler ProgressScheduler
 * @description Persists daily progress snapshots in ReportSnapshot so dashboards
 *   can plot historical trends without recomputation.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { ProgressService } from '../common/progress/progress.service';

@Injectable()
export class ProgressScheduler {
  private readonly logger = new Logger(ProgressScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async snapshot() {
    const years = await this.prisma.academicYear.findMany({
      where: { status: 'ACTIVE' },
    });
    for (const y of years) {
      try {
        await this.progress.snapshot(y.tenantId, y.id);
      } catch (e: any) {
        this.logger.error(
          `Snapshot failed for year ${y.id} / tenant ${y.tenantId}: ${e.message}`,
        );
      }
    }
    this.logger.log(`Progress snapshots written: ${years.length}`);
  }
}
