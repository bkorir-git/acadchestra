/**
 * @description Notifications service — create, deliver, mark-read, and schedule.
 * Integrates with the event system to notify users on key events.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface CreateNotificationInput {
  tenantId: string;
  userId?: string | null;
  type: NotificationType;
  channel?: NotificationChannel;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
  scheduledAt?: Date;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        type: input.type,
        channel: input.channel ?? NotificationChannel.IN_APP,
        title: input.title,
        message: input.message,
        metadata: input.metadata ?? Prisma.JsonNull,
        scheduledAt: input.scheduledAt ?? null,
        status: input.scheduledAt
          ? NotificationStatus.PENDING
          : NotificationStatus.SENT,
        sentAt: input.scheduledAt ? null : new Date(),
      },
    });
  }

  /**
   * Broadcast to every user of a tenant (or role, if filter provided).
   */
  async broadcast(
    tenantId: string,
    input: Omit<CreateNotificationInput, 'tenantId' | 'userId'>,
    options?: { roleNames?: string[] },
  ) {
    const where: Prisma.UserWhereInput = {
      tenantId,
      isActive: true,
      ...(options?.roleNames?.length && {
        userRoles: {
          some: { role: { name: { in: options.roleNames } } },
        },
      }),
    };

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    if (!users.length) return { created: 0 };

    const now = new Date();
    const result = await this.prisma.notification.createMany({
      data: users.map((u) => ({
        tenantId,
        userId: u.id,
        type: input.type,
        channel: input.channel ?? NotificationChannel.IN_APP,
        title: input.title,
        message: input.message,
        metadata: input.metadata ?? Prisma.JsonNull,
        scheduledAt: input.scheduledAt ?? null,
        status: input.scheduledAt
          ? NotificationStatus.PENDING
          : NotificationStatus.SENT,
        sentAt: input.scheduledAt ? null : now,
      })),
    });

    return { created: result.count };
  }

  async list(
    tenantId: string,
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      type?: NotificationType;
    },
  ) {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      tenantId,
      userId,
      ...(options?.unreadOnly && { readAt: null }),
      ...(options?.type && { type: options.type }),
    };

    const [data, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { tenantId, userId, readAt: null },
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
      unreadCount: unread,
    };
  }

  async markAsRead(id: string, tenantId: string, userId: string) {
    const n = await this.prisma.notification.findFirst({
      where: { id, tenantId, userId },
    });
    if (!n) throw new NotFoundException('Notification not found');
    if (n.readAt) return n;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date(), status: NotificationStatus.READ },
    });
  }

  async markAllAsRead(tenantId: string, userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { tenantId, userId, readAt: null },
      data: { readAt: new Date(), status: NotificationStatus.READ },
    });
    return { marked: res.count };
  }

  async delete(id: string, tenantId: string, userId: string) {
    const n = await this.prisma.notification.findFirst({
      where: { id, tenantId, userId },
    });
    if (!n) throw new NotFoundException('Notification not found');
    await this.prisma.notification.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Process scheduled notifications (called by cron). Marks them SENT.
   */
  async processScheduled(now: Date = new Date()) {
    const due = await this.prisma.notification.findMany({
      where: {
        status: NotificationStatus.PENDING,
        scheduledAt: { lte: now },
      },
      take: 500,
    });

    for (const n of due) {
      await this.prisma.notification.update({
        where: { id: n.id },
        data: { status: NotificationStatus.SENT, sentAt: new Date() },
      });
      // TODO: Hook into email/SMS/push providers
      this.logger.log(`Dispatched notification ${n.id} [${n.channel}]`);
    }

    return { processed: due.length };
  }

  async getUnreadCount(tenantId: string, userId: string) {
    return this.prisma.notification.count({
      where: { tenantId, userId, readAt: null },
    });
  }
}