/**
 * @description Financial lock service — independent from academic lock.
 *   Locks can be applied at year or term granularity. A locked year/term:
 *     - Rejects new payments
 *     - Rejects new billing runs
 *     - Rejects discount creation
 *   (Grading and attendance continue to work — that's academic lock.)
 *
 *   Lock history is preserved via activity log; unlock records the reason.
 */

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, ActivityEntityType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';

interface Actor {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class FinancialLockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  private actorName(a: Actor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  // ─────────────────────────── STATUS
  async getStatus(tenantId: string) {
    const [years, terms] = await Promise.all([
      this.prisma.academicYear.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          isCurrent: true,
          status: true,
          isFinanciallyLocked: true,
          financiallyLockedAt: true,
          financialLockReason: true,
          startDate: true,
          endDate: true,
        },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.academicTerm.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          termNumber: true,
          isActive: true,
          isFinanciallyLocked: true,
          financiallyLockedAt: true,
          academicYearId: true,
          academicYear: { select: { name: true } },
          startDate: true,
          endDate: true,
        },
        orderBy: [{ academicYearId: 'desc' }, { termNumber: 'asc' }],
      }),
    ]);
    return { years, terms };
  }

  // ─────────────────────────── YEAR LOCK
  async lockYear(yearId: string, reason: string | undefined, actor: Actor) {
    const y = await this.prisma.academicYear.findFirst({
      where: { id: yearId, tenantId: actor.tenantId },
    });
    if (!y) throw new NotFoundException('Academic year not found');
    if (y.isFinanciallyLocked) return y;
    const updated = await this.prisma.academicYear.update({
      where: { id: yearId },
      data: {
        isFinanciallyLocked: true,
        financiallyLockedAt: new Date(),
        financialLockReason: reason ?? 'Manually locked',
      },
    });
    await this.activity.log({
      action: ActivityAction.FINANCIAL_LOCK,
      entityType: ActivityEntityType.ACADEMIC_YEAR,
      entityId: yearId,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} financially LOCKED year "${y.name}"`,
      metadata: { reason },
    });
    return updated;
  }

  async unlockYear(yearId: string, reason: string | undefined, actor: Actor) {
    const y = await this.prisma.academicYear.findFirst({
      where: { id: yearId, tenantId: actor.tenantId },
    });
    if (!y) throw new NotFoundException('Academic year not found');
    if (!y.isFinanciallyLocked) return y;
    const updated = await this.prisma.academicYear.update({
      where: { id: yearId },
      data: {
        isFinanciallyLocked: false,
        financiallyLockedAt: null,
        financialLockReason: null,
      },
    });
    await this.activity.log({
      action: ActivityAction.FINANCIAL_LOCK,
      entityType: ActivityEntityType.ACADEMIC_YEAR,
      entityId: yearId,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} financially UNLOCKED year "${y.name}"`,
      metadata: { reason },
    });
    return updated;
  }

  // ─────────────────────────── TERM LOCK
  async lockTerm(termId: string, reason: string | undefined, actor: Actor) {
    const t = await this.prisma.academicTerm.findFirst({
      where: { id: termId, tenantId: actor.tenantId },
    });
    if (!t) throw new NotFoundException('Term not found');
    if (t.isFinanciallyLocked) return t;
    const updated = await this.prisma.academicTerm.update({
      where: { id: termId },
      data: {
        isFinanciallyLocked: true,
        financiallyLockedAt: new Date(),
      },
    });
    await this.activity.log({
      action: ActivityAction.FINANCIAL_LOCK,
      entityType: ActivityEntityType.ACADEMIC_TERM,
      entityId: termId,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} financially LOCKED term "${t.name}"`,
      metadata: { reason },
    });
    return updated;
  }

  async unlockTerm(termId: string, reason: string | undefined, actor: Actor) {
    const t = await this.prisma.academicTerm.findFirst({
      where: { id: termId, tenantId: actor.tenantId },
    });
    if (!t) throw new NotFoundException('Term not found');
    if (!t.isFinanciallyLocked) return t;
    const updated = await this.prisma.academicTerm.update({
      where: { id: termId },
      data: { isFinanciallyLocked: false, financiallyLockedAt: null },
    });
    await this.activity.log({
      action: ActivityAction.FINANCIAL_LOCK,
      entityType: ActivityEntityType.ACADEMIC_TERM,
      entityId: termId,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} financially UNLOCKED term "${t.name}"`,
      metadata: { reason },
    });
    return updated;
  }
}
