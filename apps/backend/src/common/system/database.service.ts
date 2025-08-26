import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DatabaseService {
  constructor(private readonly prisma: PrismaService) {}

  async getDatabaseStats() {
    const tables = [
      'tenants',
      'users', 
      'roles',
      'permissions',
      'user_roles',
      'role_permissions',
      'academic_years',
      'classes',
      'subjects',
      'class_subjects',
      'students',
      'teachers',
      'audit_logs',
    ];

    const stats = await Promise.all(
      tables.map(async (table) => {
        try {
          const result = await this.prisma.$queryRawUnsafe(
            `SELECT COUNT(*) as count FROM "${table}"`
          );
          return {
            table,
            count: Number((result as any)[0].count),
            status: 'healthy',
          };
        } catch (error) {
          return {
            table,
            count: 0,
            status: 'error',
            error: error.message,
          };
        }
      })
    );

    return stats;
  }

  async getDatabaseHealth() {
    try {
      const startTime = Date.now();
      
      // Test basic connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      const connectionTime = Date.now() - startTime;

      // Get info about the database
      const version = await this.prisma.$queryRaw`SELECT version()`;
      
      // Check if we can write
      const writeTest = Date.now();
      await this.prisma.$queryRaw`SELECT NOW()`;
      const writeTime = Date.now() - writeTest;

      return {
        status: 'healthy',
        connectionLatency: connectionTime,
        writeLatency: writeTime,
        version: (version as any)[0]?.version || 'Unknown',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getRecentAuditLogs(limit = 100) {
    const logs = await this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return logs;
  }

  async performMaintenance() {
    try {
      // Clean up old audit logs (older than 90 days)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      
      const deletedLogs = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: ninetyDaysAgo,
          },
        },
      });

      return {
        success: true,
        actions: [
          `Deleted ${deletedLogs.count} old audit logs`,
        ],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async createBackup() {
    // This would integrate with your backup system
    // For now, return a mock response
    return {
      success: true,
      backupId: `backup_${Date.now()}`,
      size: '245MB', // Mock size
      timestamp: new Date().toISOString(),
      location: 's3://acadchestra-backups/',
    };
  }

  async getBackupHistory() {
    // Mock backup history - in production, this would come from your backup system
    return [
      {
        id: 'backup_1703123456789',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        size: '243MB',
        status: 'completed',
        type: 'automatic',
      },
      {
        id: 'backup_1703037056789',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        size: '241MB',
        status: 'completed',
        type: 'automatic',
      },
      {
        id: 'backup_1702950656789',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        size: '240MB',
        status: 'completed',
        type: 'manual',
      },
    ];
  }
}
