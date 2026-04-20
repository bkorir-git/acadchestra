/**
 * @description Centralized activity logging service for global and tenant feeds.
 */

import { Injectable } from '@nestjs/common';
import {
  ActivityAction,
  ActivityEntityType,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { QueryActivityDto } from './dto/query-activity.dto';

export interface ActivityActor {
  id?: string | null;
  tenantId?: string | null;
  userRoles?: Array<{ role?: { name?: string | null } | null }>;
}

export interface LogActivityInput {
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  message: string;
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  userId?: string | null;
  tenantId?: string | null;
}

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  private isSuperAdmin(actor?: ActivityActor | null) {
    return !!actor?.userRoles?.some((entry) => entry?.role?.name === 'SuperAdmin');
  }

  async log(
    input: LogActivityInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = (tx ?? this.prisma) as PrismaService | Prisma.TransactionClient;

    return client.activityLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        message: input.message,
        metadata:
          input.metadata === undefined
            ? Prisma.JsonNull
            : input.metadata,
        userId: input.userId ?? null,
        tenantId: input.tenantId ?? null,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
      },
    });
  }

  async findAll(query: QueryActivityDto, actor: ActivityActor) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const isSuperAdmin = this.isSuperAdmin(actor);

    const where: Prisma.ActivityLogWhereInput = {};

    if (!isSuperAdmin) {
      where.tenantId = actor.tenantId ?? '__no_tenant__';
    } else if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = query.action;
    if (query.entityType) where.entityType = query.entityType;

    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
      if (query.toDate) where.createdAt.lte = new Date(query.toDate);
    }

    if (query.search?.trim()) {
      where.OR = [
        { message: { contains: query.search.trim(), mode: 'insensitive' } },
        {
          user: {
            OR: [
              { firstName: { contains: query.search.trim(), mode: 'insensitive' } },
              { lastName: { contains: query.search.trim(), mode: 'insensitive' } },
              { email: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
              domain: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getRecentFeed(actor: ActivityActor, limit = 10) {
    const isSuperAdmin = this.isSuperAdmin(actor);

    return this.prisma.activityLog.findMany({
      where: isSuperAdmin
        ? undefined
        : {
            tenantId: actor.tenantId ?? '__no_tenant__',
          },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        tenant: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
