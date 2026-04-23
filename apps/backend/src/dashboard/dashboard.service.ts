/**
 * @description Dashboard service — role-aware stats + activity feed.

 *     - Teacher stats include REAL data:
 *         · myClasses         (classTeacher or teaches a subject)
 *         · myStudents        (sum of enrolled in those classes, deduped)
 *         · todayClasses      (same as myClasses; 1 daily register per class)
 *         · pendingGrading    (classes without a DRAFT→FINALIZED today session)
 *         · todayAttendance   (average rate across the teacher's classes today)
 *     - Admin/Principal stats include `todayAttendance` + `attendanceChange`
 *       vs the previous day, sourced from AttendanceSession aggregates.
 */

import { Injectable } from '@nestjs/common';
import { AttendanceSessionType } from '@prisma/client';
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

  private toDateOnly(d = new Date()) {
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  private addDays(base: Date, n: number) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + n);
    return d;
  }

  async getStats(user: any) {
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

    /* ───────── Teacher-only branch ───────── */
    if (this.isTeacherOnly(user) && user.teacher?.id) {
      const teacherId = user.teacher.id;
      const today = this.toDateOnly();

      const myClasses = await this.prisma.class.findMany({
        where: {
          tenantId,
          OR: [
            { classTeacherId: teacherId },
            { subjects: { some: { teacherId } } },
          ],
        },
        select: {
          id: true,
          _count: { select: { students: true } },
          attendanceSessions: {
            where: {
              sessionDate: today,
              type: AttendanceSessionType.DAILY,
              subjectId: null,
            },
            select: {
              id: true,
              status: true,
              presentCount: true,
              totalStudents: true,
            },
            take: 1,
          },
        },
      });

      const myClassCount = myClasses.length;
      const myStudents = myClasses.reduce(
        (a, c) => a + (c._count?.students ?? 0),
        0,
      );

      const taken = myClasses.filter((c) => c.attendanceSessions.length > 0);
      const pending = myClassCount - taken.length;

      const sumPresent = taken.reduce(
        (a, c) => a + (c.attendanceSessions[0]?.presentCount ?? 0),
        0,
      );
      const sumTotal = taken.reduce(
        (a, c) => a + (c.attendanceSessions[0]?.totalStudents ?? 0),
        0,
      );
      const todayAttendance =
        sumTotal > 0 ? Math.round((sumPresent / sumTotal) * 1000) / 10 : null;

      return {
        myClasses: myClassCount,
        myStudents,
        todayClasses: myClassCount,
        pendingGrading: pending,
        todayAttendance,
      };
    }

    /* ───────── Admin / Principal branch ───────── */
    const currentYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isCurrent: true },
    });

    if (!currentYear) {
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

    const today = this.toDateOnly();
    const yesterday = this.addDays(today, -1);

    const [studentCount, classCount, activeTerm, feeStats, todayAgg, yAgg] =
      await Promise.all([
        this.prisma.studentClassHistory.count({
          where: { tenantId, academicYearId: currentYear.id, isCurrent: true },
        }),
        this.prisma.class.count({
          where: { tenantId, academicYearId: currentYear.id },
        }),
        this.prisma.academicTerm.findFirst({
          where: { tenantId, academicYearId: currentYear.id, isActive: true },
          select: { id: true, name: true, termNumber: true },
        }),
        this.prisma.studentFee.aggregate({
          where: { tenantId },
          _sum: { paidAmount: true, totalAmount: true },
        }),
        this.prisma.attendanceSession.aggregate({
          where: {
            tenantId,
            academicYearId: currentYear.id,
            sessionDate: today,
          },
          _sum: { presentCount: true, totalStudents: true },
        }),
        this.prisma.attendanceSession.aggregate({
          where: {
            tenantId,
            academicYearId: currentYear.id,
            sessionDate: yesterday,
          },
          _sum: { presentCount: true, totalStudents: true },
        }),
      ]);

    const teacherRows = await this.prisma.class.findMany({
      where: {
        tenantId,
        academicYearId: currentYear.id,
        classTeacherId: { not: null },
      },
      select: { classTeacherId: true },
      distinct: ['classTeacherId'],
    });

    const paid = feeStats._sum.paidAmount ?? 0;
    const total = feeStats._sum.totalAmount ?? 0;
    const feeCollectionRate =
      total > 0 ? Math.round((paid / total) * 1000) / 10 : 0;

    const todayPresent = todayAgg._sum.presentCount ?? 0;
    const todayTotal = todayAgg._sum.totalStudents ?? 0;
    const todayAttendance =
      todayTotal > 0
        ? Math.round((todayPresent / todayTotal) * 1000) / 10
        : null;

    const yPresent = yAgg._sum.presentCount ?? 0;
    const yTotal = yAgg._sum.totalStudents ?? 0;
    const yRate = yTotal > 0 ? (yPresent / yTotal) * 100 : null;
    const attendanceChange =
      todayAttendance != null && yRate != null
        ? Math.round((todayAttendance - yRate) * 10) / 10
        : 0;

    return {
      academicYearId: currentYear.id,
      academicYearName: currentYear.name,
      totalStudents: studentCount,
      totalClasses: classCount,
      totalTeachers: teacherRows.length,
      currentTerm: activeTerm ?? null,
      feeCollectionRate,
      todayAttendance,
      attendanceChange,
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
