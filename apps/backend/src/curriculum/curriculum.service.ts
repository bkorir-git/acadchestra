/**
 * @file curriculum.service.ts
 * @module curriculum
 * @description Per-tenant curriculum management. Three creation paths:
 *   1. ADOPT a template     — copies grades from CurriculumTemplate
 *   2. CREATE custom        — admin defines grades from scratch
 *   3. CLONE another        — duplicate an existing tenant curriculum
 *
 *   Grades are managed independently after creation — admin can rename,
 *   reorder, add, or remove without touching the template.
 *
 *   A tenant can have multiple curriculums (e.g. CBC + IGCSE for hybrid schools).
 *   Exactly one is `isDefault = true` at any time.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, ActivityEntityType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ActivityService } from '../common/activity/activity.service';
import {
  AdoptCurriculumTemplateDto,
  CreateCurriculumDto,
  CreateGradeDto,
  UpdateCurriculumDto,
  UpdateGradeDto,
} from './dto/curriculum.dto';
import { RequestActor } from '../common/types/request-actor.type';

@Injectable()
export class CurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  private actorName(a: RequestActor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System';
  }

  // ─────────────────────────── READ
  async list(tenantId: string) {
    return this.prisma.curriculum.findMany({
      where: { tenantId },
      include: {
        grades: { orderBy: { levelOrder: 'asc' } },
        template: { select: { id: true, code: true, name: true } },
        _count: { select: { grades: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, tenantId: string) {
    const c = await this.prisma.curriculum.findFirst({
      where: { id, tenantId },
      include: {
        grades: { orderBy: { levelOrder: 'asc' } },
        template: true,
      },
    });
    if (!c) throw new NotFoundException('Curriculum not found');
    return c;
  }

  /** The tenant's default curriculum, if any. */
  async getDefault(tenantId: string) {
    return this.prisma.curriculum.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
      include: { grades: { orderBy: { levelOrder: 'asc' } } },
    });
  }

  // ─────────────────────────── CREATE — ADOPT TEMPLATE
  async adoptTemplate(actor: RequestActor, dto: AdoptCurriculumTemplateDto) {
    const template = await this.prisma.curriculumTemplate.findUnique({
      where: { id: dto.templateId },
      include: { grades: { orderBy: { levelOrder: 'asc' } } },
    });
    if (!template) throw new NotFoundException('Template not found');

    // Slice to maxLevelOrder if specified (e.g. "CBC up to Grade 6 only")
    const grades = dto.maxLevelOrder
      ? template.grades.filter((g) => g.levelOrder <= dto.maxLevelOrder!)
      : template.grades;

    if (grades.length === 0) {
      throw new BadRequestException(
        `Template "${template.name}" has no grades within the requested range`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Conflict check
      const dup = await tx.curriculum.findFirst({
        where: { tenantId: actor.tenantId, name: dto.name.trim() },
      });
      if (dup) {
        throw new ConflictException(
          `A curriculum named "${dto.name}" already exists`,
        );
      }

      // If setAsDefault, clear any existing default
      if (dto.setAsDefault) {
        await tx.curriculum.updateMany({
          where: { tenantId: actor.tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const curriculum = await tx.curriculum.create({
        data: {
          tenantId: actor.tenantId,
          name: dto.name.trim(),
          code: dto.code?.trim() ?? template.code,
          description: dto.description ?? template.description,
          templateId: template.id,
          isActive: true,
          isDefault:
            dto.setAsDefault ??
            // First curriculum becomes default automatically
            !(await tx.curriculum.count({
              where: { tenantId: actor.tenantId },
            })),
          grades: {
            create: grades.map((g) => ({
              tenantId: actor.tenantId,
              name: g.name,
              displayName: g.displayName,
              levelOrder: g.levelOrder,
            })),
          },
        },
        include: { grades: { orderBy: { levelOrder: 'asc' } } },
      });

      await this.activity.log(
        {
          action: ActivityAction.CURRICULUM_ADOPTED,
          entityType: ActivityEntityType.CURRICULUM,
          entityId: curriculum.id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} adopted "${template.name}" → "${curriculum.name}"`,
          metadata: {
            templateId: template.id,
            templateCode: template.code,
            gradesCopied: grades.length,
            maxLevelOrder: dto.maxLevelOrder ?? null,
          },
        },
        tx,
      );

      return curriculum;
    });
  }

  // ─────────────────────────── CREATE — CUSTOM
  async createCustom(actor: RequestActor, dto: CreateCurriculumDto) {
    if (!dto.grades?.length) {
      throw new BadRequestException(
        'Custom curriculum requires at least one grade',
      );
    }
    // Validate uniqueness of levelOrder + name within the dto
    const orders = new Set<number>();
    const names = new Set<string>();
    for (const g of dto.grades) {
      if (orders.has(g.levelOrder))
        throw new BadRequestException(
          `Duplicate levelOrder ${g.levelOrder} in grades`,
        );
      if (names.has(g.name.toLowerCase()))
        throw new BadRequestException(`Duplicate grade name "${g.name}"`);
      orders.add(g.levelOrder);
      names.add(g.name.toLowerCase());
    }

    return this.prisma.$transaction(async (tx) => {
      const dup = await tx.curriculum.findFirst({
        where: { tenantId: actor.tenantId, name: dto.name.trim() },
      });
      if (dup) throw new ConflictException('Curriculum name already exists');

      if (dto.isDefault) {
        await tx.curriculum.updateMany({
          where: { tenantId: actor.tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const curriculum = await tx.curriculum.create({
        data: {
          tenantId: actor.tenantId,
          name: dto.name.trim(),
          code: dto.code?.trim(),
          description: dto.description,
          isActive: true,
          isDefault:
            dto.isDefault ??
            !(await tx.curriculum.count({
              where: { tenantId: actor.tenantId },
            })),
          grades: {
            create: dto.grades.map((g) => ({
              tenantId: actor.tenantId,
              name: g.name.trim(),
              displayName: g.displayName,
              levelOrder: g.levelOrder,
            })),
          },
        },
        include: { grades: { orderBy: { levelOrder: 'asc' } } },
      });

      await this.activity.log(
        {
          action: ActivityAction.CREATE,
          entityType: ActivityEntityType.CURRICULUM,
          entityId: curriculum.id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} created custom curriculum "${curriculum.name}" with ${dto.grades.length} grades`,
        },
        tx,
      );

      return curriculum;
    });
  }

  // ─────────────────────────── UPDATE
  async update(id: string, actor: RequestActor, dto: UpdateCurriculumDto) {
    await this.findOne(id, actor.tenantId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.curriculum.updateMany({
          where: {
            tenantId: actor.tenantId,
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false },
        });
      }
      return tx.curriculum.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          code: dto.code?.trim(),
          description: dto.description,
          isActive: dto.isActive,
          isDefault: dto.isDefault,
        },
        include: { grades: { orderBy: { levelOrder: 'asc' } } },
      });
    });
  }

  // ─────────────────────────── GRADE MANAGEMENT
  async addGrade(
    curriculumId: string,
    actor: RequestActor,
    dto: CreateGradeDto,
  ) {
    const curriculum = await this.findOne(curriculumId, actor.tenantId);

    // Conflict check
    const dup = await this.prisma.grade.findFirst({
      where: {
        tenantId: actor.tenantId,
        curriculumId,
        OR: [{ name: dto.name.trim() }, { levelOrder: dto.levelOrder }],
      },
    });
    if (dup) {
      throw new ConflictException(
        'Grade with that name or levelOrder already exists',
      );
    }

    return this.prisma.grade.create({
      data: {
        tenantId: actor.tenantId,
        curriculumId,
        name: dto.name.trim(),
        displayName: dto.displayName,
        levelOrder: dto.levelOrder,
      },
    });
  }

  async updateGrade(
    curriculumId: string,
    gradeId: string,
    actor: RequestActor,
    dto: UpdateGradeDto,
  ) {
    const grade = await this.prisma.grade.findFirst({
      where: { id: gradeId, curriculumId, tenantId: actor.tenantId },
    });
    if (!grade) throw new NotFoundException('Grade not found');

    return this.prisma.grade.update({
      where: { id: gradeId },
      data: {
        name: dto.name?.trim(),
        displayName: dto.displayName,
        levelOrder: dto.levelOrder,
      },
    });
  }

  async removeGrade(
    curriculumId: string,
    gradeId: string,
    actor: RequestActor,
  ) {
    const grade = await this.prisma.grade.findFirst({
      where: { id: gradeId, curriculumId, tenantId: actor.tenantId },
      include: { _count: { select: { classes: true } } },
    });
    if (!grade) throw new NotFoundException('Grade not found');
    if (grade._count.classes > 0) {
      throw new BadRequestException(
        `Cannot delete grade "${grade.name}" — ${grade._count.classes} class(es) reference it`,
      );
    }
    await this.prisma.grade.delete({ where: { id: gradeId } });
    return { deleted: true };
  }

  // ─────────────────────────── DELETE
  async remove(id: string, actor: RequestActor) {
    const c = await this.findOne(id, actor.tenantId);
    const classCount = await this.prisma.class.count({
      where: { tenantId: actor.tenantId, grade: { curriculumId: id } },
    });
    if (classCount > 0) {
      throw new BadRequestException(
        `Cannot delete: ${classCount} class(es) reference grades in this curriculum`,
      );
    }
    await this.prisma.curriculum.delete({ where: { id } });
    return { deleted: true, name: c.name };
  }
}
