/**
 * @service CalendarRulesService
 * @description The Academic Calendar Rule Engine.
 *   Derives the CURRENT phase for a tenant from:
 *     - Academic year status (DRAFT/ACTIVE/ARCHIVED/LOCKED)
 *     - Current period type (TERM/EXAM_WEEK/HOLIDAY/MID_TERM_BREAK)
 *     - Active term state
 *     - Promotion-window dates
 *
 *   Exposes typed gate functions used across the system:
 *     - canCreateClasses()
 *     - canEditClasses()
 *     - canEnrollStudents()
 *     - canGenerateBilling()
 *     - canRecordPayments()
 *     - canCreatePromotionPlan()
 *     - canExecutePromotion()
 *
 *   IMPORTANT: this service NEVER performs side-effects. It only reports
 *   the current phase and answers yes/no gate questions. Services consuming
 *   it are responsible for throwing ForbiddenException when blocked.
 */
import { Injectable, Logger } from '@nestjs/common';
import { AcademicPeriodType, AcademicYearStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CalendarPhase } from './calendar-phase.enum';

export interface PhaseContext {
  tenantId: string;
  academicYearId: string | null;
  academicYearName: string | null;
  phase: CalendarPhase;
  currentTerm: { id: string; name: string; isActive: boolean } | null;
  currentPeriod: { id: string; name: string; type: AcademicPeriodType } | null;
  inPromotionWindow: boolean;
  isAcademicallyLocked: boolean;
  isFinanciallyLocked: boolean;
  reason: string;
}

export interface GateResult {
  allowed: boolean;
  reason: string;
  phase: CalendarPhase;
}

@Injectable()
export class CalendarRulesService {
  private readonly logger = new Logger(CalendarRulesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Derive the current phase for a tenant at `now`. */
  async getPhaseContext(
    tenantId: string,
    now: Date = new Date(),
  ): Promise<PhaseContext> {
    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId, isCurrent: true },
      include: {
        terms: { orderBy: { termNumber: 'asc' } },
        academicPeriods: { orderBy: { startDate: 'asc' } },
      },
    });

    if (!year) {
      return {
        tenantId,
        academicYearId: null,
        academicYearName: null,
        phase: CalendarPhase.SETUP,
        currentTerm: null,
        currentPeriod: null,
        inPromotionWindow: false,
        isAcademicallyLocked: false,
        isFinanciallyLocked: false,
        reason: 'No active academic year — system is in initial SETUP',
      };
    }

    if (year.status === AcademicYearStatus.ARCHIVED) {
      return {
        tenantId,
        academicYearId: year.id,
        academicYearName: year.name,
        phase: CalendarPhase.ARCHIVED,
        currentTerm: null,
        currentPeriod: null,
        inPromotionWindow: false,
        isAcademicallyLocked: true,
        isFinanciallyLocked: true,
        reason: 'Academic year is archived',
      };
    }

    const activeTerm = year.terms.find((t) => t.isActive) ?? null;
    const containing = year.academicPeriods.filter(
      (p) => now >= p.startDate && now <= p.endDate,
    );
    const priority: Record<AcademicPeriodType, number> = {
      EXAM_WEEK: 0,
      MID_TERM_BREAK: 1,
      HOLIDAY: 2,
      TERM: 3,
    };
    containing.sort(
      (a, b) => (priority[a.type] ?? 99) - (priority[b.type] ?? 99),
    );
    const currentPeriod = containing[0] ?? null;

    // Promotion window detection
    const windowStart =
      year.promotionWindowStart ??
      this.defaultPromotionWindowStart(year.endDate);
    const windowEnd = year.promotionWindowEnd ?? year.endDate;
    const inPromotionWindow = now >= windowStart && now <= windowEnd;

    // Phase resolution
    let phase: CalendarPhase;
    let reason: string;

    if (year.status === AcademicYearStatus.DRAFT) {
      phase = CalendarPhase.SETUP;
      reason = 'Year is in DRAFT — structural setup allowed';
    } else if (year.status === AcademicYearStatus.LOCKED) {
      phase = CalendarPhase.BREAK;
      reason = 'Year is locked';
    } else if (inPromotionWindow) {
      phase = CalendarPhase.PROMOTION_WINDOW;
      reason = 'Year-end promotion window is active';
    } else if (currentPeriod?.type === 'EXAM_WEEK') {
      phase = CalendarPhase.EXAMS;
      reason = `Exam period: ${currentPeriod.name}`;
    } else if (
      currentPeriod?.type === 'HOLIDAY' ||
      currentPeriod?.type === 'MID_TERM_BREAK'
    ) {
      phase = CalendarPhase.BREAK;
      reason = `On break: ${currentPeriod.name}`;
    } else if (activeTerm) {
      phase = CalendarPhase.TEACHING;
      reason = `Teaching period: ${activeTerm.name}`;
    } else if (now < year.startDate) {
      phase = CalendarPhase.SETUP;
      reason = 'Year has not started yet';
    } else {
      phase = CalendarPhase.BREAK;
      reason = 'Between terms with no active period';
    }

    return {
      tenantId,
      academicYearId: year.id,
      academicYearName: year.name,
      phase,
      currentTerm: activeTerm
        ? {
            id: activeTerm.id,
            name: activeTerm.name,
            isActive: activeTerm.isActive,
          }
        : null,
      currentPeriod: currentPeriod
        ? {
            id: currentPeriod.id,
            name: currentPeriod.name,
            type: currentPeriod.type,
          }
        : null,
      inPromotionWindow,
      isAcademicallyLocked: year.isLocked,
      isFinanciallyLocked: year.isFinanciallyLocked,
      reason,
    };
  }

  private defaultPromotionWindowStart(yearEnd: Date): Date {
    const start = new Date(yearEnd);
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  // ─────────────────────────── GATES ───────────────────────────
  async canCreateClasses(tenantId: string): Promise<GateResult> {
    const ctx = await this.getPhaseContext(tenantId);
    if (ctx.isAcademicallyLocked)
      return this.deny(ctx, 'Academic year is locked');
    if ([CalendarPhase.SETUP, CalendarPhase.BREAK].includes(ctx.phase)) {
      return this.allow(ctx, 'Classes can be created in SETUP or BREAK phases');
    }
    if (ctx.phase === CalendarPhase.TEACHING) {
      return this.allow(
        ctx,
        'Classes can be created during TEACHING (with caution)',
      );
    }
    return this.deny(ctx, `Cannot create classes during ${ctx.phase}`);
  }

  async canEditClasses(tenantId: string): Promise<GateResult> {
    const ctx = await this.getPhaseContext(tenantId);
    if (ctx.isAcademicallyLocked)
      return this.deny(ctx, 'Academic year is locked');
    if (ctx.phase === CalendarPhase.EXAMS) {
      return this.deny(ctx, 'Class structure cannot change during EXAMS');
    }
    if (ctx.phase === CalendarPhase.ARCHIVED) {
      return this.deny(ctx, 'Year is archived — read-only');
    }
    return this.allow(ctx, 'Edits allowed');
  }

  async canEnrollStudents(tenantId: string): Promise<GateResult> {
    const ctx = await this.getPhaseContext(tenantId);
    if (ctx.isAcademicallyLocked)
      return this.deny(ctx, 'Academic year is locked');
    if (ctx.phase === CalendarPhase.ARCHIVED) {
      return this.deny(ctx, 'Cannot enroll in archived year');
    }
    if (ctx.phase === CalendarPhase.EXAMS) {
      return this.deny(ctx, 'Enrollment disabled during EXAMS');
    }
    return this.allow(ctx, 'Enrollment allowed');
  }

  async canGenerateBilling(tenantId: string): Promise<GateResult> {
    const ctx = await this.getPhaseContext(tenantId);
    if (ctx.isFinanciallyLocked)
      return this.deny(ctx, 'Year is financially locked');
    if (
      [CalendarPhase.TEACHING, CalendarPhase.SETUP].includes(ctx.phase) ||
      ctx.phase === CalendarPhase.BREAK
    ) {
      return this.allow(ctx, 'Billing allowed');
    }
    return this.deny(ctx, `Billing disabled during ${ctx.phase}`);
  }

  async canRecordPayments(tenantId: string): Promise<GateResult> {
    const ctx = await this.getPhaseContext(tenantId);
    if (ctx.isFinanciallyLocked)
      return this.deny(ctx, 'Year is financially locked');
    if (ctx.phase === CalendarPhase.ARCHIVED) {
      return this.deny(ctx, 'Archived year — no payments');
    }
    return this.allow(ctx, 'Payments allowed');
  }

  async canCreatePromotionPlan(tenantId: string): Promise<GateResult> {
    const ctx = await this.getPhaseContext(tenantId);
    // Plans can be created in advance
    if (ctx.phase === CalendarPhase.ARCHIVED) {
      return this.deny(ctx, 'Cannot plan promotions in archived year');
    }
    return this.allow(ctx, 'Plan creation allowed');
  }

  async canExecutePromotion(tenantId: string): Promise<GateResult> {
    const ctx = await this.getPhaseContext(tenantId);
    if (ctx.phase !== CalendarPhase.PROMOTION_WINDOW) {
      return this.deny(
        ctx,
        `Promotions may only execute in PROMOTION_WINDOW. Current: ${ctx.phase}`,
      );
    }
    if (ctx.isAcademicallyLocked) {
      return this.deny(ctx, 'Year is academically locked');
    }
    return this.allow(ctx, 'In promotion window — execution allowed');
  }

  private allow(ctx: PhaseContext, reason: string): GateResult {
    return { allowed: true, reason, phase: ctx.phase };
  }

  private deny(ctx: PhaseContext, reason: string): GateResult {
    return { allowed: false, reason, phase: ctx.phase };
  }
}
