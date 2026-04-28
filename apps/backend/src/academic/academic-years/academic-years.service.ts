/**
 * @file academic-years.service.ts
 * @module academic/academic-years
 * @description Academic-year CRUD + locks + clone
 *
 *   Clone semantics for classes:
 *     - We carry `gradeId` (since grades survive across years)
 *     - We DO NOT copy streams automatically — that's a follow-up step in the
 *       streams module (POST /streams/clone-from-class for the new class).
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcademicYearStatus,
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
  CreateAcademicYearDto,
  CreateAcademicYearTermDto,
} from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { LockAcademicYearDto } from './dto/lock-academic-year.dto';
import { CloneAcademicYearDto } from './dto/clone-academic-year.dto';

interface RequestActor {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class AcademicYearsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─────────────────────── HELPERS
  private toStartOfDay(value: string | Date) {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  private toEndOfDay(value: string | Date) {
    const d = new Date(value);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  private actorName(a: RequestActor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  private expectedTermCount(structure?: TermStructure, totalTerms?: number) {
    if (structure === TermStructure.CUSTOM) return totalTerms ?? 3;
    if (structure === TermStructure.TWO_SEMESTERS) return 2;
    if (structure === TermStructure.THREE_TERMS) return 3;
    if (structure === TermStructure.FOUR_QUARTERS) return 4;
    return totalTerms ?? 3;
  }

  private defaultTermLabel(structure: TermStructure, index: number) {
    const number = index + 1;
    switch (structure) {
      case TermStructure.TWO_SEMESTERS:
        return { name: `Semester ${number}`, shortName: `S${number}` };
      case TermStructure.FOUR_QUARTERS:
        return { name: `Quarter ${number}`, shortName: `Q${number}` };
      case TermStructure.CUSTOM:
        return { name: `Phase ${number}`, shortName: `P${number}` };
      default:
        return { name: `Term ${number}`, shortName: `T${number}` };
    }
  }

  private buildAutoTerms(input: CreateAcademicYearDto, total: number) {
    const startDate = this.toStartOfDay(input.startDate);
    const endDate = this.toEndOfDay(input.endDate);
    const totalDays =
      Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
    const baseDays = Math.floor(totalDays / total);
    const remainder = totalDays % total;
    const structure = input.termStructure ?? TermStructure.THREE_TERMS;

    const terms: CreateAcademicYearTermDto[] = [];
    let cursor = new Date(startDate);
    for (let i = 0; i < total; i++) {
      const { name, shortName } = this.defaultTermLabel(structure, i);
      const segmentDays = baseDays + (i < remainder ? 1 : 0);
      const end = new Date(cursor);
      end.setDate(end.getDate() + segmentDays - 1);
      end.setHours(23, 59, 59, 999);
      terms.push({
        name,
        shortName,
        startDate: new Date(cursor).toISOString(),
        endDate: new Date(end).toISOString(),
        hasExams: true,
        hasFees: true,
        examWeeks: 2,
      });
      cursor = new Date(end);
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
    }
    return terms;
  }

  private async assertNoOverlap(
    tx: Prisma.TransactionClient,
    tenantId: string,
    start: Date,
    end: Date,
    excludeId?: string,
  ) {
    const overlap = await tx.academicYear.findFirst({
      where: {
        tenantId,
        ...(excludeId && { id: { not: excludeId } }),
        OR: [{ startDate: { lte: end }, endDate: { gte: start } }],
      },
    });
    if (overlap) {
      throw new BadRequestException(
        `Overlaps with "${overlap.name}" (${overlap.startDate.toDateString()} – ${overlap.endDate.toDateString()})`,
      );
    }
  }

  private normalizeTerms(
    yearStart: Date,
    yearEnd: Date,
    terms: CreateAcademicYearTermDto[],
    expectedCount: number,
    structure: TermStructure,
  ) {
    if (!terms.length)
      throw new BadRequestException('At least one term is required');
    if (structure !== TermStructure.CUSTOM && terms.length !== expectedCount) {
      throw new BadRequestException(
        `Expected ${expectedCount} terms for ${structure}, received ${terms.length}`,
      );
    }
    const normalized = terms.map((term, index) => {
      const startDate = this.toStartOfDay(term.startDate);
      const endDate = this.toEndOfDay(term.endDate);
      if (startDate >= endDate)
        throw new BadRequestException(
          `Term ${term.name} must have startDate before endDate`,
        );
      if (startDate < yearStart || endDate > yearEnd)
        throw new BadRequestException(
          `Term ${term.name} must be inside the academic year`,
        );
      return {
        ...term,
        name: term.name.trim(),
        shortName: (
          term.shortName ?? this.defaultTermLabel(structure, index).shortName
        ).trim(),
        termNumber: index + 1,
        startDate,
        endDate,
        hasExams: term.hasExams ?? true,
        hasFees: term.hasFees ?? true,
        examWeeks: term.examWeeks ?? 2,
      };
    });
    const sorted = [...normalized].sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime(),
    );
    const names = new Set<string>();
    const shorts = new Set<string>();
    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i];
      if (names.has(cur.name.toLowerCase()))
        throw new BadRequestException(`Duplicate term name: ${cur.name}`);
      if (shorts.has(cur.shortName.toLowerCase()))
        throw new BadRequestException(
          `Duplicate term shortName: ${cur.shortName}`,
        );
      names.add(cur.name.toLowerCase());
      shorts.add(cur.shortName.toLowerCase());
      const prev = sorted[i - 1];
      if (prev && cur.startDate <= prev.endDate)
        throw new BadRequestException(
          `Terms "${prev.name}" and "${cur.name}" overlap`,
        );
    }
    return normalized;
  }

  private async getDependencySummary(
    tx: Prisma.TransactionClient,
    academicYearId: string,
    tenantId: string,
  ) {
    const [classes, feeStructures, examinations, students] = await Promise.all([
      tx.class.count({ where: { academicYearId, tenantId } }),
      tx.feeStructure.count({ where: { academicYearId, tenantId } }),
      tx.examination.count({
        where: { tenantId, academicTerm: { academicYearId } },
      }),
      tx.student.count({ where: { tenantId, class: { academicYearId } } }),
    ]);
    return { classes, feeStructures, examinations, students };
  }

  private hasDependencies(summary: Record<string, number>) {
    return Object.values(summary).some((v) => v > 0);
  }

  // ─────────────────────── CREATE
  async create(dto: CreateAcademicYearDto, actor: RequestActor) {
    const tenantId = actor.tenantId;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { termStructure: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const structure =
      dto.termStructure ?? tenant.termStructure ?? TermStructure.THREE_TERMS;
    const totalTerms = this.expectedTermCount(structure, dto.totalTerms);
    const startDate = this.toStartOfDay(dto.startDate);
    const endDate = this.toEndOfDay(dto.endDate);
    if (startDate >= endDate)
      throw new BadRequestException('startDate must be before endDate');

    const sourceTerms = dto.terms?.length
      ? dto.terms
      : this.buildAutoTerms(
          { ...dto, termStructure: structure, totalTerms },
          totalTerms,
        );
    const normalized = this.normalizeTerms(
      startDate,
      endDate,
      sourceTerms,
      totalTerms,
      structure,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      await this.assertNoOverlap(tx, tenantId, startDate, endDate);
      const existing = await tx.academicYear.findUnique({
        where: { name_tenantId: { name: dto.name.trim(), tenantId } },
      });
      if (existing)
        throw new ConflictException('Year with this name already exists');
      if (dto.isCurrent) {
        await tx.academicYear.updateMany({
          where: { tenantId },
          data: { isCurrent: false },
        });
      }
      const year = await tx.academicYear.create({
        data: {
          name: dto.name.trim(),
          startDate,
          endDate,
          tenantId,
          termStructure: structure,
          totalTerms,
          isCurrent: dto.isCurrent ?? false,
          status: dto.isCurrent
            ? AcademicYearStatus.ACTIVE
            : AcademicYearStatus.DRAFT,
        },
      });
      await tx.academicTerm.createMany({
        data: normalized.map((t) => ({
          name: t.name,
          shortName: t.shortName,
          termNumber: t.termNumber,
          startDate: t.startDate,
          endDate: t.endDate,
          hasExams: t.hasExams,
          hasFees: t.hasFees,
          examWeeks: t.examWeeks,
          academicYearId: year.id,
          tenantId,
        })),
      });

      await tx.academicPeriod.createMany({
        data: normalized.map((t) => ({
          name: t.name,
          type: 'TERM' as const,
          startDate: t.startDate,
          endDate: t.endDate,
          academicYearId: year.id,
          tenantId,
        })),
      });
      await this.activityService.log(
        {
          action: ActivityAction.CREATE,
          entityType: ActivityEntityType.ACADEMIC_YEAR,
          entityId: year.id,
          tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} created academic year ${year.name}`,
        },
        tx,
      );
      return year;
    });

    this.eventEmitter.emit(EVENTS.ACADEMIC_YEAR_CREATED, {
      tenantId,
      academicYearId: created.id,
      actorId: actor.id,
    });
    return this.findOne(created.id, actor);
  }

  // ─────────────────────── READ
  async findAll(actor: RequestActor, includeTerms = true) {
    return this.prisma.academicYear.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        terms: includeTerms ? { orderBy: { termNumber: 'asc' } } : false,
        _count: {
          select: {
            classes: true,
            terms: true,
            feeStructures: true,
            studentClassHistories: true,
          },
        },
      },
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
    });
  }

  async findOne(id: string, actor: RequestActor) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        terms: {
          orderBy: { termNumber: 'asc' },
          include: {
            _count: { select: { feeStructures: true, examinations: true } },
          },
        },
        academicPeriods: { orderBy: { startDate: 'asc' } },
        _count: {
          select: {
            classes: true,
            terms: true,
            feeStructures: true,
            studentClassHistories: true,
          },
        },
      },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    return year;
  }

  async getCurrentYear(actor: RequestActor) {
    return this.prisma.academicYear.findFirst({
      where: { tenantId: actor.tenantId, isCurrent: true },
      include: { terms: { orderBy: { termNumber: 'asc' } } },
    });
  }

  async getCurrentYearWrapped(tenantId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId, isCurrent: true },
      include: {
        _count: {
          select: { terms: true, classes: true, feeStructures: true },
        },
      },
    });
    return {
      data: year ?? null,
      message: year ? undefined : 'No current academic year configured',
    };
  }

  // ─────────────────────── UPDATE / SET-CURRENT / LOCKS / ARCHIVE / DELETE
  async update(id: string, dto: UpdateAcademicYearDto, actor: RequestActor) {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.academicYear.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!current) throw new NotFoundException('Academic year not found');
      if (current.isLocked)
        throw new BadRequestException('Academic year is locked');
      if (dto.name && dto.name !== current.name) {
        const existing = await tx.academicYear.findUnique({
          where: {
            name_tenantId: { name: dto.name.trim(), tenantId: actor.tenantId },
          },
        });
        if (existing && existing.id !== id)
          throw new ConflictException('Name already in use');
      }
      const nextStart = dto.startDate
        ? this.toStartOfDay(dto.startDate)
        : current.startDate;
      const nextEnd = dto.endDate
        ? this.toEndOfDay(dto.endDate)
        : current.endDate;
      if (nextStart >= nextEnd)
        throw new BadRequestException('startDate must be before endDate');
      const structural =
        !!dto.startDate ||
        !!dto.endDate ||
        !!dto.termStructure ||
        !!dto.totalTerms;
      const deps = await this.getDependencySummary(tx, id, actor.tenantId);
      if (structural && this.hasDependencies(deps))
        throw new BadRequestException(
          'Structure cannot change — dependents exist',
        );
      if (structural)
        await this.assertNoOverlap(tx, actor.tenantId, nextStart, nextEnd, id);
      if (dto.isCurrent) {
        await tx.academicYear.updateMany({
          where: { tenantId: actor.tenantId, id: { not: id } },
          data: { isCurrent: false },
        });
      }
      await tx.academicYear.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          startDate: dto.startDate ? nextStart : undefined,
          endDate: dto.endDate ? nextEnd : undefined,
          termStructure: dto.termStructure,
          totalTerms: dto.totalTerms,
          isCurrent: dto.isCurrent,
          status: dto.isCurrent ? AcademicYearStatus.ACTIVE : current.status,
        },
      });
      await this.activityService.log(
        {
          action: ActivityAction.UPDATE,
          entityType: ActivityEntityType.ACADEMIC_YEAR,
          entityId: id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} updated year`,
        },
        tx,
      );
    });
    return this.findOne(id, actor);
  }

  async setCurrentYear(id: string, actor: RequestActor) {
    await this.prisma.$transaction(async (tx) => {
      const year = await tx.academicYear.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!year) throw new NotFoundException('Academic year not found');
      const now = new Date();
      if (year.startDate > now) {
        throw new BadRequestException(
          `Cannot activate "${year.name}": it starts on ${year.startDate.toDateString()}`,
        );
      }
      await tx.academicYear.updateMany({
        where: { tenantId: actor.tenantId },
        data: { isCurrent: false },
      });
      await tx.academicYear.update({
        where: { id },
        data: { isCurrent: true, status: AcademicYearStatus.ACTIVE },
      });
      await this.activityService.log(
        {
          action: ActivityAction.STATUS_CHANGE,
          entityType: ActivityEntityType.ACADEMIC_YEAR,
          entityId: id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} set ${year.name} as current`,
        },
        tx,
      );
    });

    this.eventEmitter.emit(EVENTS.ACADEMIC_YEAR_ACTIVATED, {
      tenantId: actor.tenantId,
      academicYearId: id,
      actorId: actor.id,
    });
    return this.findOne(id, actor);
  }

  async lockAcademic(
    id: string,
    dto: LockAcademicYearDto,
    actor: RequestActor,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const year = await tx.academicYear.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!year) throw new NotFoundException('Academic year not found');
      if (year.isLocked) return;
      await tx.academicYear.update({
        where: { id },
        data: {
          isLocked: true,
          lockedAt: new Date(),
          lockedReason: dto.reason ?? 'Manually locked',
          status: AcademicYearStatus.LOCKED,
        },
      });
      await tx.academicTerm.updateMany({
        where: { academicYearId: id, tenantId: actor.tenantId },
        data: { isLocked: true, lockedAt: new Date() },
      });
      await this.activityService.log(
        {
          action: ActivityAction.ACADEMIC_LOCK,
          entityType: ActivityEntityType.ACADEMIC_YEAR,
          entityId: id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} academically locked year ${year.name}`,
        },
        tx,
      );
    });
    return this.findOne(id, actor);
  }

  async lockFinancial(
    id: string,
    dto: LockAcademicYearDto,
    actor: RequestActor,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const year = await tx.academicYear.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!year) throw new NotFoundException('Academic year not found');
      if (year.isFinanciallyLocked) return;
      await tx.academicYear.update({
        where: { id },
        data: {
          isFinanciallyLocked: true,
          financiallyLockedAt: new Date(),
          financialLockReason: dto.reason ?? 'Financial close',
        },
      });
      await tx.academicTerm.updateMany({
        where: { academicYearId: id, tenantId: actor.tenantId },
        data: { isFinanciallyLocked: true, financiallyLockedAt: new Date() },
      });
      await this.activityService.log(
        {
          action: ActivityAction.FINANCIAL_LOCK,
          entityType: ActivityEntityType.ACADEMIC_YEAR,
          entityId: id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} financially locked year ${year.name}`,
        },
        tx,
      );
    });
    this.eventEmitter.emit(EVENTS.ACADEMIC_YEAR_FINANCIAL_LOCKED, {
      tenantId: actor.tenantId,
      academicYearId: id,
      actorId: actor.id,
    });
    return this.findOne(id, actor);
  }

  async archive(id: string, actor: RequestActor) {
    await this.prisma.$transaction(async (tx) => {
      const year = await tx.academicYear.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!year) throw new NotFoundException('Academic year not found');
      if (year.isCurrent)
        throw new BadRequestException(
          'Cannot archive the current academic year',
        );
      await tx.academicYear.update({
        where: { id },
        data: { status: AcademicYearStatus.ARCHIVED },
      });
      await this.activityService.log(
        {
          action: ActivityAction.STATUS_CHANGE,
          entityType: ActivityEntityType.ACADEMIC_YEAR,
          entityId: id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} archived ${year.name}`,
        },
        tx,
      );
    });
    this.eventEmitter.emit(EVENTS.ACADEMIC_YEAR_ARCHIVED, {
      tenantId: actor.tenantId,
      academicYearId: id,
      actorId: actor.id,
    });
    return this.findOne(id, actor);
  }

  async remove(id: string, actor: RequestActor) {
    return this.prisma.$transaction(async (tx) => {
      const year = await tx.academicYear.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!year) throw new NotFoundException('Academic year not found');
      if (year.isCurrent)
        throw new BadRequestException('Cannot delete current academic year');
      const deps = await this.getDependencySummary(tx, id, actor.tenantId);
      if (this.hasDependencies(deps))
        throw new BadRequestException('Cannot delete — dependents exist');
      await tx.academicYear.delete({ where: { id } });
      await this.activityService.log(
        {
          action: ActivityAction.DELETE,
          entityType: ActivityEntityType.ACADEMIC_YEAR,
          entityId: id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} deleted year ${year.name}`,
        },
        tx,
      );
      return { message: 'Academic year deleted successfully' };
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  CLONE YEAR — v2 (gradeId, no streamsByGrade, optional stream copy via Stream module)
  // ═══════════════════════════════════════════════════════════════
  async cloneYear(
    sourceId: string,
    dto: CloneAcademicYearDto,
    actor: RequestActor,
  ) {
    const tenantId = actor.tenantId;
    const newStart = this.toStartOfDay(dto.startDate);
    const newEnd = this.toEndOfDay(dto.endDate);
    if (newStart >= newEnd)
      throw new BadRequestException('startDate must precede endDate');

    const createdYear = await this.prisma.$transaction(async (tx) => {
      const source = await tx.academicYear.findFirst({
        where: { id: sourceId, tenantId },
        include: {
          terms: { orderBy: { termNumber: 'asc' } },
          academicPeriods: { orderBy: { startDate: 'asc' } },
          classes: {
            include: {
              streams: {
                select: { id: true, name: true, capacity: true, color: true },
              },
            },
          },
          feeStructures: { include: { feeComponents: true } },
        },
      });
      if (!source) throw new NotFoundException('Source year not found');

      const dup = await tx.academicYear.findUnique({
        where: { name_tenantId: { name: dto.name.trim(), tenantId } },
      });
      if (dup) throw new ConflictException('Year name already exists');
      await this.assertNoOverlap(tx, tenantId, newStart, newEnd);

      if (dto.setAsCurrent) {
        await tx.academicYear.updateMany({
          where: { tenantId },
          data: { isCurrent: false },
        });
      }
      const newYear = await tx.academicYear.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          startDate: newStart,
          endDate: newEnd,
          termStructure: source.termStructure,
          totalTerms: source.totalTerms,
          isCurrent: !!dto.setAsCurrent,
          status: dto.setAsCurrent
            ? AcademicYearStatus.ACTIVE
            : AcademicYearStatus.DRAFT,
        },
      });

      const sourceSpan =
        source.endDate.getTime() - source.startDate.getTime() || 1;
      const targetSpan = newEnd.getTime() - newStart.getTime() || 1;
      const rescale = (d: Date) => {
        const offsetFromStart = d.getTime() - source.startDate.getTime();
        const ratio = offsetFromStart / sourceSpan;
        return new Date(newStart.getTime() + Math.round(ratio * targetSpan));
      };

      const createdTermsMap = new Map<number, string>();
      if (dto.copyTerms !== false && source.terms.length) {
        for (const t of source.terms) {
          const nt = await tx.academicTerm.create({
            data: {
              tenantId,
              academicYearId: newYear.id,
              name: t.name,
              shortName: t.shortName,
              termNumber: t.termNumber,
              startDate: rescale(t.startDate),
              endDate: rescale(t.endDate),
              hasExams: t.hasExams,
              hasFees: t.hasFees,
              examWeeks: t.examWeeks,
            },
          });
          createdTermsMap.set(t.termNumber, nt.id);
          await tx.academicPeriod.create({
            data: {
              tenantId,
              academicYearId: newYear.id,
              academicTermId: nt.id,
              name: nt.name,
              type: 'TERM' as const,
              startDate: nt.startDate,
              endDate: nt.endDate,
            },
          });
        }
        if (dto.copyPeriods) {
          const nonTerm = source.academicPeriods.filter(
            (p) => p.type !== 'TERM',
          );
          for (const p of nonTerm) {
            const sourceTerm = source.terms.find(
              (t) => t.id === p.academicTermId,
            );
            const newTermId = sourceTerm
              ? (createdTermsMap.get(sourceTerm.termNumber) ?? null)
              : null;
            await tx.academicPeriod.create({
              data: {
                tenantId,
                academicYearId: newYear.id,
                academicTermId: newTermId,
                name: p.name,
                type: p.type,
                startDate: rescale(p.startDate),
                endDate: rescale(p.endDate),
                notes: p.notes,
              },
            });
          }
        }
      }

      // Classes: clone shells
      if (dto.copyClasses !== false && source.classes.length) {
        for (const c of source.classes) {
          const newClass = await tx.class.create({
            data: {
              tenantId,
              academicYearId: newYear.id,
              gradeId: c.gradeId,
              name: c.name,
              displayName: c.displayName,
              section: c.section,
              capacity: c.capacity,
              classType: c.classType,
              language: c.language,
              classTeacherId: null,
            },
          });
          if (dto.copyClasses && c.streams.length) {
            await tx.stream.createMany({
              data: c.streams.map((s) => ({
                tenantId,
                classId: newClass.id,
                name: s.name,
                capacity: s.capacity,
                color: s.color,
              })),
            });
          }
        }
      }

      // Fee structures — copy shell + components; gradeId/curriculumId/classId/streamId
      // are intentionally NOT carried (you typically rebind these to the new year).
      if (dto.copyFeeStructures && source.feeStructures.length) {
        for (const fs of source.feeStructures) {
          const newFs = await tx.feeStructure.create({
            data: {
              tenantId,
              academicYearId: newYear.id,
              name: fs.name,
              description: fs.description,
              feeType: fs.feeType,
              scope: fs.scope,
              isRecurring: fs.isRecurring,
              isOptional: fs.isOptional,
              isAutoBill: fs.isAutoBill,
            },
          });
          if (fs.feeComponents.length) {
            await tx.feeComponent.createMany({
              data: fs.feeComponents.map((c) => ({
                feeStructureId: newFs.id,
                name: c.name,
                description: c.description,
                amount: c.amount,
                currency: c.currency,
                isCompulsory: c.isCompulsory,
                category: c.category,
                lateFee: c.lateFee,
                sortOrder: c.sortOrder,
                priority: c.priority,
              })),
            });
          }
        }
      }

      await this.activityService.log(
        {
          action: ActivityAction.CREATE,
          entityType: ActivityEntityType.ACADEMIC_YEAR,
          entityId: newYear.id,
          tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} cloned "${source.name}" → "${newYear.name}"`,
          metadata: {
            sourceYearId: source.id,
            copyClasses: dto.copyClasses !== false,
            copyTerms: dto.copyTerms !== false,
            copyPeriods: !!dto.copyPeriods,
            copyFeeStructures: !!dto.copyFeeStructures,
          },
        },
        tx,
      );
      return newYear;
    });

    this.eventEmitter.emit(EVENTS.ACADEMIC_YEAR_CREATED, {
      tenantId,
      academicYearId: createdYear.id,
      actorId: actor.id,
    });
    return this.findOne(createdYear.id, actor);
  }
}
