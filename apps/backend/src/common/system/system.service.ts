import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';

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

      // Memory usage (simplified)
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
    
    const dailyLogins = await this.prisma.$queryRaw`
      SELECT 
        DATE(last_login) as date,
        COUNT(*) as logins
      FROM users 
      WHERE last_login >= ${sevenDaysAgo}
      GROUP BY DATE(last_login)
      ORDER BY date DESC
    `;

    return dailyLogins;
  }

  private async getTenantActivity() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const tenantGrowth = await this.prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_tenants
      FROM tenants 
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    return tenantGrowth;
  }

  private getSystemVersion() {
    return process.env.npm_package_version || '1.0.0';
  }
}
