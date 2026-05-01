/**
 * @file fee-structures.service.ts
 * @description Fee Structures service — CRUD, locking, versioning, and the
 *   curriculum-driven `createQuickMatrix()` bulk creator. Fees are strictly
 *   year/term-scoped. Structures in archived/financially-locked years are
 *   read-only. Locked structures require `changeReason` to update and a
 *   new version snapshot is taken.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAction,
  ActivityEntityType,
  FeeCategory,
  FeeStructureScope,
  Prisma,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { CreateQuickMatrixDto } from './dto/create-quick-matrix.dto';
import { UpsertLevelDto } from './dto/upsert-level.dto';
import { QueryFeeStructuresDto } from './dto/query-fee-structures.dto';
import { roundMoney } from '../common/fee-math.util';
import { FeeStructureVersionsService } from './fee-structure-versions.service';
import { FEE_EVENTS } from '../common/fee-events.constants';

interface RequestActor {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class FeeStructuresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly versions: FeeStructureVersionsService,
    private readonly events: EventEmitter2,
  ) {}

  private actorName(a: RequestActor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  // ═══════════════════════════════════════════════════════════════════
  //  QUICK MATRIX
  // ═══════════════════════════════════════════════════════════════════
  async createQuickMatrix(dto: CreateQuickMatrixDto, actor: RequestActor) {
    const tenantId = actor.tenantId;

    const year = await this.prisma.academicYear.findFirst({
      where: { id: dto.academicYearId, tenantId },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    if (year.status === 'ARCHIVED')
      throw new BadRequestException('Cannot create fees in an archived year');
    if (year.isFinanciallyLocked)
      throw new ForbiddenException('Academic year is financially locked');

    if (dto.curriculumId) {
      const curr = await this.prisma.curriculum.findFirst({
        where: { id: dto.curriculumId, tenantId },
      });
      if (!curr) throw new NotFoundException('Curriculum not found');
    }

    const terms = await this.prisma.academicTerm.findMany({
      where: {
        tenantId,
        academicYearId: dto.academicYearId,
        id: { in: dto.termIds },
      },
      orderBy: { termNumber: 'asc' },
    });
    if (terms.length !== dto.termIds.length)
      throw new BadRequestException('Some terms were not found in this year');
    for (const t of terms) {
      if (!t.hasFees)
        throw new BadRequestException(`Term "${t.name}" has fees disabled`);
      if (t.isFinanciallyLocked)
        throw new ForbiddenException(`Term "${t.name}" is financially locked`);
    }

    for (const row of dto.rows) {
      if (!row.classId && !row.gradeId)
        throw new BadRequestException(
          `Row "${row.label}" needs classId or gradeId`,
        );
    }

    const tuitionName = dto.tuitionLabel?.trim() || 'School Fees';
    const createdIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const term of terms) {
        const structureName = `${dto.name.trim()} — ${term.name}`;

        const dup = await tx.feeStructure.findFirst({
          where: {
            tenantId,
            academicYearId: dto.academicYearId,
            academicTermId: term.id,
            name: structureName,
          },
        });
        if (dup)
          throw new ConflictException(
            `A structure named "${structureName}" already exists for this term`,
          );

        const structure = await tx.feeStructure.create({
          data: {
            name: structureName,
            description: dto.notes ?? dto.description ?? null,
            feeType: 'TERM_WISE',
            scope: FeeStructureScope.SCHOOL_WIDE,
            isAutoBill: false,
            isRecurring: true,
            isOptional: false,
            academicYearId: dto.academicYearId,
            academicTermId: term.id,
            curriculumId: dto.curriculumId,
            tenantId,
          },
        });

        for (const row of dto.rows) {
          const tuitionAmount = row.termAmounts[term.id];
          if (tuitionAmount === undefined || tuitionAmount === null) continue;
          if (tuitionAmount < 0)
            throw new BadRequestException(
              `Negative amount in row "${row.label}" / ${term.name}`,
            );

          const extras = row.extras?.[term.id] ?? [];
          const components = [
            {
              name: tuitionName,
              amount: roundMoney(tuitionAmount),
              category: FeeCategory.ACADEMIC,
              categoryId: null as string | null,
              sortOrder: 0,
            },
            ...extras.map((e, i) => ({
              name: e.name.trim(),
              amount: roundMoney(e.amount),
              category: (e.category as FeeCategory) ?? FeeCategory.OTHER,
              categoryId: e.categoryId ?? null,
              sortOrder: i + 1,
            })),
          ];

          const total = roundMoney(
            components.reduce((s, c) => s + c.amount, 0),
          );
          if (total <= 0) continue;

          await tx.feeStructureLevel.create({
            data: {
              feeStructureId: structure.id,
              classId: row.classId ?? null,
              gradeId: row.gradeId ?? null,
              levelLabel: row.label.trim(),
              totalAmount: total,
              tenantId,
              components: {
                create: components.map((c) => ({
                  name: c.name,
                  amount: c.amount,
                  currency: 'KES',
                  isCompulsory: true,
                  category: c.category,
                  categoryId: c.categoryId,
                  sortOrder: c.sortOrder,
                  priority: 100,
                })),
              },
            },
          });
        }

        await this.versions.snapshotVersion(
          tx,
          structure.id,
          tenantId,
          actor.id,
          'Initial version (quick matrix)',
        );

        await this.activity.log(
          {
            action: ActivityAction.CREATE,
            entityType: ActivityEntityType.FEE_STRUCTURE,
            entityId: structure.id,
            tenantId,
            userId: actor.id,
            message: `${this.actorName(actor)} created matrix structure "${structure.name}"`,
            metadata: {
              termId: term.id,
              rowCount: dto.rows.length,
              source: 'quick-matrix',
              curriculumId: dto.curriculumId,
            },
          },
          tx,
        );

        createdIds.push(structure.id);
      }
    });

    for (const id of createdIds) {
      this.events.emit(FEE_EVENTS.STRUCTURE_CREATED, { tenantId, id });
    }

    return {
      created: createdIds.length,
      structureIds: createdIds,
      message: `Created ${createdIds.length} term structure(s)`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  STANDARD CREATE
  // ═══════════════════════════════════════════════════════════════════
  async create(dto: CreateFeeStructureDto, actor: RequestActor) {
    const tenantId = actor.tenantId;
    const scope = dto.scope ?? FeeStructureScope.SCHOOL_WIDE;

    const year = await this.prisma.academicYear.findFirst({
      where: { id: dto.academicYearId, tenantId },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    if (year.status === 'ARCHIVED')
      throw new BadRequestException('Cannot create fees in an archived year');
    if (year.isFinanciallyLocked)
      throw new ForbiddenException('Academic year is financially locked');

    if (dto.academicTermId) {
      const term = await this.prisma.academicTerm.findFirst({
        where: {
          id: dto.academicTermId,
          tenantId,
          academicYearId: dto.academicYearId,
        },
      });
      if (!term) throw new NotFoundException('Term not found in this year');
      if (!term.hasFees)
        throw new BadRequestException('This term has fees disabled');
      if (term.isFinanciallyLocked)
        throw new ForbiddenException('Term is financially locked');
    }

    this.validateScopeTargets(scope, dto);

    if (scope === FeeStructureScope.SCHOOL_WIDE) {
      if (!dto.levels?.length)
        throw new BadRequestException('School-wide requires levels');
      for (const lvl of dto.levels) {
        if (!lvl.classId && !lvl.gradeId)
          throw new BadRequestException(
            `Level "${lvl.levelLabel}" needs classId or gradeId`,
          );
        if (!lvl.components?.length)
          throw new BadRequestException(
            `Level "${lvl.levelLabel}" needs components`,
          );
        for (const c of lvl.components)
          if (c.amount < 0)
            throw new BadRequestException(
              `Component "${c.name}" has negative amount`,
            );
      }
    } else {
      if (!dto.components?.length)
        throw new BadRequestException('Specific scope requires components');
    }

    const dup = await this.prisma.feeStructure.findFirst({
      where: {
        tenantId,
        academicYearId: dto.academicYearId,
        academicTermId: dto.academicTermId ?? null,
        name: dto.name.trim(),
      },
    });
    if (dup)
      throw new ConflictException(
        'A structure with this name exists in this year/term',
      );

    const created = await this.prisma.$transaction(async (tx) => {
      const structure = await tx.feeStructure.create({
        data: {
          name: dto.name.trim(),
          description: dto.description,
          feeType: dto.feeType ?? 'TERM_WISE',
          scope,
          isAutoBill: dto.isAutoBill ?? false,
          isRecurring: dto.isRecurring ?? true,
          isOptional: dto.isOptional ?? false,
          academicYearId: dto.academicYearId,
          academicTermId: dto.academicTermId,
          curriculumId:
            scope === FeeStructureScope.CURRICULUM_WIDE
              ? dto.curriculumId
              : (dto.curriculumId ?? null),
          gradeId:
            scope === FeeStructureScope.GRADE_SPECIFIC ? dto.gradeId : null,
          classId:
            scope === FeeStructureScope.CLASS_SPECIFIC ? dto.classId : null,
          streamId:
            scope === FeeStructureScope.STREAM_SPECIFIC ? dto.streamId : null,
          tenantId,
        },
      });

      if (scope === FeeStructureScope.SCHOOL_WIDE) {
        for (const lvl of dto.levels!) {
          const total = roundMoney(
            lvl.components.reduce((s, c) => s + c.amount, 0),
          );
          await tx.feeStructureLevel.create({
            data: {
              feeStructureId: structure.id,
              classId: lvl.classId,
              gradeId: lvl.gradeId,
              levelLabel: lvl.levelLabel.trim(),
              totalAmount: total,
              tenantId,
              components: {
                create: lvl.components.map((c, i) => ({
                  name: c.name.trim(),
                  description: c.description,
                  amount: roundMoney(c.amount),
                  currency: c.currency ?? 'KES',
                  isCompulsory: c.isCompulsory ?? true,
                  category: c.category ?? 'ACADEMIC',
                  categoryId: c.categoryId,
                  dueDate: c.dueDate ? new Date(c.dueDate) : null,
                  lateFee: c.lateFee ?? 0,
                  sortOrder: c.sortOrder ?? i,
                  priority: c.priority ?? 100,
                })),
              },
            },
          });
        }
      } else {
        await tx.feeComponent.createMany({
          data: dto.components!.map((c, i) => ({
            feeStructureId: structure.id,
            name: c.name.trim(),
            description: c.description,
            amount: roundMoney(c.amount),
            currency: c.currency ?? 'KES',
            isCompulsory: c.isCompulsory ?? true,
            category: c.category ?? 'ACADEMIC',
            categoryId: c.categoryId,
            dueDate: c.dueDate ? new Date(c.dueDate) : null,
            lateFee: c.lateFee ?? 0,
            sortOrder: c.sortOrder ?? i,
            priority: c.priority ?? 100,
          })),
        });
      }

      await this.versions.snapshotVersion(
        tx,
        structure.id,
        tenantId,
        actor.id,
        'Initial version',
      );

      await this.activity.log(
        {
          action: ActivityAction.CREATE,
          entityType: ActivityEntityType.FEE_STRUCTURE,
          entityId: structure.id,
          tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} created ${scope} structure "${structure.name}"`,
          metadata: {
            scope,
            levelCount: dto.levels?.length ?? 0,
            componentCount: dto.components?.length ?? 0,
          },
        },
        tx,
      );
      return structure;
    });

    this.events.emit(FEE_EVENTS.STRUCTURE_CREATED, {
      tenantId,
      id: created.id,
      scope,
    });

    return this.findOne(created.id, actor);
  }

  private validateScopeTargets(scope: FeeStructureScope, dto: any) {
    switch (scope) {
      case FeeStructureScope.STREAM_SPECIFIC:
        if (!dto.streamId)
          throw new BadRequestException(
            'streamId required for STREAM_SPECIFIC',
          );
        break;
      case FeeStructureScope.CLASS_SPECIFIC:
        if (!dto.classId)
          throw new BadRequestException('classId required for CLASS_SPECIFIC');
        break;
      case FeeStructureScope.GRADE_SPECIFIC:
        if (!dto.gradeId)
          throw new BadRequestException('gradeId required for GRADE_SPECIFIC');
        break;
      case FeeStructureScope.CURRICULUM_WIDE:
        if (!dto.curriculumId)
          throw new BadRequestException(
            'curriculumId required for CURRICULUM_WIDE',
          );
        break;
      default:
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  LIST / DETAIL
  // ═══════════════════════════════════════════════════════════════════
  async findAll(query: QueryFeeStructuresDto, actor: RequestActor) {
    const {
      page = 1,
      limit = 10,
      search,
      academicYearId,
      academicTermId,
      curriculumId,
      gradeId,
      classId,
      streamId,
      scope,
      feeType,
      isLocked,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.FeeStructureWhereInput = {
      tenantId: actor.tenantId,
      ...(academicYearId && { academicYearId }),
      ...(academicTermId && { academicTermId }),
      ...(curriculumId && { curriculumId }),
      ...(gradeId && { gradeId }),
      ...(classId && { classId }),
      ...(streamId && { streamId }),
      ...(scope && { scope }),
      ...(feeType && { feeType }),
      ...(isLocked !== undefined && { isLocked: isLocked === 'true' }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.feeStructure.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          feeComponents: { orderBy: { sortOrder: 'asc' } },
          levels: {
            include: {
              components: { orderBy: { sortOrder: 'asc' } },
              class: { select: { id: true, name: true, gradeId: true } },
            },
            orderBy: [{ levelLabel: 'asc' }],
          },
          academicYear: { select: { id: true, name: true, status: true } },
          academicTerm: {
            select: { id: true, name: true, termNumber: true, isActive: true },
          },
          curriculum: { select: { id: true, name: true } },
          grade: { select: { id: true, name: true, levelOrder: true } },
          class: { select: { id: true, name: true } },
          stream: { select: { id: true, name: true } },
          _count: {
            select: { studentFees: true, levels: true, versions: true },
          },
        },
      }),
      this.prisma.feeStructure.count({ where }),
    ]);

    const enriched = data.map((s) => {
      const totalAmount =
        s.scope === 'SCHOOL_WIDE'
          ? roundMoney(s.levels.reduce((sum, l) => sum + l.totalAmount, 0))
          : roundMoney(s.feeComponents.reduce((sum, c) => sum + c.amount, 0));
      return { ...s, totalAmount };
    });

    return {
      data: enriched,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, actor: RequestActor) {
    const s = await this.prisma.feeStructure.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        feeComponents: { orderBy: { sortOrder: 'asc' } },
        levels: {
          orderBy: [{ levelLabel: 'asc' }],
          include: {
            components: { orderBy: { sortOrder: 'asc' } },
            class: { select: { id: true, name: true, gradeId: true } },
          },
        },
        academicYear: true,
        academicTerm: true,
        class: true,
        grade: true,
        stream: true,
        curriculum: true,
        _count: {
          select: { studentFees: true, levels: true, versions: true },
        },
      },
    });
    if (!s) throw new NotFoundException('Fee structure not found');

    const [paymentsCount, totalCollected] = await Promise.all([
      this.prisma.feePayment.count({
        where: {
          tenantId: actor.tenantId,
          studentFee: { feeStructureId: id },
          status: 'COMPLETED',
        },
      }),
      this.prisma.feePayment.aggregate({
        where: {
          tenantId: actor.tenantId,
          studentFee: { feeStructureId: id },
          status: 'COMPLETED',
        },
        _sum: { amount: true },
      }),
    ]);

    const totalAmount =
      s.scope === 'SCHOOL_WIDE'
        ? roundMoney(s.levels.reduce((sum, l) => sum + l.totalAmount, 0))
        : roundMoney(s.feeComponents.reduce((sum, c) => sum + c.amount, 0));

    return {
      ...s,
      totalAmount,
      stats: {
        studentCount: s._count.studentFees,
        levelCount: s._count.levels,
        versionCount: s._count.versions,
        paymentsCount,
        totalCollected: roundMoney(totalCollected._sum.amount ?? 0),
      },
    };
  }

  async update(id: string, dto: UpdateFeeStructureDto, actor: RequestActor) {
    const tenantId = actor.tenantId;
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.feeStructure.findFirst({
        where: { id, tenantId },
      });
      if (!current) throw new NotFoundException('Fee structure not found');

      const [studentFees, payments] = await Promise.all([
        tx.studentFee.count({ where: { feeStructureId: id } }),
        tx.feePayment.count({
          where: { studentFee: { feeStructureId: id } },
        }),
      ]);

      if (current.isLocked || studentFees > 0 || payments > 0) {
        if (!dto.changeReason) {
          throw new ForbiddenException(
            'Structure is locked. Provide changeReason to create a new version.',
          );
        }
        await this.versions.snapshotVersion(
          tx,
          id,
          tenantId,
          actor.id,
          dto.changeReason,
        );
      }

      await tx.feeStructure.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description,
          feeType: dto.feeType,
          isAutoBill: dto.isAutoBill,
          isRecurring: dto.isRecurring,
          isOptional: dto.isOptional,
        },
      });

      await this.activity.log(
        {
          action: ActivityAction.UPDATE,
          entityType: ActivityEntityType.FEE_STRUCTURE,
          entityId: id,
          tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} updated structure "${dto.name ?? current.name}"`,
          metadata: { changeReason: dto.changeReason },
        },
        tx,
      );
    });

    this.events.emit(FEE_EVENTS.STRUCTURE_UPDATED, { tenantId, id });
    return this.findOne(id, actor);
  }

  async upsertLevel(
    structureId: string,
    dto: UpsertLevelDto,
    actor: RequestActor,
  ) {
    const tenantId = actor.tenantId;
    await this.prisma.$transaction(async (tx) => {
      const s = await tx.feeStructure.findFirst({
        where: { id: structureId, tenantId },
      });
      if (!s) throw new NotFoundException('Fee structure not found');
      if (s.scope !== 'SCHOOL_WIDE')
        throw new BadRequestException(
          'Levels only apply to SCHOOL_WIDE structures',
        );
      if (s.isLocked) throw new ForbiddenException('Structure is locked');

      if (!dto.classId && !dto.gradeId)
        throw new BadRequestException('Either classId or gradeId required');

      const total = roundMoney(
        dto.components.reduce((sum, c) => sum + c.amount, 0),
      );

      const existing = await tx.feeStructureLevel.findFirst({
        where: {
          feeStructureId: structureId,
          OR: [
            dto.classId ? { classId: dto.classId } : undefined,
            dto.gradeId
              ? { gradeId: dto.gradeId, levelLabel: dto.levelLabel.trim() }
              : undefined,
          ].filter(Boolean) as any[],
        },
      });

      if (existing) {
        await tx.feeLevelComponent.deleteMany({
          where: { feeStructureLevelId: existing.id },
        });
        await tx.feeStructureLevel.update({
          where: { id: existing.id },
          data: {
            levelLabel: dto.levelLabel.trim(),
            totalAmount: total,
            components: {
              create: dto.components.map((c, i) => ({
                name: c.name.trim(),
                description: c.description,
                amount: roundMoney(c.amount),
                currency: c.currency ?? 'KES',
                isCompulsory: c.isCompulsory ?? true,
                category: c.category ?? 'ACADEMIC',
                categoryId: c.categoryId,
                dueDate: c.dueDate ? new Date(c.dueDate) : null,
                lateFee: c.lateFee ?? 0,
                sortOrder: c.sortOrder ?? i,
                priority: c.priority ?? 100,
              })),
            },
          },
        });
      } else {
        await tx.feeStructureLevel.create({
          data: {
            feeStructureId: structureId,
            classId: dto.classId,
            gradeId: dto.gradeId,
            levelLabel: dto.levelLabel.trim(),
            totalAmount: total,
            tenantId,
            components: {
              create: dto.components.map((c, i) => ({
                name: c.name.trim(),
                description: c.description,
                amount: roundMoney(c.amount),
                currency: c.currency ?? 'KES',
                isCompulsory: c.isCompulsory ?? true,
                category: c.category ?? 'ACADEMIC',
                categoryId: c.categoryId,
                dueDate: c.dueDate ? new Date(c.dueDate) : null,
                lateFee: c.lateFee ?? 0,
                sortOrder: c.sortOrder ?? i,
                priority: c.priority ?? 100,
              })),
            },
          },
        });
      }

      await this.activity.log(
        {
          action: ActivityAction.UPDATE,
          entityType: ActivityEntityType.FEE_STRUCTURE_LEVEL,
          entityId: structureId,
          tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} configured level "${dto.levelLabel}"`,
          metadata: { total, componentCount: dto.components.length },
        },
        tx,
      );
    });
    return this.findOne(structureId, actor);
  }

  async removeLevel(structureId: string, levelId: string, actor: RequestActor) {
    await this.prisma.$transaction(async (tx) => {
      const s = await tx.feeStructure.findFirst({
        where: { id: structureId, tenantId: actor.tenantId },
      });
      if (!s) throw new NotFoundException('Fee structure not found');
      if (s.isLocked) throw new ForbiddenException('Structure is locked');
      await tx.feeStructureLevel.delete({ where: { id: levelId } });
    });
    return this.findOne(structureId, actor);
  }

  async lock(id: string, reason: string | undefined, actor: RequestActor) {
    await this.prisma.$transaction(async (tx) => {
      const s = await tx.feeStructure.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!s) throw new NotFoundException('Fee structure not found');
      if (s.isLocked) return;
      await tx.feeStructure.update({
        where: { id },
        data: {
          isLocked: true,
          lockedAt: new Date(),
          lockedReason: reason ?? 'Manually locked',
        },
      });
      await this.activity.log(
        {
          action: ActivityAction.STATUS_CHANGE,
          entityType: ActivityEntityType.FEE_STRUCTURE,
          entityId: id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} locked structure "${s.name}"`,
          metadata: { reason },
        },
        tx,
      );
    });
    this.events.emit(FEE_EVENTS.STRUCTURE_LOCKED, {
      tenantId: actor.tenantId,
      id,
    });
    return this.findOne(id, actor);
  }

  async remove(id: string, actor: RequestActor) {
    return this.prisma.$transaction(async (tx) => {
      const s = await tx.feeStructure.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!s) throw new NotFoundException('Fee structure not found');
      const [sf, py] = await Promise.all([
        tx.studentFee.count({ where: { feeStructureId: id } }),
        tx.feePayment.count({ where: { studentFee: { feeStructureId: id } } }),
      ]);
      if (sf > 0 || py > 0)
        throw new ForbiddenException(
          'Cannot delete: student fees or payments exist',
        );
      await tx.feeStructure.delete({ where: { id } });
      await this.activity.log(
        {
          action: ActivityAction.DELETE,
          entityType: ActivityEntityType.FEE_STRUCTURE,
          entityId: id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} deleted structure "${s.name}"`,
        },
        tx,
      );
      this.events.emit(FEE_EVENTS.STRUCTURE_DELETED, {
        tenantId: actor.tenantId,
        id,
      });
      return { message: 'Fee structure deleted' };
    });
  }
}
