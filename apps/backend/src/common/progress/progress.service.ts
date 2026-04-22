/**
 * @service ProgressService
 * @description Central Progress Engine — derives current academic year, term,
 *   holiday periods, percentage elapsed, and status (NOT_STARTED | IN_PROGRESS | HOLIDAY | COMPLETED).
 *
 *   Contract:
 *     getAcademicProgress(yearId) => {
 *       percentage, currentTerm, currentPeriodType, status,
 *       daysElapsed, daysRemaining, totalDays
 *     }
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AcademicPeriodType,
  AcademicProgressStatus,
  AcademicTerm,
  AcademicYear,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface AcademicProgressResult {
  academicYearId: string;
  academicYearName: string;
  startDate: Date;
  endDate: Date;
  percentage: number;
  status: AcademicProgressStatus;
  currentTerm: AcademicTerm | null;
  currentPeriodType: AcademicPeriodType | null;
  currentPeriodName: string | null;
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
}

export interface TermProgressResult {
  termId: string;
  termName: string;
  startDate: Date;
  endDate: Date;
  percentage: number;
  status: AcademicProgressStatus;
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
  isActive: boolean;
  isLocked: boolean;
}

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  private daysBetween(a: Date, b: Date): number {
    const ms = b.getTime() - a.getTime();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  private computePercentage(start: Date, end: Date, now: Date): number {
    if (now <= start) return 0;
    if (now >= end) return 100;
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    return Math.round((elapsed / total) * 10000) / 100;
  }

  // ─────────────────────── YEAR PROGRESS
  async getAcademicProgress(
    academicYearId: string,
    tenantId: string,
    now: Date = new Date(),
  ): Promise<AcademicProgressResult> {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      include: {
        terms: { orderBy: { termNumber: 'asc' } },
        academicPeriods: { orderBy: { startDate: 'asc' } },
      },
    });
    if (!year) throw new NotFoundException('Academic year not found');

    const percentage = this.computePercentage(
      year.startDate,
      year.endDate,
      now,
    );

    let status: AcademicProgressStatus = AcademicProgressStatus.IN_PROGRESS;
    if (now < year.startDate) status = AcademicProgressStatus.NOT_STARTED;
    else if (now > year.endDate) status = AcademicProgressStatus.COMPLETED;

    const currentTerm =
      year.terms.find((t) => now >= t.startDate && now <= t.endDate) ?? null;

    // Detect containing period — prefer TERM over other types
    const candidates = year.academicPeriods.filter(
      (p) => now >= p.startDate && now <= p.endDate,
    );
    const priority: Record<AcademicPeriodType, number> = {
      TERM: 0,
      EXAM_WEEK: 1,
      MID_TERM_BREAK: 2,
      HOLIDAY: 3,
    };
    candidates.sort(
      (a, b) => (priority[a.type] ?? 99) - (priority[b.type] ?? 99),
    );
    const currentPeriod = candidates[0] ?? null;

    if (
      status === AcademicProgressStatus.IN_PROGRESS &&
      !currentTerm &&
      (!currentPeriod || currentPeriod.type !== AcademicPeriodType.TERM)
    ) {
      status = AcademicProgressStatus.HOLIDAY;
    }

    const totalDays = this.daysBetween(year.startDate, year.endDate);
    const daysElapsed =
      now < year.startDate ? 0 : this.daysBetween(year.startDate, now);
    const daysRemaining =
      now > year.endDate ? 0 : this.daysBetween(now, year.endDate);

    return {
      academicYearId: year.id,
      academicYearName: year.name,
      startDate: year.startDate,
      endDate: year.endDate,
      percentage,
      status,
      currentTerm,
      currentPeriodType: currentPeriod?.type ?? null,
      currentPeriodName: currentPeriod?.name ?? null,
      daysElapsed,
      daysRemaining,
      totalDays,
    };
  }

  // ─────────────────────── TERM PROGRESS
  async getTermProgress(
    termId: string,
    tenantId: string,
    now: Date = new Date(),
  ): Promise<TermProgressResult> {
    const term = await this.prisma.academicTerm.findFirst({
      where: { id: termId, tenantId },
    });
    if (!term) throw new NotFoundException('Academic term not found');

    const percentage = this.computePercentage(
      term.startDate,
      term.endDate,
      now,
    );

    let status: AcademicProgressStatus = AcademicProgressStatus.IN_PROGRESS;
    if (now < term.startDate) status = AcademicProgressStatus.NOT_STARTED;
    else if (now > term.endDate) status = AcademicProgressStatus.COMPLETED;

    const totalDays = this.daysBetween(term.startDate, term.endDate);
    const daysElapsed =
      now < term.startDate ? 0 : this.daysBetween(term.startDate, now);
    const daysRemaining =
      now > term.endDate ? 0 : this.daysBetween(now, term.endDate);

    return {
      termId: term.id,
      termName: term.name,
      startDate: term.startDate,
      endDate: term.endDate,
      percentage,
      status,
      daysElapsed,
      daysRemaining,
      totalDays,
      isActive: term.isActive,
      isLocked: term.isLocked,
    };
  }

  // ─────────────────────── CURRENT YEAR/TERM
  async getCurrentAcademicYear(tenantId: string): Promise<AcademicYear | null> {
    return this.prisma.academicYear.findFirst({
      where: { tenantId, isCurrent: true },
    });
  }

  async getCurrentTerm(tenantId: string): Promise<AcademicTerm | null> {
    return this.prisma.academicTerm.findFirst({
      where: { tenantId, isActive: true },
    });
  }

  async findTermByDate(
    tenantId: string,
    date: Date = new Date(),
  ): Promise<AcademicTerm | null> {
    return this.prisma.academicTerm.findFirst({
      where: {
        tenantId,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
  }

  // ─────────────────────── SUGGESTIONS & MISMATCH
  async getActivationSuggestions(tenantId: string, now: Date = new Date()) {
    const horizon = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const upcoming = await this.prisma.academicTerm.findMany({
      where: {
        tenantId,
        isActive: false,
        startDate: { lte: horizon },
        endDate: { gte: now },
        academicYear: { status: { not: 'ARCHIVED' } },
      },
      include: { academicYear: { select: { id: true, name: true } } },
      orderBy: { startDate: 'asc' },
    });

    return upcoming.map((t) => {
      const daysUntilStart = Math.ceil(
        (t.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        termId: t.id,
        termName: t.name,
        academicYearId: t.academicYearId,
        academicYearName: t.academicYear.name,
        startDate: t.startDate,
        endDate: t.endDate,
        daysUntilStart,
        severity:
          daysUntilStart <= 0
            ? 'OVERDUE'
            : daysUntilStart <= 1
              ? 'URGENT'
              : 'UPCOMING',
      };
    });
  }

  async detectMismatch(tenantId: string, now: Date = new Date()) {
    const active = await this.prisma.academicTerm.findFirst({
      where: { tenantId, isActive: true },
    });
    if (!active) return { mismatch: false };
    if (now < active.startDate || now > active.endDate) {
      return {
        mismatch: true,
        activeTermId: active.id,
        activeTermName: active.name,
        startDate: active.startDate,
        endDate: active.endDate,
        reason: now < active.startDate ? 'TERM_NOT_STARTED' : 'TERM_ENDED',
      };
    }
    return { mismatch: false };
  }

  /**
   * Persist a progress snapshot into ReportSnapshot for historical trends.
   */
  async snapshot(
    tenantId: string,
    academicYearId: string,
    now: Date = new Date(),
  ) {
    const p = await this.getAcademicProgress(academicYearId, tenantId, now);
    return this.prisma.reportSnapshot.create({
      data: {
        tenantId,
        key: `academic_progress:${academicYearId}`,
        data: p as any,
        validFrom: now,
      },
    });
  }
}
