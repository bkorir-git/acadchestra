/**
 * @file fee-payment-rules.service.ts
 * @description CRUD service for FeePaymentRule. Rules express the cadence
 *   parents are expected to pay ("by end of week 2 of T1, 50% paid"). The
 *   scheduler reads these rules to fire `fees.fee.due_soon` and
 *   `fees.payment-rule.violated` events.
 */

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, ActivityEntityType, Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { CreatePaymentRuleDto } from './dto/create-payment-rule.dto';
import { UpdatePaymentRuleDto } from './dto/update-payment-rule.dto';
import { FEE_EVENTS } from '../common/fee-events.constants';

interface Actor {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class FeePaymentRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly events: EventEmitter2,
  ) {}

  private actorName(a: Actor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  async list(actor: Actor, termId?: string, isActive?: string) {
    const where: Prisma.FeePaymentRuleWhereInput = {
      tenantId: actor.tenantId,
      ...(termId !== undefined && { termId: termId || null }),
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
    };
    return this.prisma.feePaymentRule.findMany({
      where,
      orderBy: [{ termId: 'asc' }, { byWeek: 'asc' }],
      include: { term: { select: { id: true, name: true, termNumber: true } } },
    });
  }

  async findOne(id: string, actor: Actor) {
    const rule = await this.prisma.feePaymentRule.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { term: true },
    });
    if (!rule) throw new NotFoundException('Payment rule not found');
    return rule;
  }

  async create(dto: CreatePaymentRuleDto, actor: Actor) {
    if (dto.termId) {
      const term = await this.prisma.academicTerm.findFirst({
        where: { id: dto.termId, tenantId: actor.tenantId },
      });
      if (!term) throw new NotFoundException('Term not found');
    }

    const dup = await this.prisma.feePaymentRule.findFirst({
      where: {
        tenantId: actor.tenantId,
        termId: dto.termId ?? null,
        byWeek: dto.byWeek,
        minPercentage: dto.minPercentage,
      },
    });
    if (dup)
      throw new ConflictException(
        'An identical rule (week + %) already exists for this term',
      );

    const created = await this.prisma.feePaymentRule.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        description: dto.description,
        termId: dto.termId,
        byWeek: dto.byWeek,
        minPercentage: dto.minPercentage,
        lateFeePerDay: dto.lateFeePerDay ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.activity.log({
      action: ActivityAction.CREATE,
      entityType: ActivityEntityType.FEE_PAYMENT_RULE,
      entityId: created.id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} created rule "${created.name}" — ${created.minPercentage}% by week ${created.byWeek}`,
    });

    this.events.emit(FEE_EVENTS.PAYMENT_RULE_CREATED, {
      tenantId: actor.tenantId,
      id: created.id,
    });

    return created;
  }

  async update(id: string, dto: UpdatePaymentRuleDto, actor: Actor) {
    const current = await this.findOne(id, actor);

    if (dto.termId !== undefined && dto.termId) {
      const term = await this.prisma.academicTerm.findFirst({
        where: { id: dto.termId, tenantId: actor.tenantId },
      });
      if (!term) throw new NotFoundException('Term not found');
    }

    const updated = await this.prisma.feePaymentRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.termId !== undefined && { termId: dto.termId || null }),
        ...(dto.byWeek !== undefined && { byWeek: dto.byWeek }),
        ...(dto.minPercentage !== undefined && {
          minPercentage: dto.minPercentage,
        }),
        ...(dto.lateFeePerDay !== undefined && {
          lateFeePerDay: dto.lateFeePerDay,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.activity.log({
      action: ActivityAction.UPDATE,
      entityType: ActivityEntityType.FEE_PAYMENT_RULE,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} updated rule "${current.name}"`,
    });

    this.events.emit(FEE_EVENTS.PAYMENT_RULE_UPDATED, {
      tenantId: actor.tenantId,
      id: updated.id,
    });

    return updated;
  }

  async remove(id: string, actor: Actor) {
    const current = await this.findOne(id, actor);
    await this.prisma.feePaymentRule.delete({ where: { id } });
    await this.activity.log({
      action: ActivityAction.DELETE,
      entityType: ActivityEntityType.FEE_PAYMENT_RULE,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} deleted rule "${current.name}"`,
    });
    return { deleted: true };
  }
}
