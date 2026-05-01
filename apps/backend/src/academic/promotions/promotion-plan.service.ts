/**
 * @service PromotionPlanService
 * @description 3-step promotion engine: PLAN → REVIEW → APPROVE → EXECUTE.
 *   Fully refactored for schema v2: works in `gradeId` / `streamId` space,
 *   curriculum-aware. No legacy `gradeLevel` / `stream` (string) usage.
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
  Prisma,
  PromotionPlanStatus,
  PromotionPlanEntryStatus,
  PromotionStrategy,
  PromotionStatus,
  StudentStatus,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { StudentClassHistoryService } from '../student-class-history/student-class-history.service';
import { CalendarRulesService } from '../../common/calendar/calendar-rules.service';
import { RequestActor } from '../academic-terms/academic-terms.service';
import {
  ApprovePlanDto,
  CreatePromotionPlanDto,
  ExecutePlanDto,
  UpdatePlanEntryDto,
} from './dto/promotion-plan.dto';
import {
  GradeRef,
  SourceStudent,
  StreamRef,
  TargetClass,
  balancedDistribution,
  customMapping,
  gradeOnly,
  preserveStream,
  validateFinalMapping,
} from './promotion-strategies';

type PlanWithEntries = Prisma.PromotionPlanGetPayload<{
  include: { entries: true };
}>;

type PlanEntry = PlanWithEntries['entries'][number];

interface ExecutionResults {
  promoted: number;
  graduated: number;
  retained: number;
  skipped: number;
  failed: number;
  errors: Array<{ entryId: string; error: string }>;
}

@Injectable()
export class PromotionPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: StudentClassHistoryService,
    private readonly rules: CalendarRulesService,
    private readonly activity: ActivityService,
    private readonly events: EventEmitter2,
  ) {}

  private actorName(a: RequestActor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  // ═══════════════════════════════════════════════════════════════
  //  GENERATE
  // ═══════════════════════════════════════════════════════════════
  async generate(dto: CreatePromotionPlanDto, actor: RequestActor) {
    const gate = await this.rules.canCreatePromotionPlan(actor.tenantId);
    if (!gate.allowed) throw new ForbiddenException(gate.reason);

    const [fromYear, toYear] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { id: dto.fromAcademicYearId, tenantId: actor.tenantId },
      }),
      this.prisma.academicYear.findFirst({
        where: { id: dto.toAcademicYearId, tenantId: actor.tenantId },
      }),
    ]);
    if (!fromYear) throw new NotFoundException('Source year not found');
    if (!toYear) throw new NotFoundException('Target year not found');
    if (toYear.id === fromYear.id)
      throw new BadRequestException('From and To years must differ');

    // ── Load target year classes (catalogue) ───────────────────────
    const targetClassRaw = await this.prisma.class.findMany({
      where: { tenantId: actor.tenantId, academicYearId: toYear.id },
      include: {
        grade: {
          select: {
            id: true,
            name: true,
            displayName: true,
            levelOrder: true,
            curriculumId: true,
          },
        },
        streams: {
          select: { id: true, name: true, capacity: true },
        },
        _count: { select: { students: true } },
      },
    });

    // ── Load grades for ladder lookup ──────────────────────────────
    const grades = await this.prisma.grade.findMany({
      where: { tenantId: actor.tenantId },
      select: {
        id: true,
        levelOrder: true,
        curriculumId: true,
      },
      orderBy: { levelOrder: 'asc' },
    });

    const gradesByCurriculum: Record<string, GradeRef[]> = {};
    for (const g of grades) {
      if (!gradesByCurriculum[g.curriculumId]) {
        gradesByCurriculum[g.curriculumId] = [];
      }
      gradesByCurriculum[g.curriculumId].push({
        id: g.id,
        levelOrder: g.levelOrder,
        curriculumId: g.curriculumId,
      });
    }

    // ── Build TargetClass[] for strategies ─────────────────────────
    const targetClasses: TargetClass[] = targetClassRaw.map((c) => ({
      id: c.id,
      name: c.name,
      capacity: c.capacity,
      currentCount: c._count.students,
      grade: {
        id: c.grade.id,
        levelOrder: c.grade.levelOrder,
        curriculumId: c.grade.curriculumId,
      },
      streams: c.streams.map<StreamRef>((s) => ({
        id: s.id,
        name: s.name,
        capacity: s.capacity,
        currentCount: 0, // strategies bump this in-memory as they distribute
      })),
    }));

    // Decide strategy. If target year has zero streams across ALL classes,
    // auto-switch to GRADE_ONLY (admin can still force CUSTOM_MAPPING).
    const strategyRaw = dto.strategy ?? 'PRESERVE_STREAM';
    const targetHasAnyStream = targetClasses.some((c) => c.streams.length > 0);
    const strategy: PromotionStrategy =
      !targetHasAnyStream && strategyRaw !== 'CUSTOM_MAPPING'
        ? PromotionStrategy.GRADE_ONLY
        : (strategyRaw as PromotionStrategy);

    // ── Load students to plan for ──────────────────────────────────
    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        academicStatus: StudentStatus.ACTIVE,
        ...(dto.classIds?.length ? { classId: { in: dto.classIds } } : {}),
        ...(dto.excludeStudentIds?.length
          ? { id: { notIn: dto.excludeStudentIds } }
          : {}),
        class: { academicYearId: fromYear.id },
      },
      include: {
        class: {
          include: {
            grade: {
              select: {
                id: true,
                levelOrder: true,
                curriculumId: true,
              },
            },
          },
        },
        stream: {
          select: { id: true, name: true },
        },
      },
    });

    const ctx = { targetClasses, gradesByCurriculum };

    const pickFn =
      strategy === PromotionStrategy.PRESERVE_STREAM
        ? preserveStream
        : strategy === PromotionStrategy.BALANCED_DISTRIBUTION
          ? balancedDistribution
          : strategy === PromotionStrategy.GRADE_ONLY
            ? gradeOnly
            : customMapping;

    const entryPayloads = students.map((s) => {
      const src: SourceStudent = {
        id: s.id,
        classId: s.classId,
        gradeId: s.class.gradeId,
        curriculumId: s.class.grade.curriculumId,
        gradeLevelOrder: s.class.grade.levelOrder,
        streamName: s.stream?.name ?? null,
        className: s.class.name,
      };
      const res = pickFn(src, ctx);
      const hasConflict = res.conflicts.length > 0;
      return {
        studentId: s.id,
        fromClassId: s.classId,
        fromStreamId: s.streamId,
        suggestedClassId: res.suggestedClassId,
        suggestedStreamId: res.suggestedStreamId,
        action: res.action,
        status: hasConflict
          ? PromotionPlanEntryStatus.CONFLICTED
          : PromotionPlanEntryStatus.PENDING,
        warnings: (res.warnings ?? []) as unknown as Prisma.InputJsonValue,
        conflicts: (res.conflicts ?? []) as unknown as Prisma.InputJsonValue,
        tenantId: actor.tenantId,
      };
    });

    const stats = summariseEntries(entryPayloads);

    const plan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.promotionPlan.create({
        data: {
          tenantId: actor.tenantId,
          name: dto.name.trim(),
          status: PromotionPlanStatus.DRAFT,
          strategy,
          fromAcademicYearId: fromYear.id,
          toAcademicYearId: toYear.id,
          totalStudents: students.length,
          plannedPromotions: stats.promoted,
          plannedGraduations: stats.graduated,
          plannedRetentions: stats.retained,
          conflictsCount: stats.conflicts,
          warningsCount: stats.warnings,
          notes: dto.notes,
          createdById: actor.id,
          summary: {
            strategy,
            requestedStrategy: strategyRaw,
            autoSwitchedToGradeOnly:
              strategy === PromotionStrategy.GRADE_ONLY &&
              strategyRaw !== 'GRADE_ONLY',
          } as Prisma.InputJsonValue,
        },
      });
      if (entryPayloads.length) {
        await tx.promotionPlanEntry.createMany({
          data: entryPayloads.map((e) => ({ ...e, planId: created.id })),
        });
      }
      await this.activity.log(
        {
          action: ActivityAction.CREATE,
          entityType: ActivityEntityType.PROMOTION,
          entityId: created.id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} generated promotion plan "${created.name}"`,
          metadata: { strategy, ...stats } as Prisma.InputJsonValue,
        },
        tx,
      );
      return created;
    });
    this.events.emit('PROMOTION_PLAN_CREATED', {
      tenantId: actor.tenantId,
      planId: plan.id,
    });
    return this.findOne(plan.id, actor, { page: 1, limit: 25 });
  }

  // ═══════════════════════════════════════════════════════════════
  //  PAGINATED LIST
  // ═══════════════════════════════════════════════════════════════
  async list(
    actor: RequestActor,
    filters: {
      status?: PromotionPlanStatus;
      fromAcademicYearId?: string;
      toAcademicYearId?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 10));
    const skip = (page - 1) * limit;

    const where: Prisma.PromotionPlanWhereInput = {
      tenantId: actor.tenantId,
      status: filters.status,
      fromAcademicYearId: filters.fromAcademicYearId,
      toAcademicYearId: filters.toAcademicYearId,
    };

    const [data, total] = await Promise.all([
      this.prisma.promotionPlan.findMany({
        where,
        skip,
        take: limit,
        include: { _count: { select: { entries: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.promotionPlan.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  PAGINATED DETAIL (with entries page)
  // ═══════════════════════════════════════════════════════════════
  async findOne(
    id: string,
    actor: RequestActor,
    entryFilters: {
      page?: number;
      limit?: number;
      status?: PromotionPlanEntryStatus;
    } = {},
  ) {
    const plan = await this.prisma.promotionPlan.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    const page = Math.max(1, entryFilters.page ?? 1);
    const limit = Math.min(100, Math.max(1, entryFilters.limit ?? 25));
    const skip = (page - 1) * limit;

    const where: Prisma.PromotionPlanEntryWhereInput = {
      planId: id,
      tenantId: actor.tenantId,
      status: entryFilters.status,
    };

    const [entries, total] = await Promise.all([
      this.prisma.promotionPlanEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { studentId: 'asc' }],
      }),
      this.prisma.promotionPlanEntry.count({ where }),
    ]);

    const studentIds = entries.map((e) => e.studentId);
    const classIds = [
      ...new Set(
        entries.flatMap((e) =>
          [
            e.fromClassId,
            e.suggestedClassId,
            e.overrideClassId,
            e.finalClassId,
          ].filter(Boolean),
        ),
      ),
    ] as string[];
    const streamIds = [
      ...new Set(
        entries.flatMap((e) =>
          [
            e.fromStreamId,
            e.suggestedStreamId,
            e.overrideStreamId,
            e.finalStreamId,
          ].filter(Boolean),
        ),
      ),
    ] as string[];

    const [students, classes, streams] = await Promise.all([
      this.prisma.student.findMany({
        where: { id: { in: studentIds } },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
        },
      }),
      classIds.length
        ? this.prisma.class.findMany({
            where: { id: { in: classIds } },
            select: {
              id: true,
              name: true,
              displayName: true,
              gradeId: true,
              grade: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  levelOrder: true,
                },
              },
            },
          })
        : Promise.resolve([] as Awaited<
            ReturnType<typeof this.prisma.class.findMany>
          >),
      streamIds.length
        ? this.prisma.stream.findMany({
            where: { id: { in: streamIds } },
            select: {
              id: true,
              name: true,
              classId: true,
              color: true,
            },
          })
        : Promise.resolve([] as Awaited<
            ReturnType<typeof this.prisma.stream.findMany>
          >),
    ]);

    const studentMap = new Map(
      students.map((s): readonly [string, (typeof students)[number]] => [s.id, s]),
    );
    const classMap = new Map(
      classes.map((c): readonly [string, (typeof classes)[number]] => [c.id, c]),
    );
    const streamMap = new Map(
      streams.map((s): readonly [string, (typeof streams)[number]] => [s.id, s]),
    );

    return {
      ...plan,
      entries: {
        data: entries.map((e) => ({
          ...e,
          student: studentMap.get(e.studentId) ?? null,
          fromClass: e.fromClassId ? classMap.get(e.fromClassId) : null,
          suggestedClass: e.suggestedClassId
            ? classMap.get(e.suggestedClassId)
            : null,
          overrideClass: e.overrideClassId
            ? classMap.get(e.overrideClassId)
            : null,
          finalClass: e.finalClassId ? classMap.get(e.finalClassId) : null,
          fromStream: e.fromStreamId ? streamMap.get(e.fromStreamId) : null,
          suggestedStream: e.suggestedStreamId
            ? streamMap.get(e.suggestedStreamId)
            : null,
          overrideStream: e.overrideStreamId
            ? streamMap.get(e.overrideStreamId)
            : null,
          finalStream: e.finalStreamId ? streamMap.get(e.finalStreamId) : null,
        })),
        meta: { total, page, limit, pages: Math.ceil(total / limit) },
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  UPDATE ENTRY (admin override)
  // ═══════════════════════════════════════════════════════════════
  async updateEntry(
    planId: string,
    entryId: string,
    dto: UpdatePlanEntryDto,
    actor: RequestActor,
  ) {
    const plan = await this.prisma.promotionPlan.findFirst({
      where: { id: planId, tenantId: actor.tenantId },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    if (
      plan.status !== PromotionPlanStatus.DRAFT &&
      plan.status !== PromotionPlanStatus.REVIEWING
    ) {
      throw new BadRequestException(
        `Plan is ${plan.status} — entries can only be edited in DRAFT/REVIEWING`,
      );
    }
    const entry = await this.prisma.promotionPlanEntry.findFirst({
      where: { id: entryId, planId },
    });
    if (!entry) throw new NotFoundException('Entry not found');

    let resolvedOverrideClassId: string | null | undefined;
    let resolvedOverrideStreamId: string | null | undefined;

    // If override class is being changed, validate it lives in the target year
    // and (if a stream id is provided) that the stream belongs to that class.
    if (dto.overrideClassId !== undefined) {
      if (dto.overrideClassId === null) {
        resolvedOverrideClassId = null;
        resolvedOverrideStreamId = null;
      } else {
        const target = await this.prisma.class.findFirst({
          where: {
            id: dto.overrideClassId,
            tenantId: actor.tenantId,
            academicYearId: plan.toAcademicYearId,
          },
          include: {
            streams: { select: { id: true, name: true, capacity: true } },
            grade: {
              select: { id: true, levelOrder: true, curriculumId: true },
            },
          },
        });
        if (!target) {
          throw new BadRequestException(
            'Override class does not belong to target year',
          );
        }
        resolvedOverrideClassId = target.id;

        if (dto.overrideStreamId !== undefined) {
          if (dto.overrideStreamId === null) {
            // Allowed only if class has no streams
            if (target.streams.length > 0) {
              throw new BadRequestException(
                'Class has streams — overrideStreamId is required',
              );
            }
            resolvedOverrideStreamId = null;
          } else {
            const owns = target.streams.some(
              (s) => s.id === dto.overrideStreamId,
            );
            if (!owns) {
              throw new BadRequestException(
                'overrideStreamId does not belong to overrideClassId',
              );
            }
            resolvedOverrideStreamId = dto.overrideStreamId;
          }
        } else {
          // Class changed but no stream provided — clear stream
          resolvedOverrideStreamId = null;
        }

        // Final consistency check
        const v = validateFinalMapping(
          [
            {
              id: target.id,
              name: target.name ?? '',
              capacity: target.capacity,
              currentCount: 0,
              grade: {
                id: target.grade.id,
                levelOrder: target.grade.levelOrder,
                curriculumId: target.grade.curriculumId,
              },
              streams: target.streams.map((s) => ({
                id: s.id,
                name: s.name,
                capacity: s.capacity,
                currentCount: 0,
              })),
            },
          ],
          target.id,
          resolvedOverrideStreamId ?? null,
        );
        if (!v.ok) throw new BadRequestException(v.reason);
      }
    } else if (dto.overrideStreamId !== undefined) {
      // Stream-only change — must validate against existing override OR
      // suggested class.
      const baseClassId = entry.overrideClassId ?? entry.suggestedClassId;
      if (!baseClassId) {
        throw new BadRequestException(
          'Cannot set override stream without an override or suggested class',
        );
      }
      const target = await this.prisma.class.findFirst({
        where: { id: baseClassId, tenantId: actor.tenantId },
        include: { streams: { select: { id: true } } },
      });
      if (!target) {
        throw new BadRequestException('Base class not found for stream');
      }

      if (dto.overrideStreamId === null) {
        if (target.streams.length > 0) {
          throw new BadRequestException(
            'Class has streams — overrideStreamId cannot be null',
          );
        }
        resolvedOverrideStreamId = null;
      } else {
        const owns = target.streams.some((s) => s.id === dto.overrideStreamId);
        if (!owns) {
          throw new BadRequestException(
            'overrideStreamId does not belong to the chosen class',
          );
        }
        resolvedOverrideStreamId = dto.overrideStreamId;
      }
    }

    const willOverride =
      resolvedOverrideClassId !== undefined ||
      resolvedOverrideStreamId !== undefined ||
      dto.action === 'GRADUATE' ||
      dto.action === 'SKIP';

    const nextStatus: PromotionPlanEntryStatus = willOverride
      ? PromotionPlanEntryStatus.OVERRIDDEN
      : entry.status === PromotionPlanEntryStatus.CONFLICTED
        ? PromotionPlanEntryStatus.CONFLICTED
        : PromotionPlanEntryStatus.PENDING;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.promotionPlanEntry.update({
        where: { id: entryId },
        data: {
          overrideClassId:
            resolvedOverrideClassId !== undefined
              ? resolvedOverrideClassId
              : entry.overrideClassId,
          overrideStreamId:
            resolvedOverrideStreamId !== undefined
              ? resolvedOverrideStreamId
              : entry.overrideStreamId,
          action: dto.action ?? entry.action,
          adminNotes: dto.adminNotes ?? entry.adminNotes,
          status: nextStatus,
        },
      });
      await tx.promotionPlan.update({
        where: { id: planId },
        data: { status: PromotionPlanStatus.REVIEWING },
      });
      await this.activity.log(
        {
          action: ActivityAction.UPDATE,
          entityType: ActivityEntityType.PROMOTION,
          entityId: entryId,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} overrode promotion entry`,
        },
        tx,
      );
      return updated;
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  APPROVE
  // ═══════════════════════════════════════════════════════════════
  async approve(planId: string, dto: ApprovePlanDto, actor: RequestActor) {
    const plan = await this.prisma.promotionPlan.findFirst({
      where: { id: planId, tenantId: actor.tenantId },
      include: { entries: true },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    if (
      plan.status !== PromotionPlanStatus.DRAFT &&
      plan.status !== PromotionPlanStatus.REVIEWING
    ) {
      throw new BadRequestException(
        'Plan cannot be approved in its current state',
      );
    }
    const unresolved = plan.entries.filter((e) => {
      if (e.status === PromotionPlanEntryStatus.CONFLICTED) return true;
      if (e.action === 'GRADUATE' || e.action === 'SKIP') return false;
      if (e.action === 'RETAIN') return false;
      const finalClass = e.overrideClassId ?? e.suggestedClassId;
      return !finalClass;
    });
    if (unresolved.length) {
      throw new ConflictException(
        `Cannot approve — ${unresolved.length} entries still have conflicts`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.promotionPlan.update({
        where: { id: planId },
        data: {
          status: PromotionPlanStatus.APPROVED,
          approvedById: actor.id,
          approvedAt: new Date(),
          notes: dto.notes ?? plan.notes,
        },
      });
      await tx.promotionPlanEntry.updateMany({
        where: {
          planId,
          status: {
            in: [
              PromotionPlanEntryStatus.PENDING,
              PromotionPlanEntryStatus.OVERRIDDEN,
            ],
          },
        },
        data: { status: PromotionPlanEntryStatus.APPROVED },
      });
      await this.activity.log(
        {
          action: ActivityAction.STATUS_CHANGE,
          entityType: ActivityEntityType.PROMOTION,
          entityId: planId,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} approved promotion plan`,
        },
        tx,
      );
    });
    return this.findOne(planId, actor);
  }

  // ═══════════════════════════════════════════════════════════════
  //  EXECUTE
  // ═══════════════════════════════════════════════════════════════
  async execute(planId: string, _dto: ExecutePlanDto, actor: RequestActor) {
    const gate = await this.rules.canExecutePromotion(actor.tenantId);
    if (!gate.allowed) throw new ForbiddenException(gate.reason);

    const plan = await this.prisma.promotionPlan.findFirst({
      where: { id: planId, tenantId: actor.tenantId },
      include: { entries: true },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.status !== PromotionPlanStatus.APPROVED) {
      throw new BadRequestException('Only APPROVED plans can be executed');
    }

    await this.prisma.promotionPlan.update({
      where: { id: planId },
      data: { status: PromotionPlanStatus.EXECUTING },
    });

    const results: ExecutionResults = {
      promoted: 0,
      graduated: 0,
      retained: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (const entry of plan.entries) {
      try {
        await this.executeEntry(plan, entry, actor, results);
      } catch (e: any) {
        results.failed++;
        results.errors.push({
          entryId: entry.id,
          error: e?.message ?? 'Unknown error',
        });
      }
    }

    await this.prisma.promotionPlan.update({
      where: { id: planId },
      data: {
        status: PromotionPlanStatus.EXECUTED,
        executedAt: new Date(),
        executedById: actor.id,
        summary: {
          ...((plan.summary as Prisma.JsonObject) ?? {}),
          execution: results as unknown as Prisma.JsonObject,
        } as Prisma.InputJsonValue,
      },
    });

    await this.activity.log({
      action: ActivityAction.PROMOTION,
      entityType: ActivityEntityType.PROMOTION,
      entityId: planId,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} executed plan: ${results.promoted} promoted, ${results.graduated} graduated, ${results.retained} retained, ${results.failed} failed`,
      metadata: results as unknown as Prisma.InputJsonValue,
    });

    this.events.emit('BULK_PROMOTION_COMPLETED', {
      tenantId: actor.tenantId,
      planId,
      result: results,
    });
    return { planId, ...results };
  }

  private async executeEntry(
    plan: PlanWithEntries,
    entry: PlanEntry,
    actor: RequestActor,
    results: ExecutionResults,
  ) {
    await this.prisma.$transaction(async (tx) => {
      if (entry.action === 'SKIP') {
        await tx.promotionPlanEntry.update({
          where: { id: entry.id },
          data: {
            status: PromotionPlanEntryStatus.SKIPPED,
            executedAt: new Date(),
          },
        });
        results.skipped++;
        return;
      }

      if (entry.action === 'GRADUATE') {
        await tx.student.update({
          where: { id: entry.studentId },
          data: { academicStatus: StudentStatus.GRADUATED },
        });
        await tx.studentClassHistory.updateMany({
          where: {
            tenantId: actor.tenantId,
            studentId: entry.studentId,
            isCurrent: true,
          },
          data: { isCurrent: false, endDate: new Date() },
        });
        const promo = await tx.studentPromotion.create({
          data: {
            tenantId: actor.tenantId,
            studentId: entry.studentId,
            fromClassId: entry.fromClassId,
            toClassId: null,
            academicYearId: plan.toAcademicYearId,
            status: PromotionStatus.GRADUATED,
            promotedById: actor.id,
            promotedAt: new Date(),
            notes: `Plan ${plan.id}`,
          },
        });
        await tx.promotionPlanEntry.update({
          where: { id: entry.id },
          data: {
            status: PromotionPlanEntryStatus.GRADUATED,
            executedAt: new Date(),
            finalClassId: null,
            finalStreamId: null,
            executedPromotionId: promo.id,
          },
        });
        results.graduated++;
        return;
      }

      if (entry.action === 'RETAIN') {
        const finalClassId =
          entry.overrideClassId ?? entry.suggestedClassId ?? entry.fromClassId;
        if (!finalClassId) throw new Error('RETAIN has no class');

        const finalStreamId =
          entry.overrideStreamId ??
          entry.suggestedStreamId ??
          entry.fromStreamId ??
          null;

        await this.history.createEntry(
          actor.tenantId,
          {
            studentId: entry.studentId,
            classId: finalClassId,
            academicYearId: plan.toAcademicYearId,
            streamId: finalStreamId,
            startDate: new Date().toISOString(),
            reason: 'REPETITION',
            isCurrent: true,
          },
          actor.id,
          tx,
        );
        const promo = await tx.studentPromotion.create({
          data: {
            tenantId: actor.tenantId,
            studentId: entry.studentId,
            fromClassId: entry.fromClassId,
            toClassId: finalClassId,
            academicYearId: plan.toAcademicYearId,
            status: PromotionStatus.RETAINED,
            promotedById: actor.id,
            promotedAt: new Date(),
            notes: `Plan ${plan.id}`,
          },
        });
        await tx.promotionPlanEntry.update({
          where: { id: entry.id },
          data: {
            status: PromotionPlanEntryStatus.RETAINED,
            executedAt: new Date(),
            finalClassId,
            finalStreamId,
            executedPromotionId: promo.id,
          },
        });
        results.retained++;
        return;
      }

      // PROMOTE
      const finalClassId = entry.overrideClassId ?? entry.suggestedClassId;
      const finalStreamId =
        entry.overrideStreamId ?? entry.suggestedStreamId ?? null;

      if (!finalClassId) throw new Error('PROMOTE has no target class');

      await this.history.createEntry(
        actor.tenantId,
        {
          studentId: entry.studentId,
          classId: finalClassId,
          academicYearId: plan.toAcademicYearId,
          streamId: finalStreamId,
          startDate: new Date().toISOString(),
          reason: 'AUTO_PROMOTION',
          isCurrent: true,
        },
        actor.id,
        tx,
      );
      const promo = await tx.studentPromotion.create({
        data: {
          tenantId: actor.tenantId,
          studentId: entry.studentId,
          fromClassId: entry.fromClassId,
          toClassId: finalClassId,
          academicYearId: plan.toAcademicYearId,
          status: PromotionStatus.PROMOTED,
          promotedById: actor.id,
          promotedAt: new Date(),
          notes: `Plan ${plan.id}`,
        },
      });
      await tx.promotionPlanEntry.update({
        where: { id: entry.id },
        data: {
          status: PromotionPlanEntryStatus.APPROVED,
          executedAt: new Date(),
          finalClassId,
          finalStreamId,
          executedPromotionId: promo.id,
        },
      });
      results.promoted++;
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  CANCEL
  // ═══════════════════════════════════════════════════════════════
  async cancel(planId: string, actor: RequestActor) {
    const plan = await this.prisma.promotionPlan.findFirst({
      where: { id: planId, tenantId: actor.tenantId },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.status === PromotionPlanStatus.EXECUTED) {
      throw new BadRequestException('Cannot cancel an executed plan');
    }
    await this.prisma.promotionPlan.update({
      where: { id: planId },
      data: {
        status: PromotionPlanStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: actor.id,
      },
    });
    await this.activity.log({
      action: ActivityAction.STATUS_CHANGE,
      entityType: ActivityEntityType.PROMOTION,
      entityId: planId,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} cancelled promotion plan`,
    });
    return { cancelled: true };
  }
}

function summariseEntries(
  entries: Array<{
    action: string;
    status: PromotionPlanEntryStatus;
    warnings?: unknown;
  }>,
) {
  return {
    promoted: entries.filter((e) => e.action === 'PROMOTE').length,
    graduated: entries.filter((e) => e.action === 'GRADUATE').length,
    retained: entries.filter((e) => e.action === 'RETAIN').length,
    skipped: entries.filter((e) => e.action === 'SKIP').length,
    conflicts: entries.filter(
      (e) => e.status === PromotionPlanEntryStatus.CONFLICTED,
    ).length,
    warnings: entries.filter(
      (e) => Array.isArray(e.warnings) && (e.warnings as unknown[]).length > 0,
    ).length,
  };
}
