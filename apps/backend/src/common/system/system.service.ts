/**
 * @file system.service.ts
 * @description Platform health + metrics + activity-driven logs.
 *   Uses ActivityLog for the system feed (not AuditLog), per decision #12.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SystemService {
  constructor(private readonly prisma: PrismaService) {}

  async getSystemHealth() {
    const startTime = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - startTime;

      const [
        totalTenants,
        activeTenants,
        totalUsers,
        activeUsers,
        totalStudents,
        totalTeachers,
      ] = await Promise.all([
        this.prisma.tenant.count(),
        this.prisma.tenant.count({ where: { isActive: true } }),
        this.prisma.user.count(),
        this.prisma.user.count({
          where: {
            isActive: true,
            lastLogin: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        this.prisma.student.count(),
        this.prisma.teacher.count(),
      ]);

      const memoryUsage = process.memoryUsage();
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '2.0.0',
        database: { status: 'connected', latency: dbLatency },
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          usage: Math.round(
            (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
          ),
        },
        statistics: {
          totalTenants,
          activeTenants,
          totalUsers,
          activeUsers,
          totalStudents,
          totalTeachers,
        },
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  async getSystemMetrics() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      recentTenants,
      recentUsers,
      recentStudents,
      loginActivity,
      tenantActivity,
    ] = await Promise.all([
      this.prisma.tenant.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.student.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.getLoginActivity(sevenDaysAgo),
      this.getTenantActivity(thirtyDaysAgo),
    ]);

    return {
      growth: {
        newTenants: recentTenants,
        newUsers: recentUsers,
        newStudents: recentStudents,
      },
      activity: { loginActivity, tenantActivity },
    };
  }

  /** Use ActivityLog for the system feed. */
  async getSystemLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          tenant: { select: { id: true, name: true } },
        },
      }),
      this.prisma.activityLog.count(),
    ]);
    return {
      data: logs,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async getDatabaseStats() {
    const tables = [
      'tenants',
      'users',
      'students',
      'teachers',
      'classes',
      'subjects',
      'academic_years',
      'audit_logs',
      'activity_logs',
      'upload_assets',
      'backup_jobs',
      'restore_jobs',
    ];
    const stats = await Promise.all(
      tables.map(async (table) => {
        try {
          const result = await this.prisma.$queryRawUnsafe(
            `SELECT COUNT(*) as count FROM "${table}"`,
          );
          return {
            table,
            count: Number((result as any)[0].count),
            status: 'healthy',
          };
        } catch (error: any) {
          return { table, count: 0, status: 'error', error: error.message };
        }
      }),
    );
    return stats;
  }

  private async getLoginActivity(sinceDate: Date) {
    const users = await this.prisma.user.findMany({
      where: { lastLogin: { gte: sinceDate } },
      select: { lastLogin: true },
    });
    const map = new Map<string, number>();
    for (const u of users) {
      if (u.lastLogin) {
        const date = u.lastLogin.toISOString().split('T')[0];
        map.set(date, (map.get(date) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([date, logins]) => ({ date, logins }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  private async getTenantActivity(sinceDate: Date) {
    const tenants = await this.prisma.tenant.findMany({
      where: { createdAt: { gte: sinceDate } },
      select: { createdAt: true },
    });
    const map = new Map<string, number>();
    for (const t of tenants) {
      const date = t.createdAt.toISOString().split('T')[0];
      map.set(date, (map.get(date) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([date, new_tenants]) => ({ date, new_tenants }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  private getSystemVersion() {
    return process.env.npm_package_version || '1.0.0';
  }
}
