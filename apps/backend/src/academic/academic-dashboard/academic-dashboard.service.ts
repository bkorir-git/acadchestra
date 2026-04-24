/**
 * @service AcademicDashboardService
 * @description Aggregated academic overview — current year, term, progress %,
 *   financials, enrollment distribution, activation suggestions.
 *   Identical compute to the legacy DashboardService but scoped under the
 *   Academic module for clearer ownership.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ProgressService } from '../../common/progress/progress.service';
import { ActivityService } from '../../common/activity/activity.service';

@Injectable()
export class AcademicDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
    private readonly activity: ActivityService,
  ) {}

  async getStats(actor: { tenantId: string; id: string }) {
    return this.overview(actor);
  }

  async getActivity(actor: { tenantId: string }) {
    return this.activity.getRecentFeed({ tenantId: actor.tenantId } as any, 10);
  }

  async overview(actor: { tenantId: string }) {
    const tenantId = actor.tenantId;

    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId, isCurrent: true },
      include: { terms: { orderBy: { termNumber: 'asc' } } },
    });

    const baseCounts = await this.collectBaseCounts(tenantId);
    if (!year) return { hasCurrentYear: false, ...baseCounts };

    const now = new Date();
    const progress = await this.progress.getAcademicProgress(
      year.id,
      tenantId,
      now,
    );
    const suggestions = await this.progress.getActivationSuggestions(tenantId);

    const [billed, paid, pending, overdueCount] = await Promise.all([
      this.sum(tenantId, year.id, 'totalAmount'),
      this.sum(tenantId, year.id, 'paidAmount'),
      this.sum(tenantId, year.id, 'pendingAmount'),
      this.prisma.studentFee.count({
        where: {
          tenantId,
          dueDate: { lt: now },
          pendingAmount: { gt: 0 },
          feeStructure: { academicYearId: year.id },
        },
      }),
    ]);

    const classDistribution = await this.prisma.class.findMany({
      where: { tenantId, academicYearId: year.id },
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        stream: true,
        capacity: true,
        _count: { select: { students: true } },
      },
      orderBy: [{ gradeLevel: 'asc' }, { name: 'asc' }],
    });

    const activeTerm = year.terms.find((t) => t.isActive) ?? null;

    return {
      hasCurrentYear: true,
      ...baseCounts,
      academicYear: {
        id: year.id,
        name: year.name,
        startDate: year.startDate,
        endDate: year.endDate,
        status: year.status,
        isLocked: year.isLocked,
        isFinanciallyLocked: year.isFinanciallyLocked,
      },
      progress,
      activeTerm: activeTerm
        ? {
            id: activeTerm.id,
            name: activeTerm.name,
            shortName: activeTerm.shortName,
            termNumber: activeTerm.termNumber,
            startDate: activeTerm.startDate,
            endDate: activeTerm.endDate,
            isLocked: activeTerm.isLocked,
          }
        : null,
      terms: year.terms.map((t) => ({
        id: t.id,
        name: t.name,
        shortName: t.shortName,
        termNumber: t.termNumber,
        startDate: t.startDate,
        endDate: t.endDate,
        isActive: t.isActive,
        isLocked: t.isLocked,
      })),
      financials: {
        billed,
        paid,
        pending,
        collectionRate:
          billed > 0 ? Math.round((paid / billed) * 1000) / 10 : 0,
        overdueInvoices: overdueCount,
      },
      classDistribution: classDistribution.map((c) => ({
        id: c.id,
        name: c.name,
        gradeLevel: c.gradeLevel,
        stream: c.stream,
        capacity: c.capacity,
        studentCount: c._count.students,
      })),
      activationSuggestions: suggestions,
    };
  }

  private async collectBaseCounts(tenantId: string) {
    const [studentCount, teacherCount, classCount, activeYearCount] =
      await Promise.all([
        this.prisma.student.count({
          where: { tenantId, academicStatus: 'ACTIVE' },
        }),
        this.prisma.teacher.count({
          where: { tenantId, employmentStatus: 'ACTIVE' },
        }),
        this.prisma.class.count({ where: { tenantId } }),
        this.prisma.academicYear.count({
          where: { tenantId, status: 'ACTIVE' },
        }),
      ]);
    return { studentCount, teacherCount, classCount, activeYearCount };
  }

  private async sum(
    tenantId: string,
    yearId: string,
    field: 'totalAmount' | 'paidAmount' | 'pendingAmount',
  ) {
    const agg = await this.prisma.studentFee.aggregate({
      where: { tenantId, feeStructure: { academicYearId: yearId } },
      _sum: { [field]: true } as any,
    });
    return Number((agg._sum as any)[field] ?? 0);
  }
}
