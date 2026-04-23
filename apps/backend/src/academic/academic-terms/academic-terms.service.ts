/**
 * @service AcademicTermsService
 * @description Full lifecycle service for academic terms:
 *   - CRUD with date, overlap, uniqueness validation
 *   - Bulk create in one transaction
 *   - Activate (date-driven, single-active-term invariant)
 *   - Complete / Deactivate
 *   - Academic + Financial locks
 *   - AcademicPeriod sync
 *   - Full activity + event emission
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcademicPeriodType,
  ActivityAction,
  ActivityEntityType,
  Prisma,
  TermStructure,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { EVENTS } from '../../common/events/events.constants';
import {
  ActivateTermDto,
  BulkCreateAcademicTermsDto,
  CreateAcademicTermDto,
  LockTermDto,
  UpdateAcademicTermDto,
} from './dto/academic-term.dto';

export interface RequestActor {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class AcademicTermsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─────────────────────────── HELPERS
  private actorName(a: RequestActor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  private startOfDay(v: string | Date) {
    const d = new Date(v);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(v: string | Date) {
    const d = new Date(v);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private async ensureYearMutableForStructuralChange(
    tx: Prisma.TransactionClient,
    academicYearId: string,
    tenantId: string,
  ) {
    const year = await tx.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      include: {
        _count: { select: { classes: true, feeStructures: true } },
      },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    if (year.isLocked) {
      throw new BadRequestException('Academic year is locked');
    }
    return year;
  }

  private async validateWindow(
    tx: Prisma.TransactionClient,
    tenantId: string,
    academicYearId: string,
    termId: string | null,
    startDate: Date,
    endDate: Date,
    termNumber?: number,
    name?: string,
    shortName?: string,
  ) {
    if (startDate >= endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const year = await tx.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    if (startDate < year.startDate || endDate > year.endDate) {
      throw new BadRequestException(
        'Term must be fully contained within the academic year',
      );
    }

    const overlap = await tx.academicTerm.findFirst({
      where: {
        tenantId,
        academicYearId,
        id: termId ? { not: termId } : undefined,
        OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }],
      },
    });
    if (overlap) {
      throw new BadRequestException(
        `Term dates overlap with "${overlap.name}"`,
      );
    }

    if (name?.trim()) {
      const dupName = await tx.academicTerm.findFirst({
        where: {
          tenantId,
          academicYearId,
          id: termId ? { not: termId } : undefined,
          name: name.trim(),
        },
      });
      if (dupName) throw new ConflictException('Term name already exists');
    }

    if (shortName?.trim()) {
      const dupShort = await tx.academicTerm.findFirst({
        where: {
          tenantId,
          academicYearId,
          id: termId ? { not: termId } : undefined,
          shortName: shortName.trim(),
        },
      });
      if (dupShort)
        throw new ConflictException('Term short name already exists');
    }

    if (termNumber) {
      const dupNum = await tx.academicTerm.findFirst({
        where: {
          tenantId,
          academicYearId,
          id: termId ? { not: termId } : undefined,
          termNumber,
        },
      });
      if (dupNum)
        throw new ConflictException('Term number already exists in the year');
    }
  }

  // ─────────────────────────── READ
  async findAll(actor: RequestActor, academicYearId?: string) {
    return this.prisma.academicTerm.findMany({
      where: {
        tenantId: actor.tenantId,
        academicYearId: academicYearId || undefined,
      },
      include: {
        academicYear: {
          select: {
            id: true,
            name: true,
            isCurrent: true,
            startDate: true,
            endDate: true,
          },
        },
        _count: { select: { feeStructures: true, examinations: true } },
      },
      orderBy: [{ academicYear: { startDate: 'desc' } }, { termNumber: 'asc' }],
    });
  }

  async findOne(id: string, actor: RequestActor) {
    const term = await this.prisma.academicTerm.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        academicYear: true,
        feeStructures: true,
        examinations: true,
        _count: { select: { feeStructures: true, examinations: true } },
      },
    });
    if (!term) throw new NotFoundException('Academic term not found');
    return term;
  }

  /** Returns the currently-active term for the tenant, if any. */
  async findCurrent(actor: RequestActor) {
    const active = await this.prisma.academicTerm.findFirst({
      where: { tenantId: actor.tenantId, isActive: true },
      include: { academicYear: true },
    });
    if (active) return active;

    // Fallback: find term whose window contains today
    const now = new Date();
    return this.prisma.academicTerm.findFirst({
      where: {
        tenantId: actor.tenantId,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: { academicYear: true },
    });
  }

  // ─────────────────────────── CREATE
  async create(dto: CreateAcademicTermDto, actor: RequestActor) {
    const termId = await this.prisma.$transaction(async (tx) => {
      const year = await this.ensureYearMutableForStructuralChange(
        tx,
        dto.academicYearId,
        actor.tenantId,
      );

      const startDate = this.startOfDay(dto.startDate);
      const endDate = this.endOfDay(dto.endDate);

      const count = await tx.academicTerm.count({
        where: { tenantId: actor.tenantId, academicYearId: dto.academicYearId },
      });

      // Only enforce term-count limit when structure isn't CUSTOM
      const total =
        year.termStructure === TermStructure.CUSTOM
          ? undefined
          : year.totalTerms;
      if (total && count >= total) {
        throw new BadRequestException(
          `Academic year already has its configured ${total} terms`,
        );
      }

      const nextNumber = dto.termNumber ?? count + 1;
      const shortName = dto.shortName?.trim() ?? `T${nextNumber}`;

      await this.validateWindow(
        tx,
        actor.tenantId,
        dto.academicYearId,
        null,
        startDate,
        endDate,
        nextNumber,
        dto.name,
        shortName,
      );

      const term = await tx.academicTerm.create({
        data: {
          academicYearId: dto.academicYearId,
          tenantId: actor.tenantId,
          name: dto.name.trim(),
          shortName,
          termNumber: nextNumber,
          startDate,
          endDate,
          hasExams: dto.hasExams ?? true,
          hasFees: dto.hasFees ?? true,
          examWeeks: dto.examWeeks ?? 2,
        },
      });

      await tx.academicPeriod.create({
        data: {
          name: term.name,
          type: AcademicPeriodType.TERM,
          startDate: term.startDate,
          endDate: term.endDate,
          academicYearId: term.academicYearId,
          academicTermId: term.id,
          tenantId: actor.tenantId,
        },
      });

      await this.activityService.log(
        {
          action: ActivityAction.CREATE,
          entityType: ActivityEntityType.ACADEMIC_TERM,
          entityId: term.id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} created term ${term.name}`,
          metadata: { academicYearId: dto.academicYearId },
        },
        tx,
      );
      return term.id;
    });

    this.eventEmitter.emit(EVENTS.TERM_CREATED, {
      tenantId: actor.tenantId,
      termId,
      actorId: actor.id,
    });
    return this.findOne(termId, actor);
  }

  // ─────────────────────────── BULK CREATE
  async bulkCreate(dto: BulkCreateAcademicTermsDto, actor: RequestActor) {
    if (!dto.terms?.length) {
      throw new BadRequestException('At least one term is required');
    }

    const created: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const termDto of dto.terms) {
        const year = await this.ensureYearMutableForStructuralChange(
          tx,
          termDto.academicYearId,
          actor.tenantId,
        );
        const startDate = this.startOfDay(termDto.startDate);
        const endDate = this.endOfDay(termDto.endDate);

        const count = await tx.academicTerm.count({
          where: {
            tenantId: actor.tenantId,
            academicYearId: termDto.academicYearId,
          },
        });
        const total =
          year.termStructure === TermStructure.CUSTOM
            ? undefined
            : year.totalTerms;
        if (total && count >= total) {
          throw new BadRequestException(
            `Academic year already has its configured ${total} terms`,
          );
        }

        const nextNumber = termDto.termNumber ?? count + 1;
        const shortName = termDto.shortName?.trim() ?? `T${nextNumber}`;

        await this.validateWindow(
          tx,
          actor.tenantId,
          termDto.academicYearId,
          null,
          startDate,
          endDate,
          nextNumber,
          termDto.name,
          shortName,
        );

        const term = await tx.academicTerm.create({
          data: {
            academicYearId: termDto.academicYearId,
            tenantId: actor.tenantId,
            name: termDto.name.trim(),
            shortName,
            termNumber: nextNumber,
            startDate,
            endDate,
            hasExams: termDto.hasExams ?? true,
            hasFees: termDto.hasFees ?? true,
            examWeeks: termDto.examWeeks ?? 2,
          },
        });

        await tx.academicPeriod.create({
          data: {
            name: term.name,
            type: AcademicPeriodType.TERM,
            startDate: term.startDate,
            endDate: term.endDate,
            academicYearId: term.academicYearId,
            academicTermId: term.id,
            tenantId: actor.tenantId,
          },
        });

        created.push(term.id);

        await this.activityService.log(
          {
            action: ActivityAction.CREATE,
            entityType: ActivityEntityType.ACADEMIC_TERM,
            entityId: term.id,
            tenantId: actor.tenantId,
            userId: actor.id,
            message: `${this.actorName(actor)} bulk-created term ${term.name}`,
          },
          tx,
        );
      }
    });

    created.forEach((termId) =>
      this.eventEmitter.emit(EVENTS.TERM_CREATED, {
        tenantId: actor.tenantId,
        termId,
        actorId: actor.id,
      }),
    );

    return { created: created.length, termIds: created };
  }

  // ─────────────────────────── UPDATE
  async update(id: string, dto: UpdateAcademicTermDto, actor: RequestActor) {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.academicTerm.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!current) throw new NotFoundException('Academic term not found');
      if (current.isLocked) {
        throw new BadRequestException('Academic term is locked');
      }

      const [examCount, feeCount] = await Promise.all([
        tx.examination.count({
          where: { academicTermId: id, tenantId: actor.tenantId },
        }),
        tx.feeStructure.count({
          where: { academicTermId: id, tenantId: actor.tenantId },
        }),
      ]);
      const hasDeps = examCount + feeCount > 0;

      const structural =
        !!dto.startDate ||
        !!dto.endDate ||
        dto.termNumber !== undefined ||
        !!dto.name ||
        !!dto.shortName;

      if (hasDeps && structural) {
        throw new BadRequestException(
          'Cannot change term structure — dependents exist',
        );
      }

      const startDate = dto.startDate
        ? this.startOfDay(dto.startDate)
        : current.startDate;
      const endDate = dto.endDate
        ? this.endOfDay(dto.endDate)
        : current.endDate;

      await this.validateWindow(
        tx,
        actor.tenantId,
        current.academicYearId,
        id,
        startDate,
        endDate,
        dto.termNumber ?? current.termNumber,
        dto.name ?? current.name,
        dto.shortName ?? current.shortName,
      );

      await tx.academicTerm.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          shortName: dto.shortName?.trim(),
          termNumber: dto.termNumber,
          startDate: dto.startDate ? startDate : undefined,
          endDate: dto.endDate ? endDate : undefined,
          hasExams: dto.hasExams,
          hasFees: dto.hasFees,
          examWeeks: dto.examWeeks,
        },
      });

      await tx.academicPeriod.updateMany({
        where: {
          academicTermId: id,
          type: AcademicPeriodType.TERM,
          tenantId: actor.tenantId,
        },
        data: {
          name: dto.name?.trim() ?? current.name,
          startDate,
          endDate,
        },
      });

      await this.activityService.log(
        {
          action: ActivityAction.UPDATE,
          entityType: ActivityEntityType.ACADEMIC_TERM,
          entityId: id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} updated term ${dto.name ?? current.name}`,
        },
        tx,
      );
    });
    return this.findOne(id, actor);
  }

  // ─────────────────────────── ACTIVATE
  async activate(id: string, dto: ActivateTermDto, actor: RequestActor) {
    const termInfo = await this.prisma.$transaction(async (tx) => {
      const term = await tx.academicTerm.findFirst({
        where: { id, tenantId: actor.tenantId },
        include: { academicYear: true },
      });
      if (!term) throw new NotFoundException('Academic term not found');

      const now = new Date();
      if (term.academicYear.status === 'ARCHIVED') {
        throw new BadRequestException(
          'Cannot activate a term in an archived academic year',
        );
      }
      if (term.startDate > now) {
        const diffDays = Math.ceil(
          (term.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        throw new BadRequestException(
          `Cannot activate "${term.name}" early — starts in ${diffDays} day(s)`,
        );
      }
      if (term.endDate < now) {
        throw new BadRequestException(
          `Cannot activate "${term.name}": it ended on ${term.endDate.toDateString()}`,
        );
      }

      // Single-active-term invariant
      await tx.academicTerm.updateMany({
        where: { tenantId: actor.tenantId, id: { not: id } },
        data: { isActive: false },
      });
      await tx.academicYear.updateMany({
        where: { tenantId: actor.tenantId, id: { not: term.academicYearId } },
        data: { isCurrent: false },
      });
      await tx.academicYear.update({
        where: { id: term.academicYearId },
        data: { isCurrent: true, status: 'ACTIVE' },
      });
      await tx.academicTerm.update({
        where: { id },
        data: { isActive: true },
      });

      await this.activityService.log(
        {
          action: ActivityAction.STATUS_CHANGE,
          entityType: ActivityEntityType.ACADEMIC_TERM,
          entityId: id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} activated term ${term.name}`,
          metadata: {
            academicYearId: term.academicYearId,
            autoBill: dto.autoBill ?? true,
          },
        },
        tx,
      );

      return term;
    });

    this.eventEmitter.emit(EVENTS.TERM_ACTIVATED, {
      tenantId: actor.tenantId,
      termId: id,
      academicYearId: termInfo.academicYearId,
      actorId: actor.id,
      termName: termInfo.name,
      autoBill: dto.autoBill ?? true,
      carryForwardArrears: dto.carryForwardArrears ?? true,
    });

    return this.findOne(id, actor);
  }

  // ─────────────────────────── DEACTIVATE
  async deactivate(id: string, actor: RequestActor) {
    const term = await this.prisma.academicTerm.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!term) throw new NotFoundException('Academic term not found');

    await this.prisma.academicTerm.update({
      where: { id },
      data: { isActive: false },
    });

    await this.activityService.log({
      action: ActivityAction.STATUS_CHANGE,
      entityType: ActivityEntityType.ACADEMIC_TERM,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} deactivated term ${term.name}`,
    });

    this.eventEmitter.emit(EVENTS.TERM_DEACTIVATED, {
      tenantId: actor.tenantId,
      termId: id,
    });
    return this.findOne(id, actor);
  }

  // ─────────────────────────── COMPLETE
  async complete(id: string, actor: RequestActor) {
    const term = await this.prisma.academicTerm.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!term) throw new NotFoundException('Academic term not found');

    await this.prisma.academicTerm.update({
      where: { id },
      data: {
        isActive: false,
        isLocked: true,
        lockedAt: new Date(),
        lockedReason: 'Term completed',
      },
    });

    await this.activityService.log({
      action: ActivityAction.STATUS_CHANGE,
      entityType: ActivityEntityType.ACADEMIC_TERM,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} completed term ${term.name}`,
    });

    this.eventEmitter.emit(EVENTS.TERM_COMPLETED, {
      tenantId: actor.tenantId,
      termId: id,
      termName: term.name,
    });

    return this.findOne(id, actor);
  }

  // ─────────────────────────── LOCK (academic + financial)
  async lock(id: string, dto: LockTermDto, actor: RequestActor) {
    const term = await this.prisma.academicTerm.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!term) throw new NotFoundException('Academic term not found');

    const now = new Date();
    const data: Prisma.AcademicTermUpdateInput = {};

    if (dto.academicLock) {
      data.isLocked = true;
      data.lockedAt = now;
      data.lockedReason = dto.reason ?? 'Academically locked';
    }
    if (dto.financialLock) {
      data.isFinanciallyLocked = true;
      data.financiallyLockedAt = now;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        'Specify academicLock or financialLock (or both)',
      );
    }

    await this.prisma.academicTerm.update({ where: { id }, data });

    await this.activityService.log({
      action: dto.financialLock
        ? ActivityAction.FINANCIAL_LOCK
        : ActivityAction.ACADEMIC_LOCK,
      entityType: ActivityEntityType.ACADEMIC_TERM,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} locked term ${term.name}`,
      metadata: { ...dto },
    });

    return this.findOne(id, actor);
  }

  // ─────────────────────────── DELETE
  async remove(id: string, actor: RequestActor) {
    return this.prisma.$transaction(async (tx) => {
      const term = await tx.academicTerm.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!term) throw new NotFoundException('Academic term not found');
      if (term.isLocked || term.isActive) {
        throw new BadRequestException('Cannot delete an active or locked term');
      }

      const [exams, fees] = await Promise.all([
        tx.examination.count({
          where: { academicTermId: id, tenantId: actor.tenantId },
        }),
        tx.feeStructure.count({
          where: { academicTermId: id, tenantId: actor.tenantId },
        }),
      ]);
      if (exams + fees > 0) {
        throw new BadRequestException(
          'Cannot delete term with dependent exams or fees',
        );
      }

      await tx.academicPeriod.deleteMany({
        where: { academicTermId: id, tenantId: actor.tenantId },
      });
      await tx.academicTerm.delete({ where: { id } });

      await this.activityService.log(
        {
          action: ActivityAction.DELETE,
          entityType: ActivityEntityType.ACADEMIC_TERM,
          entityId: id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} deleted term ${term.name}`,
        },
        tx,
      );
      return { message: 'Academic term deleted successfully' };
    });
  }
}
