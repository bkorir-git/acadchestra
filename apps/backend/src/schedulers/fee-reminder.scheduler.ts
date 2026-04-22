/**
 * @scheduler FeeReminderScheduler
 * @description Emits FEE_DUE_SOON / FEE_OVERDUE based on tenant-configured
 *   reminder windows (TenantSettings.feeReminderDays). Notification Listeners
 *   translate these into user-facing messages.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../database/prisma.service';
import { EVENTS } from '../common/events/events.constants';

@Injectable()
export class FeeReminderScheduler {
  private readonly logger = new Logger(FeeReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailyReminderSweep() {
    this.logger.log('Running fee-reminder sweep');
    const now = new Date();

    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, settings: true },
    });

    for (const t of tenants) {
      const reminderDays: number[] =
        (t.settings as any)?.feeReminderDays ?? [7, 3, 1];

      // DUE SOON
      for (const days of reminderDays) {
        const target = new Date(now);
        target.setDate(target.getDate() + days);
        const start = new Date(target);
        start.setHours(0, 0, 0, 0);
        const end = new Date(target);
        end.setHours(23, 59, 59, 999);

        const fees = await this.prisma.studentFee.findMany({
          where: {
            tenantId: t.id,
            pendingAmount: { gt: 0 },
            dueDate: { gte: start, lte: end },
          },
          select: {
            id: true,
            studentId: true,
            pendingAmount: true,
            dueDate: true,
          },
        });
        for (const f of fees) {
          this.events.emit(EVENTS.FEE_DUE_SOON, {
            tenantId: t.id,
            studentId: f.studentId,
            studentFeeId: f.id,
            amount: Number(f.pendingAmount),
            dueDate: f.dueDate!,
            daysUntilDue: days,
          });
        }
      }

      // OVERDUE
      const overdue = await this.prisma.studentFee.findMany({
        where: {
          tenantId: t.id,
          pendingAmount: { gt: 0 },
          dueDate: { lt: now },
        },
        select: {
          id: true,
          studentId: true,
          pendingAmount: true,
          dueDate: true,
        },
      });
      for (const f of overdue) {
        const daysOverdue = Math.ceil(
          (now.getTime() - f.dueDate!.getTime()) / (1000 * 60 * 60 * 24),
        );
        this.events.emit(EVENTS.FEE_OVERDUE, {
          tenantId: t.id,
          studentId: f.studentId,
          studentFeeId: f.id,
          amount: Number(f.pendingAmount),
          dueDate: f.dueDate!,
          daysOverdue,
        });
      }
    }
  }
}