/**
 * @file streams.service.ts
 * @module academic/streams
 * @description Stream CRUD
 *   Streams are scoped to a specific Class (1:N). They carry per-stream
 *   capacity, color, and (via Student.streamId) student membership.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, ActivityEntityType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { CreateStreamDto, UpdateStreamDto } from './dto/stream.dto';

interface RequestActor {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class StreamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  private actorName(a: RequestActor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  // ─────────────────────────── READ
  async list(actor: RequestActor, classId?: string, academicYearId?: string) {
    return this.prisma.stream.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(classId && { classId }),
        ...(academicYearId && {
          class: { academicYearId },
        }),
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            grade: { select: { id: true, name: true, levelOrder: true } },
            academicYear: { select: { id: true, name: true } },
          },
        },
        _count: { select: { students: true } },
      },
      orderBy: [{ class: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  async findOne(id: string, actor: RequestActor) {
    const s = await this.prisma.stream.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        class: {
          include: {
            grade: { select: { id: true, name: true, levelOrder: true } },
            academicYear: { select: { id: true, name: true } },
          },
        },
        students: {
          select: {
            id: true,
            admissionNumber: true,
            firstName: true,
            lastName: true,
            rollNumber: true,
          },
          orderBy: [{ rollNumber: 'asc' }],
        },
      },
    });
    if (!s) throw new NotFoundException('Stream not found');
    return s;
  }

  // ─────────────────────────── CREATE
  async create(dto: CreateStreamDto, actor: RequestActor) {
    const cls = await this.prisma.class.findFirst({
      where: { id: dto.classId, tenantId: actor.tenantId },
      select: {
        id: true,
        name: true,
        academicYear: { select: { isLocked: true } },
      },
    });
    if (!cls) throw new NotFoundException('Class not found');
    if (cls.academicYear.isLocked) {
      throw new BadRequestException('Academic year is locked');
    }

    const dup = await this.prisma.stream.findFirst({
      where: { classId: dto.classId, name: dto.name.trim() },
    });
    if (dup) {
      throw new ConflictException(
        `Stream "${dto.name}" already exists in ${cls.name}`,
      );
    }

    const created = await this.prisma.stream.create({
      data: {
        tenantId: actor.tenantId,
        classId: dto.classId,
        name: dto.name.trim(),
        capacity: dto.capacity ?? null,
        color: dto.color?.trim() ?? null,
      },
    });

    await this.activity.log({
      action: ActivityAction.CREATE,
      entityType: ActivityEntityType.STREAM,
      entityId: created.id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} created stream ${created.name} in ${cls.name}`,
    });

    return created;
  }

  // ─────────────────────────── UPDATE
  async update(id: string, dto: UpdateStreamDto, actor: RequestActor) {
    const current = await this.prisma.stream.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            academicYear: { select: { isLocked: true } },
          },
        },
      },
    });
    if (!current) throw new NotFoundException('Stream not found');
    if (current.class.academicYear.isLocked) {
      throw new BadRequestException('Academic year is locked');
    }

    if (dto.name && dto.name.trim() !== current.name) {
      const dup = await this.prisma.stream.findFirst({
        where: {
          classId: current.classId,
          name: dto.name.trim(),
          id: { not: id },
        },
      });
      if (dup) throw new ConflictException('Stream name already exists');
    }

    const updated = await this.prisma.stream.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        capacity: dto.capacity ?? undefined,
        color: dto.color?.trim() ?? undefined,
      },
    });

    await this.activity.log({
      action: ActivityAction.UPDATE,
      entityType: ActivityEntityType.STREAM,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} updated stream ${updated.name}`,
    });

    return updated;
  }

  // ─────────────────────────── DELETE
  async remove(id: string, actor: RequestActor) {
    const s = await this.prisma.stream.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { _count: { select: { students: true } } },
    });
    if (!s) throw new NotFoundException('Stream not found');
    if (s._count.students > 0) {
      throw new BadRequestException(
        `Cannot delete stream "${s.name}" — ${s._count.students} students assigned`,
      );
    }

    await this.prisma.stream.delete({ where: { id } });

    await this.activity.log({
      action: ActivityAction.DELETE,
      entityType: ActivityEntityType.STREAM,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} deleted stream ${s.name}`,
    });

    return { deleted: true, name: s.name };
  }
}
