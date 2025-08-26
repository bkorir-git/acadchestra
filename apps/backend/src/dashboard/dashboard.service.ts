import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(user: any) {
    const userRoles = user.userRoles?.map(ur => ur.role.name) || [];
    const isSuperAdmin = userRoles.includes('SuperAdmin');
    const isAdmin = userRoles.includes('Admin');
    const isPrincipal = userRoles.includes('Principal');
    const isTeacher = userRoles.includes('Teacher');

    if (isSuperAdmin) {
      return this.getSuperAdminStats();
    } else if (isAdmin) {
      return this.getAdminStats(user.tenantId);
    } else if (isPrincipal) {
      return this.getPrincipalStats(user.tenantId);
    } else if (isTeacher) {
      return this.getTeacherStats(user.id, user.tenantId);
    }

    return {};
  }

  private async getSuperAdminStats() {
    const [
      totalTenants,
      activeSchools,
      totalStudents,
      totalTeachers,
      lastMonthTenants,
      lastMonthStudents,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.student.count(),
      this.prisma.teacher.count(),
      this.prisma.tenant.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 1))
          }
        }
      }),
      this.prisma.student.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 1))
          }
        }
      }),
    ]);

    // Calculate growth rates
    const tenantGrowth = lastMonthTenants > 0 ? Math.round((lastMonthTenants / Math.max(totalTenants - lastMonthTenants, 1)) * 100) : 0;
    const studentGrowth = lastMonthStudents > 0 ? Math.round((lastMonthStudents / Math.max(totalStudents - lastMonthStudents, 1)) * 100) : 0;

    return {
      totalTenants,
      activeSchools,
      totalStudents,
      totalRevenue: totalTenants * 99, // Mock calculation
      tenantGrowth,
      activeGrowth: Math.round((activeSchools / Math.max(totalTenants, 1)) * 100),
      studentGrowth,
      revenueGrowth: tenantGrowth, // Revenue grows with tenants
    };
  }

  private async getAdminStats(tenantId: string) {
    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      activeStudents,
      lastMonthStudents,
      lastMonthTeachers,
    ] = await Promise.all([
      this.prisma.student.count({ where: { tenantId } }),
      this.prisma.teacher.count({ where: { tenantId } }),
      this.prisma.class.count({ where: { tenantId } }),
      this.prisma.student.count({ 
        where: { 
          tenantId,
          academicStatus: 'ACTIVE'
        } 
      }),
      this.prisma.student.count({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 1))
          }
        }
      }),
      this.prisma.teacher.count({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 1))
          }
        }
      }),
    ]);

    const todayAttendance = activeStudents > 0 ? Math.round((activeStudents * 0.92) / activeStudents * 100) : 0; // Mock 92% attendance
    const studentGrowth = lastMonthStudents > 0 ? Math.round((lastMonthStudents / Math.max(totalStudents - lastMonthStudents, 1)) * 100) : 0;
    const teacherGrowth = lastMonthTeachers > 0 ? Math.round((lastMonthTeachers / Math.max(totalTeachers - lastMonthTeachers, 1)) * 100) : 0;

    return {
      schoolStats: {
        totalStudents,
        totalTeachers,
        totalClasses,
        todayAttendance,
        studentGrowth,
        teacherGrowth,
        attendanceChange: 2, // Mock 2% improvement
      }
    };
  }

  private async getPrincipalStats(tenantId: string) {
    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      pendingIssues,
    ] = await Promise.all([
      this.prisma.student.count({ where: { tenantId } }),
      this.prisma.teacher.count({ where: { tenantId } }),
      this.prisma.class.count({ where: { tenantId } }),
      // Mock pending issues - in real app this would be from an issues/tickets table
      Promise.resolve(3),
    ]);

    return {
      academicStats: {
        totalStudents,
        totalTeachers,
        totalClasses,
        pendingIssues,
      }
    };
  }

  private async getTeacherStats(userId: string, tenantId: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId },
      include: {
        classesAsTeacher: {
          include: {
            students: true
          }
        },
        subjectsTaught: {
          include: {
            class: {
              include: {
                students: true
              }
            }
          }
        }
      }
    });

    if (!teacher) {
      return {
        teacherStats: {
          myClasses: 0,
          myStudents: 0,
          todayClasses: 0,
          pendingGrading: 0,
        }
      };
    }

    const myClasses = teacher.classesAsTeacher.length + teacher.subjectsTaught.length;
    const myStudents = [
      ...teacher.classesAsTeacher.flatMap(c => c.students),
      ...teacher.subjectsTaught.flatMap(s => s.class.students)
    ].length;

    return {
      teacherStats: {
        myClasses,
        myStudents,
        todayClasses: Math.min(myClasses, 4), // Mock: max 4 classes per day
        pendingGrading: Math.floor(myStudents * 0.1), // Mock: 10% of students have pending grades
      }
    };
  }

  async getRecentActivity(user: any) {
    const userRoles = user.userRoles?.map(ur => ur.role.name) || [];
    const isSuperAdmin = userRoles.includes('SuperAdmin');
    
    if (isSuperAdmin) {
      // Get recent tenants and system activity
      const recentTenants = await this.prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          name: true,
          createdAt: true,
          isActive: true,
        }
      });

      return recentTenants.map(tenant => ({
        title: `New tenant: ${tenant.name}`,
        description: `Tenant ${tenant.isActive ? 'activated' : 'created'} successfully`,
        timestamp: this.formatRelativeTime(tenant.createdAt),
        type: 'success' as const,
      }));
    } else {
      // Get recent activity for the tenant
      const recentUsers = await this.prisma.user.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          firstName: true,
          lastName: true,
          createdAt: true,
          userRoles: {
            include: {
              role: true
            }
          }
        }
      });

      return recentUsers.map(u => ({
        title: `New user: ${u.firstName} ${u.lastName}`,
        description: `${u.userRoles[0]?.role.name || 'User'} account created`,
        timestamp: this.formatRelativeTime(u.createdAt),
        type: 'info' as const,
      }));
    }
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return date.toLocaleDateString();
  }
}
