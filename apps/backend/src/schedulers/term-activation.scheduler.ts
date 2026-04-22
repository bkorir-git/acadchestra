/**
 * @scheduler TermActivationScheduler
 * @description Runs nightly to:
 *   1. Emit TERM_STARTING_SOON (7-day horizon).
 *   2. Emit TERM_OVERDUE when a term's startDate passed but isActive=false.
 *   3. Detect active-term mismatch (active but outside window).
 *   Auto-activation is NOT performed — admins must explicitly activate to
 *   avoid silent billing trigger.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../database/prisma.service';
import { EVENTS } from '../common/events/events.constants';

@Injectable()
export class TermActivationScheduler {
  private readonly logger = new Logger(TermActivationScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runDailySweep() {
    this.logger.log('Running daily term activation sweep');
    const now = new Date();

    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      try {
        await this.sweepTenant(t.id, now);
      } catch (e: any) {
        this.logger.error(`Sweep failed for tenant ${t.id}: ${e.message}`);
      }
    }
  }

  private async sweepTenant(tenantId: string, now: Date) {
    // Starting-soon (7 days)
    const in7d = new Date(now);
    in7d.setDate(in7d.getDate() + 7);

    const upcoming = await this.prisma.academicTerm.findMany({
      where: {
        tenantId,
        isActive: false,
        startDate: { gt: now, lte: in7d },
        academicYear: { status: { not: 'ARCHIVED' } },
      },
    });

    for (const t of upcoming) {
      const daysUntilStart = Math.ceil(
        (t.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      this.events.emit(EVENTS.TERM_STARTING_SOON, {
        tenantId,
        termId: t.id,
        termName: t.name,
        startDate: t.startDate,
        daysUntilStart,
      });
    }

    // Overdue: start date passed but not activated
    const overdue = await this.prisma.academicTerm.findMany({
      where: {
        tenantId,
        isActive: false,
        startDate: { lte: now },
        endDate: { gte: now },
        academicYear: { status: { not: 'ARCHIVED' } },
      },
    });

    for (const t of overdue) {
      const daysOverdue = Math.ceil(
        (now.getTime() - t.startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      this.events.emit(EVENTS.TERM_OVERDUE, {
        tenantId,
        termId: t.id,
        termName: t.name,
        startDate: t.startDate,
        daysOverdue,
      });
    }

    // Active-term mismatch
    const activeOutOfWindow = await this.prisma.academicTerm.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [{ startDate: { gt: now } }, { endDate: { lt: now } }],
      },
    });
    for (const t of activeOutOfWindow) {
      this.events.emit(EVENTS.TERM_STATE_MISMATCH, {
        tenantId,
        termId: t.id,
        termName: t.name,
        reason: t.startDate > now ? 'TERM_NOT_STARTED' : 'TERM_ENDED',
      });
    }
  }
}
