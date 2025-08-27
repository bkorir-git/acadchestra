import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SystemService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getSystemHealth() {
    const startTime = Date.now();
    
    try {
      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - startTime;

      // Get system stats
      const [
        totalTenants,
        activeTenants,
        totalUsers,
        activeUsers,
        totalStudents,
        totalTeachers,
        systemVersion,
      ] = await Promise.all([
        this.prisma.tenant.count(),
        this.prisma.tenant.count({ where: { isActive: true } }),
        this.prisma.user.count(),
        this.prisma.user.count({ 
          where: { 
            isActive: true,
            lastLogin: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          } 
        }),
        this.prisma.student.count(),
        this.prisma.teacher.count(),
        this.getSystemVersion(),
      ]);

      const memoryUsage = process.memoryUsage();

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: systemVersion,
        database: {
          status: 'connected',
          latency: dbLatency,
        },
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          usage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
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
    } catch (error) {
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
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),
      this.prisma.student.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),
      this.getLoginActivity(),
      this.getTenantActivity(),
    ]);

    return {
      growth: {
        newTenants: recentTenants,
        newUsers: recentUsers,
        newStudents: recentStudents,
      },
      activity: {
        loginActivity,
        tenantActivity,
      },
    };
  }

  async getSystemLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        // include: {
        //   // Note: We'll need to add user relation to AuditLog
        // },
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
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
    ];

    const stats = await Promise.all(
      tables.map(async (table) => {
        const count = await this.prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM ${table}`
        );
        return {
          table,
          count: Number((count as any)[0].count),
        };
      })
    );

    return stats;
  }

  private async getLoginActivity() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Get users who logged in within the last 7 days
    const users = await this.prisma.user.findMany({
      where: {
        lastLogin: { gte: sevenDaysAgo }
      },
      select: {
        lastLogin: true,
      },
    });

    // Group by date in JavaScript
    const loginsByDate = users.reduce((acc, user) => {
      if (user.lastLogin) {
        const date = user.lastLogin.toISOString().split('T')[0]; // Get YYYY-MM-DD
        acc[date] = (acc[date] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Convert to array and sort
    const loginActivity = Object.entries(loginsByDate)
      .map(([date, logins]) => ({ date, logins }))
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending

    return loginActivity;
  }

  private async getTenantActivity() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Get tenants created within the last 30 days
    const tenants = await this.prisma.tenant.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo }
      },
      select: {
        createdAt: true,
      },
    });

    // Group by date in JavaScript
    const tenantsByDate = tenants.reduce((acc, tenant) => {
      const date = tenant.createdAt.toISOString().split('T')[0]; // Get YYYY-MM-DD
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Convert to array and sort
    const tenantActivity = Object.entries(tenantsByDate)
      .map(([date, new_tenants]) => ({ date, new_tenants }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return tenantActivity;
  }

  private getSystemVersion() {
    return process.env.npm_package_version || '1.0.0';
  }
}