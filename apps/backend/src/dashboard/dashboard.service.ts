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

    const [totalStudents, totalTeachers, totalClasses] = await Promise.all([
      this.prisma.student.count({ where: { tenantId } }),
      this.prisma.teacher.count({ where: { tenantId } }),
      this.prisma.class.count({ where: { tenantId } }),
    ]);

    return {
      totalStudents,
      totalTeachers,
      totalClasses,
      todayAttendance: null,
      attendanceChange: 0,
      studentGrowth: 0,
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
