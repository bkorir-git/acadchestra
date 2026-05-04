/**
 * @file fee-categories.service.ts
 * @description Custom fee categories — admin-managed groupings beyond the
 *   built-in `FeeCategory` enum. Each category is bound to a `baseCategory`
 *   (the system enum) so reports can roll up. Components reference a
 *   category via `categoryId`. Deletion blocked when in use.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, ActivityEntityType, Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { CreateFeeCategoryDto } from './dto/create-category.dto';
import { UpdateFeeCategoryDto } from './dto/update-category.dto';
import { slugify } from '../common/fee-math.util';
import { FEE_EVENTS } from '../common/fee-events.constants';

interface Actor {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class FeeCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly events: EventEmitter2,
  ) {}

  private actorName(a: Actor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  async list(actor: Actor, query: { search?: string; isActive?: string } = {}) {
    const where: Prisma.FeeCategoryEntityWhereInput = {
      tenantId: actor.tenantId,
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { code: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
      ...(query.isActive !== undefined && {
        isActive: query.isActive === 'true',
      }),
    };
    const items = await this.prisma.feeCategoryEntity.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { components: true } } },
    });
    return items;
  }

  async findOne(id: string, actor: Actor) {
    const item = await this.prisma.feeCategoryEntity.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { _count: { select: { components: true } } },
    });
    if (!item) throw new NotFoundException('Category not found');
    return item;
  }

  async create(dto: CreateFeeCategoryDto, actor: Actor) {
    const code = (dto.code ?? slugify(dto.name)).slice(0, 60);
    if (!code) throw new BadRequestException('Could not derive category code');

    const dup = await this.prisma.feeCategoryEntity.findFirst({
      where: { tenantId: actor.tenantId, code },
    });
    if (dup) throw new ConflictException(`Category code "${code}" exists`);

    const created = await this.prisma.feeCategoryEntity.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name.trim(),
        code,
        baseCategory: dto.baseCategory,
        description: dto.description,
        color: dto.color,
        icon: dto.icon,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.activity.log({
      action: ActivityAction.CREATE,
      entityType: ActivityEntityType.CONFIG,
      entityId: created.id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} created fee category "${created.name}"`,
      metadata: { code: created.code, baseCategory: created.baseCategory },
    });

    this.events.emit(FEE_EVENTS.CATEGORY_CREATED, {
      tenantId: actor.tenantId,
      id: created.id,
    });

    return created;
  }

  async update(id: string, dto: UpdateFeeCategoryDto, actor: Actor) {
    const current = await this.findOne(id, actor);

    // Forbid base-category change once components exist
    if (
      dto.baseCategory &&
      dto.baseCategory !== current.baseCategory &&
      current._count.components > 0
    ) {
      throw new BadRequestException(
        'Cannot change baseCategory of a category with attached components',
      );
    }

    const code = dto.code
      ? slugify(dto.code).slice(0, 60)
      : dto.name
        ? slugify(dto.name).slice(0, 60)
        : undefined;

    if (code && code !== current.code) {
      const dup = await this.prisma.feeCategoryEntity.findFirst({
        where: { tenantId: actor.tenantId, code, id: { not: id } },
      });
      if (dup) throw new ConflictException(`Category code "${code}" exists`);
    }

    const updated = await this.prisma.feeCategoryEntity.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(code && { code }),
        ...(dto.baseCategory && { baseCategory: dto.baseCategory }),
        description: dto.description ?? current.description,
        color: dto.color ?? current.color,
        icon: dto.icon ?? current.icon,
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });

    await this.activity.log({
      action: ActivityAction.UPDATE,
      entityType: ActivityEntityType.CONFIG,
      entityId: updated.id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} updated fee category "${updated.name}"`,
    });

    this.events.emit(FEE_EVENTS.CATEGORY_UPDATED, {
      tenantId: actor.tenantId,
      id: updated.id,
    });

    return updated;
  }

  async remove(id: string, actor: Actor) {
    const current = await this.findOne(id, actor);
    if (current._count.components > 0) {
      throw new BadRequestException(
        `Cannot delete category "${current.name}" — it has ${current._count.components} component(s). Deactivate instead.`,
      );
    }
    await this.prisma.feeCategoryEntity.delete({ where: { id } });
    await this.activity.log({
      action: ActivityAction.DELETE,
      entityType: ActivityEntityType.CONFIG,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} deleted fee category "${current.name}"`,
    });
    this.events.emit(FEE_EVENTS.CATEGORY_DELETED, {
      tenantId: actor.tenantId,
      id,
    });
    return { deleted: true };
  }

  /**
   * Ensure baseline categories exist on first use.
   */
  async seedDefaults(actor: Actor) {
    const defaults: Array<{
      name: string;
      code: string;
      baseCategory:
        | 'ACADEMIC'
        | 'FACILITIES'
        | 'TRANSPORT'
        | 'HOSTEL'
        | 'MEALS'
        | 'ACTIVITIES'
        | 'TECHNOLOGY'
        | 'UNIFORM'
        | 'OTHER';
      color: string;
      icon?: string;
    }> = [
      {
        name: 'Tuition',
        code: 'tuition',
        baseCategory: 'ACADEMIC',
        color: '#3b82f6',
      },
      {
        name: 'Examination',
        code: 'examination',
        baseCategory: 'ACADEMIC',
        color: '#6366f1',
      },
      {
        name: 'Transport',
        code: 'transport',
        baseCategory: 'TRANSPORT',
        color: '#f59e0b',
      },
      {
        name: 'Boarding',
        code: 'boarding',
        baseCategory: 'HOSTEL',
        color: '#a855f7',
      },
      { name: 'Meals', code: 'meals', baseCategory: 'MEALS', color: '#10b981' },
      {
        name: 'Activities',
        code: 'activities',
        baseCategory: 'ACTIVITIES',
        color: '#ec4899',
      },
      {
        name: 'Technology',
        code: 'technology',
        baseCategory: 'TECHNOLOGY',
        color: '#06b6d4',
      },
      {
        name: 'Uniform',
        code: 'uniform',
        baseCategory: 'UNIFORM',
        color: '#f97316',
      },
      { name: 'Other', code: 'other', baseCategory: 'OTHER', color: '#6b7280' },
    ];
    let created = 0;
    for (const d of defaults) {
      const exists = await this.prisma.feeCategoryEntity.findFirst({
        where: { tenantId: actor.tenantId, code: d.code },
      });
      if (exists) continue;
      await this.prisma.feeCategoryEntity.create({
        data: {
          tenantId: actor.tenantId,
          name: d.name,
          code: d.code,
          baseCategory: d.baseCategory,
          color: d.color,
          isActive: true,
          sortOrder: created,
        },
      });
      created++;
    }
    return { created };
  }
}
