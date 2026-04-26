/**
 * @service StudentClassHistoryService
 * @description Append-only ledger of every class a student has belonged to.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, ActivityEntityType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import {
  CreateStudentClassHistoryDto,
  UpdateStudentClassHistoryDto,
} from './dto/student-class-history.dto';

export interface RequestActor {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
}

export interface HistoryListFilters {
  studentId?: string;
  classId?: string;
  academicYearId?: string;
}

@Injectable()
export class StudentClassHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  private actorName(a: RequestActor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  /**
   * Create a new class-history entry. When `tx` is supplied, runs in caller's tx.
   */
  async createEntry(
    tenantId: string,
    dto: CreateStudentClassHistoryDto,
    actorId?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const run = async (client: Prisma.TransactionClient | PrismaService) => {
      const student = await client.student.findFirst({
        where: { id: dto.studentId, tenantId },
      });
      if (!student) throw new NotFoundException('Student not found');

      const klass = await client.class.findFirst({
        where: { id: dto.classId, tenantId },
        include: { streams: { select: { id: true } } },
      });
      if (!klass) throw new NotFoundException('Class not found');

      // Resolve streamId: explicit DTO value first, fall back to class's first stream
      let streamId: string | null = dto.streamId ?? null;
      if (streamId) {
        const owned = await client.stream.findFirst({
          where: { id: streamId, classId: dto.classId, tenantId },
        });
        if (!owned) {
          throw new BadRequestException(
            `Stream ${streamId} does not belong to class ${klass.name}`,
          );
        }
      } else if (klass.streams.length === 1) {
        streamId = klass.streams[0].id;
      }

      const start = new Date(dto.startDate);
      const end = dto.endDate ? new Date(dto.endDate) : null;
      if (end && end <= start) {
        throw new BadRequestException('endDate must be after startDate');
      }

      // Close any currently-open row for this student
      if (dto.isCurrent !== false) {
        await client.studentClassHistory.updateMany({
          where: { tenantId, studentId: dto.studentId, isCurrent: true },
          data: { isCurrent: false, endDate: start },
        });
      }

      const row = await client.studentClassHistory.create({
        data: {
          tenantId,
          studentId: dto.studentId,
          classId: dto.classId,
          academicYearId: dto.academicYearId,
          streamId,
          startDate: start,
          endDate: end,
          isCurrent: dto.isCurrent ?? true,
          reason: dto.reason ?? 'INITIAL_ENROLLMENT',
        },
      });

      // Sync denormalised pointers
      if (dto.isCurrent !== false && !end) {
        await client.student.update({
          where: { id: dto.studentId },
          data: {
            classId: dto.classId,
            streamId: streamId ?? null,
          },
        });
      }

      return row;
    };

    const result = tx ? await run(tx) : await this.prisma.$transaction(run);

    if (actorId) {
      await this.activityService.log({
        action: ActivityAction.CREATE,
        entityType: ActivityEntityType.STUDENT_CLASS_HISTORY,
        entityId: result.id,
        tenantId,
        userId: actorId,
        message: `Class history entry created (${dto.reason ?? 'INITIAL_ENROLLMENT'})`,
        metadata: { studentId: dto.studentId, classId: dto.classId },
      });
    }

    return result;
  }

  // ─────────────────────── QUERIES
  async list(actor: RequestActor, filters: HistoryListFilters = {}) {
    return this.prisma.studentClassHistory.findMany({
      where: {
        tenantId: actor.tenantId,
        studentId: filters.studentId || undefined,
        classId: filters.classId || undefined,
        academicYearId: filters.academicYearId || undefined,
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            grade: { select: { id: true, name: true, levelOrder: true } },
          },
        },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: [{ studentId: 'asc' }, { startDate: 'desc' }],
    });
  }

  async listForStudent(tenantId: string, studentId: string) {
    return this.prisma.studentClassHistory.findMany({
      where: { tenantId, studentId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            grade: { select: { id: true, name: true, levelOrder: true } },
            streams: { select: { id: true, name: true } },
          },
        },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async currentForStudent(tenantId: string, studentId: string) {
    return this.prisma.studentClassHistory.findFirst({
      where: { tenantId, studentId, isCurrent: true },
      include: {
        class: {
          include: {
            grade: { select: { id: true, name: true, levelOrder: true } },
          },
        },
        academicYear: { select: { id: true, name: true } },
      },
    });
  }

  // ─────────────────────── UPDATE
  async update(
    id: string,
    dto: UpdateStudentClassHistoryDto,
    actor: RequestActor,
  ) {
    const row = await this.prisma.studentClassHistory.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!row) throw new NotFoundException('History entry not found');

    const updated = await this.prisma.studentClassHistory.update({
      where: { id },
      data: {
        classId: dto.classId,
        academicYearId: dto.academicYearId,
        streamId: dto.streamId ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        isCurrent: dto.isCurrent,
        reason: dto.reason,
      },
    });

    await this.activityService.log({
      action: ActivityAction.UPDATE,
      entityType: ActivityEntityType.STUDENT_CLASS_HISTORY,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} updated class history entry`,
    });

    return updated;
  }

  /**
   * Re-sync Student.classId / Student.streamId from the open history row for
   * every student. Useful when imports or DB fixes drift the denorm pointers.
   */
  async audit(tenantId: string) {
    const openRows = await this.prisma.studentClassHistory.findMany({
      where: { tenantId, isCurrent: true },
      select: { studentId: true, classId: true, streamId: true },
    });
    const fixes: Array<{
      studentId: string;
      from: { classId: string | null; streamId: string | null };
      to: { classId: string; streamId: string | null };
    }> = [];

    for (const r of openRows) {
      const stu = await this.prisma.student.findUnique({
        where: { id: r.studentId },
        select: { classId: true, streamId: true },
      });
      if (stu && (stu.classId !== r.classId || stu.streamId !== r.streamId)) {
        fixes.push({
          studentId: r.studentId,
          from: { classId: stu.classId, streamId: stu.streamId },
          to: { classId: r.classId, streamId: r.streamId },
        });
        await this.prisma.student.update({
          where: { id: r.studentId },
          data: { classId: r.classId, streamId: r.streamId },
        });
      }
    }
    return { checked: openRows.length, fixed: fixes.length, fixes };
  }
}
