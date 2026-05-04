/**
 * @file discounts.service.ts
 * @description Apply / list / revoke student discounts. When a discount is
 *   applied, we walk the student's open StudentFee rows and write a
 *   DISCOUNT ledger entry per match plus update the discountAmount /
 *   pendingAmount aggregates. Revoking writes a REVERSAL.
 *
 *   Two scopes:
 *     - TOTAL_FEE: applies to the whole StudentFee total
 *     - COMPONENT: applies only to a named component (case-insensitive)
 *
 *   Two types:
 *     - PERCENTAGE: value is 0-100
 *     - FIXED: value is a money amount
 *
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ActivityAction,
  ActivityEntityType,
  DiscountStatus,
  LedgerEntryType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { FeeLedgerService } from '../ledger/fee-ledger.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { percentOf, roundMoney } from '../common/fee-math.util';
import { deriveStatus } from '../common/fee-status.util';
import { FEE_EVENTS } from '../common/fee-events.constants';

interface Actor {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class DiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly ledger: FeeLedgerService,
    private readonly events: EventEmitter2,
  ) {}

  private actorName(a: Actor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  async list(
    actor: Actor,
    options: { page?: number; limit?: number; studentId?: string },
  ) {
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.StudentDiscountWhereInput = {
      tenantId: actor.tenantId,
      ...(options.studentId && { studentId: options.studentId }),
    };
    const [data, total] = await Promise.all([
      this.prisma.studentDiscount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
              class: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.studentDiscount.count({ where }),
    ]);
    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async create(dto: CreateDiscountDto, actor: Actor) {
    const tenantId = actor.tenantId;
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (dto.value < 0)
      throw new BadRequestException('Discount value cannot be negative');
    if (dto.discountType === 'PERCENTAGE' && dto.value > 100)
      throw new BadRequestException('Percentage discount cannot exceed 100');

    const discount = await this.prisma.$transaction(async (tx) => {
      const created = await tx.studentDiscount.create({
        data: {
          tenantId,
          studentId: dto.studentId,
          name: dto.name,
          description: dto.description,
          discountType: dto.discountType,
          scope: dto.scope,
          value: dto.value,
          componentName: dto.componentName,
          status: DiscountStatus.ACTIVE,
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          academicYearId: dto.academicYearId,
          academicTermId: dto.academicTermId,
          approvedById: actor.id,
          reason: dto.reason,
        },
      });

      // Walk open student fees and apply
      const fees = await tx.studentFee.findMany({
        where: {
          tenantId,
          studentId: dto.studentId,
          ...(dto.academicYearId && {
            feeStructure: { academicYearId: dto.academicYearId },
          }),
          ...(dto.academicTermId && {
            feeStructure: { academicTermId: dto.academicTermId },
          }),
          status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        },
        include: { components: true },
      });

      for (const sf of fees) {
        let waived = 0;
        if (dto.scope === 'COMPONENT') {
          const target = sf.components.find(
            (c) =>
              c.name.toLowerCase() === (dto.componentName ?? '').toLowerCase(),
          );
          if (!target) continue;
          const base = target.amount - target.discountAmount;
          waived =
            dto.discountType === 'PERCENTAGE'
              ? percentOf(base, dto.value)
              : Math.min(base, dto.value);
          if (waived <= 0) continue;
          await tx.studentFeeComponent.update({
            where: { id: target.id },
            data: {
              discountAmount: roundMoney(target.discountAmount + waived),
            },
          });
        } else {
          const base = sf.totalAmount - sf.discountAmount - sf.paidAmount;
          waived =
            dto.discountType === 'PERCENTAGE'
              ? percentOf(base, dto.value)
              : Math.min(base, dto.value);
          if (waived <= 0) continue;
        }

        const newDiscount = roundMoney(sf.discountAmount + waived);
        const newPending = roundMoney(
          Math.max(0, sf.totalAmount - sf.paidAmount - newDiscount),
        );
        await tx.studentFee.update({
          where: { id: sf.id },
          data: {
            discountAmount: newDiscount,
            pendingAmount: newPending,
            status: deriveStatus({
              totalAmount: sf.totalAmount - newDiscount,
              paidAmount: sf.paidAmount,
              dueDate: sf.dueDate,
            }),
          },
        });

        await this.ledger.write(tx, {
          tenantId,
          studentId: dto.studentId,
          entryType: LedgerEntryType.DISCOUNT,
          amount: waived,
          description: `Discount applied: ${dto.name}`,
          reference: created.id,
          studentFeeId: sf.id,
          recordedById: actor.id,
          metadata: {
            discountId: created.id,
            scope: dto.scope,
            type: dto.discountType,
            value: dto.value,
          },
        });
      }

      await this.activity.log(
        {
          action: ActivityAction.DISCOUNT,
          entityType: ActivityEntityType.STUDENT_DISCOUNT,
          entityId: created.id,
          tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} applied discount "${dto.name}" to student ${student.admissionNumber}`,
          metadata: dto as any,
        },
        tx,
      );

      return created;
    });

    this.events.emit(FEE_EVENTS.DISCOUNT_APPLIED, {
      tenantId,
      id: discount.id,
      studentId: dto.studentId,
    });
    return discount;
  }

  async revoke(id: string, actor: Actor) {
    const tenantId = actor.tenantId;
    const d = await this.prisma.studentDiscount.findFirst({
      where: { id, tenantId },
    });
    if (!d) throw new NotFoundException('Discount not found');
    if (d.status !== DiscountStatus.ACTIVE) return d;

    await this.prisma.$transaction(async (tx) => {
      // Sum existing DISCOUNT ledger entries for this discount
      const entries = await tx.feeLedger.findMany({
        where: {
          tenantId,
          studentId: d.studentId,
          entryType: LedgerEntryType.DISCOUNT,
          reference: id,
        },
      });

      for (const e of entries) {
        if (!e.studentFeeId) continue;
        const sf = await tx.studentFee.findUnique({
          where: { id: e.studentFeeId },
        });
        if (!sf) continue;
        const newDiscount = roundMoney(
          Math.max(0, sf.discountAmount - e.amount),
        );
        const newPending = roundMoney(
          sf.totalAmount - sf.paidAmount - newDiscount,
        );
        await tx.studentFee.update({
          where: { id: sf.id },
          data: {
            discountAmount: newDiscount,
            pendingAmount: newPending,
            status: deriveStatus({
              totalAmount: sf.totalAmount - newDiscount,
              paidAmount: sf.paidAmount,
              dueDate: sf.dueDate,
            }),
          },
        });
        await this.ledger.write(tx, {
          tenantId,
          studentId: d.studentId,
          entryType: LedgerEntryType.REVERSAL,
          amount: e.amount,
          description: `Discount "${d.name}" revoked`,
          reference: id,
          studentFeeId: sf.id,
          recordedById: actor.id,
          metadata: { revokedDiscountId: id },
        });
      }

      await tx.studentDiscount.update({
        where: { id },
        data: { status: DiscountStatus.CANCELLED },
      });

      await this.activity.log(
        {
          action: ActivityAction.UPDATE,
          entityType: ActivityEntityType.STUDENT_DISCOUNT,
          entityId: id,
          tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} revoked discount "${d.name}"`,
        },
        tx,
      );
    });

    this.events.emit(FEE_EVENTS.DISCOUNT_REVOKED, { tenantId, id });
    return this.prisma.studentDiscount.findUnique({ where: { id } });
  }
}
