/**
 * @file notifications.service.ts
 * @description Notifications service — create, deliver, mark-read, schedule.
 *   Replaces the previous version where `notifyAdmins`, `notifyGuardians`,
 *   and `broadcastForInvoices` were stubs that threw "Method not implemented".
 *
 *   Public surface used by the fee module's `BillingNotificationsListener`:
 *     - notifyAdmins(tenantId, payload)
 *     - notifyGuardians(tenantId, studentId, payload)
 *     - broadcastForInvoices(tenantId, invoiceIds[])
 *
 *   Channel resolution (in-app / email / SMS / push) is centralised here so
 *   listeners only deal with the domain shape.
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

export interface ListenerPayload {
  /** Stable code used for routing — e.g. "BILLING_RUN_COMPLETED" */
  code: string;
  title: string;
  body: string;
  meta?: Record<string, unknown>;
}

const ADMIN_ROLES = ['SuperAdmin', 'Admin', 'Principal', 'Finance'];

/** Map listener `code` → enum NotificationType. Falls back to SYSTEM. */
function codeToType(code: string): NotificationType {
  switch (code) {
    case 'FEE_DUE_SOON':
      return NotificationType.FEE_DUE;
    case 'FEE_OVERDUE':
      return NotificationType.FEE_OVERDUE;
    case 'FEE_ARREARS_ALERT':
      return NotificationType.ARREARS_ALERT;
    case 'PAYMENT_RECEIVED':
      return NotificationType.PAYMENT_RECEIVED;
    default:
      return NotificationType.SYSTEM;
  }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── CORE CRUD ──────────────────────────────────────────────────
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

  async broadcast(
    tenantId: string,
    input: Omit<CreateNotificationInput, 'tenantId' | 'userId'>,
    options?: { roleNames?: string[]; userIds?: string[] },
  ) {
    const where: Prisma.UserWhereInput = {
      tenantId,
      isActive: true,
      ...(options?.userIds?.length && { id: { in: options.userIds } }),
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

  // ─── DOMAIN HELPERS USED BY LISTENERS ───────────────────────────
  async notifyAdmins(tenantId: string, payload: ListenerPayload) {
    return this.broadcast(
      tenantId,
      {
        type: codeToType(payload.code),
        title: payload.title,
        message: payload.body,
        metadata: (payload.meta ?? {}) as Prisma.InputJsonValue,
      },
      { roleNames: ADMIN_ROLES },
    );
  }

  async notifyGuardians(
    tenantId: string,
    studentId: string,
    payload: ListenerPayload,
  ) {
    const links = await this.prisma.studentGuardian.findMany({
      where: { tenantId, studentId, receivesFinancials: true },
      select: { guardian: { select: { userId: true } } },
    });
    const userIds = links
      .map((l) => l.guardian?.userId)
      .filter((id): id is string => !!id);
    if (!userIds.length) {
      // No portal user — log only (we'll wire SMS/email later).
      this.logger.debug(
        `notifyGuardians: no portal users for student ${studentId}`,
      );
      return { created: 0 };
    }
    return this.broadcast(
      tenantId,
      {
        type: codeToType(payload.code),
        title: payload.title,
        message: payload.body,
        metadata: (payload.meta ?? {}) as Prisma.InputJsonValue,
      },
      { userIds },
    );
  }

  async broadcastForInvoices(tenantId: string, invoiceIds: string[]) {
    if (!invoiceIds?.length) return { created: 0 };
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, id: { in: invoiceIds } },
      select: {
        id: true,
        invoiceNumber: true,
        studentId: true,
        totalAmount: true,
        dueDate: true,
      },
    });
    let total = 0;
    for (const inv of invoices) {
      const r = await this.notifyGuardians(tenantId, inv.studentId, {
        code: 'INVOICE_ISSUED',
        title: `New invoice ${inv.invoiceNumber}`,
        body: `Invoice ${inv.invoiceNumber} of ${inv.totalAmount} has been issued${inv.dueDate ? `, due ${inv.dueDate.toDateString()}` : ''}.`,
        meta: { invoiceId: inv.id },
      });
      total += r.created;
    }
    return { created: total };
  }

  // ─── READS ─────────────────────────────────────────────────────
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

  async getUnreadCount(tenantId: string, userId: string) {
    return this.prisma.notification.count({
      where: { tenantId, userId, readAt: null },
    });
  }

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
      this.logger.log(`Dispatched notification ${n.id} [${n.channel}]`);
    }
    return { processed: due.length };
  }
}