/**
 * @service StudentClassHistoryService
 * @description Append-only ledger of every class a student has belonged to.
 *   Invariants:
 *     - EXACTLY ONE row per student has isCurrent=true at any given time.
 *     - Creating a new "open" row auto-closes the previous one.
 *     - Syncs Student.classId to match the open row (denormalised pointer).
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
import { RequestActor } from '../academic-terms/academic-terms.service';

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
   * Create a new class-history entry.
   * When `tx` is supplied, the call is wrapped in the caller's transaction.
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
      });
      if (!klass) throw new NotFoundException('Class not found');

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
          stream: dto.stream ?? klass.stream ?? null,
          startDate: start,
          endDate: end,
          isCurrent: dto.isCurrent ?? true,
          reason: dto.reason ?? 'INITIAL_ENROLLMENT',
        },
      });

      // Sync denormalised pointer
      if (dto.isCurrent !== false && !end) {
        await client.student.update({
          where: { id: dto.studentId },
          data: { classId: dto.classId },
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
        class: { select: { id: true, name: true, gradeLevel: true } },
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
            gradeLevel: true,
            stream: true,
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
        class: true,
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
        stream: dto.stream,
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
   * Re-sync Student.classId from the open history row for every student.
   * Useful when imports or manual DB fixes have drifted the denorm pointer.
   */
  async audit(tenantId: string) {
    const openRows = await this.prisma.studentClassHistory.findMany({
      where: { tenantId, isCurrent: true },
      select: { studentId: true, classId: true },
    });
    const fixes: Array<{ studentId: string; from: string | null; to: string }> =
      [];

    for (const r of openRows) {
      const stu = await this.prisma.student.findUnique({
        where: { id: r.studentId },
        select: { classId: true },
      });
      if (stu && stu.classId !== r.classId) {
        fixes.push({
          studentId: r.studentId,
          from: stu.classId,
          to: r.classId,
        });
        await this.prisma.student.update({
          where: { id: r.studentId },
          data: { classId: r.classId },
        });
      }
    }
    return { checked: openRows.length, fixed: fixes.length, fixes };
  }
}
