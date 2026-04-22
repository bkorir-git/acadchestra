/**
 * @description Dashboard service with role-aware stats and activity feed summaries.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ActivityService } from '../common/activity/activity.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  private isSuperAdmin(user: any) {
    return !!user?.userRoles?.some(
      (entry: any) => entry?.role?.name === 'SuperAdmin',
    );
  }

  private isTeacherOnly(user: any) {
    const roles = user?.userRoles?.map((entry: any) => entry?.role?.name) ?? [];
    return (
      roles.includes('Teacher') &&
      !roles.includes('Admin') &&
      !roles.includes('Principal')
    );
  }

  async getStats(user: any) {
    // ─── SuperAdmin: platform-wide
    if (this.isSuperAdmin(user)) {
      const [
        totalStudents,
        totalTeachers,
        totalTenants,
        totalUsers,
        activeTenants,
      ] = await Promise.all([
        this.prisma.student.count(),
        this.prisma.teacher.count(),
        this.prisma.tenant.count(),
        this.prisma.user.count(),
        this.prisma.tenant.count({ where: { isActive: true } }),
      ]);

      return {
        totalStudents,
        totalTeachers,
        totalTenants,
        totalUsers,
        activeTenants,
      };
    }

    const tenantId = user.tenantId;

    // ─── Teacher-only: personal stats
    if (this.isTeacherOnly(user) && user.teacher?.id) {
      const teacherId = user.teacher.id;
      const [myClasses, myStudents, todayClasses] = await Promise.all([
        this.prisma.class.count({
          where: { tenantId, classTeacherId: teacherId },
        }),
        this.prisma.student.count({
          where: { tenantId, class: { classTeacherId: teacherId } },
        }),
        this.prisma.class.count({
          where: { tenantId, classTeacherId: teacherId },
        }),
      ]);

      return {
        myClasses,
        myStudents,
        todayClasses,
        pendingGrading: 0,
      };
    }

    // ─── Admin / Principal: scoped to CURRENT academic year
    const currentYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isCurrent: true },
    });

    if (!currentYear) {
      // Fresh school — no year configured yet. FE renders empty-state banner.
      return {
        noCurrentYear: true,
        academicYearId: null as string | null,
        academicYearName: null as string | null,
        totalStudents: 0,
        totalClasses: 0,
        totalTeachers: 0,
        currentTerm: null,
        feeCollectionRate: 0,
        todayAttendance: null,
      };
    }

    const [studentCount, classCount, activeTerm, feeStats] = await Promise.all([
      // Students enrolled THIS year — the authoritative source is
      // StudentClassHistory with isCurrent=true for the given academicYearId.
      this.prisma.studentClassHistory.count({
        where: {
          tenantId,
          academicYearId: currentYear.id,
          isCurrent: true,
        },
      }),
      // Classes in THIS year
      this.prisma.class.count({
        where: { tenantId, academicYearId: currentYear.id },
      }),
      // Active term
      this.prisma.academicTerm.findFirst({
        where: { tenantId, academicYearId: currentYear.id, isActive: true },
        select: { id: true, name: true, termNumber: true },
      }),
      // Fee collection — paid vs total on student fees (tenant-wide for now;
      // a per-year scoping can be added once StudentFee records carry a year).
      this.prisma.studentFee.aggregate({
        where: { tenantId },
        _sum: { paidAmount: true, totalAmount: true },
      }),
    ]);

    // Distinct teachers teaching a class in the current year
    const teacherRows = await this.prisma.class.findMany({
      where: {
        tenantId,
        academicYearId: currentYear.id,
        classTeacherId: { not: null },
      },
      select: { classTeacherId: true },
      distinct: ['classTeacherId'],
    });
    const totalTeachers = teacherRows.length;

    const paid = feeStats._sum.paidAmount ?? 0;
    const total = feeStats._sum.totalAmount ?? 0;
    const feeCollectionRate =
      total > 0 ? Math.round((paid / total) * 1000) / 10 : 0;

    return {
      academicYearId: currentYear.id,
      academicYearName: currentYear.name,
      totalStudents: studentCount,
      totalClasses: classCount,
      totalTeachers,
      currentTerm: activeTerm ?? null,
      feeCollectionRate,
      todayAttendance: null, // wire when attendance module exists
    };
  }

  async getActivity(user: any) {
    const items = await this.activityService.getRecentFeed(user, 8);

    return items.map((item) => ({
      id: item.id,
      title: item.message,
      description: item.tenant?.name
        ? `${item.entityType.replace(/_/g, ' ')} • ${item.tenant.name}`
        : item.entityType.replace(/_/g, ' '),
      type:
        item.action === 'DELETE'
          ? 'warning'
          : item.action === 'PAYMENT'
            ? 'success'
            : 'info',
      timestamp: item.createdAt.toISOString(),
    }));
  }
}
