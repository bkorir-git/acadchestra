/**
 * @service PromotionsService
 * @description Single-promotion ops only. Bulk lives in PromotionPlanService.
 *   Schema-v2 native: gradeId + streamId, curriculum-aware promotion ladder.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAction,
  ActivityEntityType,
  Prisma,
  PromotionStatus,
  StudentStatus,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { EVENTS } from '../../common/events/events.constants';
import { StudentClassHistoryService } from '../student-class-history/student-class-history.service';
import { PromoteStudentDto } from './dto/promotion.dto';
import { RequestActor } from '../academic-terms/academic-terms.service';

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: StudentClassHistoryService,
    private readonly activityService: ActivityService,
    private readonly events: EventEmitter2,
  ) {}

  private actorName(a: RequestActor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  // ═══════════════════════════════════════════════════════════════
  //  LIST
  // ═══════════════════════════════════════════════════════════════
  async list(
    actor: RequestActor,
    filters: {
      academicYearId?: string;
      status?: PromotionStatus;
      studentId?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(200, Math.max(1, filters.limit ?? 25));
    const skip = (page - 1) * limit;

    const where: Prisma.StudentPromotionWhereInput = {
      tenantId: actor.tenantId,
      academicYearId: filters.academicYearId || undefined,
      status: filters.status || undefined,
      studentId: filters.studentId || undefined,
    };

    const [data, total] = await Promise.all([
      this.prisma.studentPromotion.findMany({
        where,
        skip,
        take: limit,
        include: {
          student: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  avatar: true,
                  email: true,
                },
              },
            },
          },
          fromClass: {
            select: {
              id: true,
              name: true,
              displayName: true,
              gradeId: true,
              grade: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  levelOrder: true,
                },
              },
            },
          },
          toClass: {
            select: {
              id: true,
              name: true,
              displayName: true,
              gradeId: true,
              grade: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  levelOrder: true,
                },
              },
            },
          },
          academicYear: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.studentPromotion.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  PROMOTE
  // ═══════════════════════════════════════════════════════════════
  async promote(dto: PromoteStudentDto, actor: RequestActor) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId: actor.tenantId },
      include: {
        class: {
          include: {
            grade: {
              select: {
                id: true,
                name: true,
                levelOrder: true,
                curriculumId: true,
              },
            },
          },
        },
        stream: { select: { id: true, name: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (!student.class) {
      throw new BadRequestException('Student has no current class');
    }

    const newYear = await this.prisma.academicYear.findFirst({
      where: { id: dto.newAcademicYearId, tenantId: actor.tenantId },
    });
    if (!newYear) throw new NotFoundException('Target academic year not found');

    let targetClassId: string | undefined = dto.toClassId;
    let targetStreamId: string | null = null;
    let willGraduate = false;

    if (targetClassId) {
      // Validate the chosen target class lives in the target year
      const target = await this.prisma.class.findFirst({
        where: {
          id: targetClassId,
          tenantId: actor.tenantId,
          academicYearId: dto.newAcademicYearId,
        },
        include: { streams: { select: { id: true } } },
      });
      if (!target) {
        throw new BadRequestException(
          'Target class does not belong to the target academic year',
        );
      }

      if (dto.toStreamId) {
        const owns = target.streams.some((s) => s.id === dto.toStreamId);
        if (!owns) {
          throw new BadRequestException(
            'toStreamId does not belong to toClassId',
          );
        }
        targetStreamId = dto.toStreamId;
      } else if (target.streams.length > 0 && dto.toStreamId === undefined) {
        // class has streams but caller didn't specify — leave null, caller's choice
        targetStreamId = null;
      }
    } else if (dto.mode === 'REPETITION') {
      const repeat = await this.findRepeatTarget(actor.tenantId, student, dto.newAcademicYearId);
      if (!repeat) throw new BadRequestException('No class for repetition found');
      targetClassId = repeat.classId;
      targetStreamId = repeat.streamId;
    } else {
      // AUTO_PROMOTION / MANUAL_PROMOTION / STREAM_REASSIGNMENT — find next grade
      const resolved = await this.resolveNextGradeTarget(
        actor.tenantId,
        student,
        dto.newAcademicYearId,
      );
      if (resolved.willGraduate) {
        willGraduate = true;
      } else if (!resolved.classId) {
        throw new BadRequestException(
          'No suitable target class found in target academic year',
        );
      } else {
        targetClassId = resolved.classId;
        targetStreamId = resolved.streamId;
      }
    }

    const effectiveDate = dto.effectiveDate
      ? new Date(dto.effectiveDate)
      : new Date();

    return this.prisma.$transaction(async (tx) => {
      if (willGraduate) {
        await tx.student.update({
          where: { id: student.id },
          data: { academicStatus: StudentStatus.GRADUATED },
        });
        await tx.studentClassHistory.updateMany({
          where: {
            tenantId: actor.tenantId,
            studentId: student.id,
            isCurrent: true,
          },
          data: { isCurrent: false, endDate: effectiveDate },
        });
        const promo = await tx.studentPromotion.create({
          data: {
            tenantId: actor.tenantId,
            studentId: student.id,
            fromClassId: student.classId,
            toClassId: null,
            academicYearId: dto.newAcademicYearId,
            status: PromotionStatus.GRADUATED,
            notes: dto.notes,
            promotedById: actor.id,
            promotedAt: effectiveDate,
          },
        });
        await this.activityService.log(
          {
            action: ActivityAction.PROMOTION,
            entityType: ActivityEntityType.PROMOTION,
            entityId: promo.id,
            tenantId: actor.tenantId,
            userId: actor.id,
            message: `${this.actorName(actor)} graduated student`,
          },
          tx,
        );
        this.events.emit(EVENTS.STUDENT_GRADUATED, {
          tenantId: actor.tenantId,
          studentId: student.id,
          actorId: actor.id,
        });
        return promo;
      }

      if (!targetClassId) throw new BadRequestException('No target class');

      await this.history.createEntry(
        actor.tenantId,
        {
          studentId: student.id,
          classId: targetClassId,
          academicYearId: dto.newAcademicYearId,
          streamId: targetStreamId,
          startDate: effectiveDate.toISOString(),
          reason: dto.mode,
          isCurrent: true,
        },
        actor.id,
        tx,
      );

      const status: PromotionStatus =
        dto.mode === 'REPETITION'
          ? PromotionStatus.RETAINED
          : PromotionStatus.PROMOTED;

      const promo = await tx.studentPromotion.create({
        data: {
          tenantId: actor.tenantId,
          studentId: student.id,
          fromClassId: student.classId,
          toClassId: targetClassId,
          academicYearId: dto.newAcademicYearId,
          status,
          notes: dto.notes,
          promotedById: actor.id,
          promotedAt: effectiveDate,
        },
      });
      await this.activityService.log(
        {
          action: ActivityAction.PROMOTION,
          entityType: ActivityEntityType.PROMOTION,
          entityId: promo.id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} ${
            status === PromotionStatus.RETAINED ? 'retained' : 'promoted'
          } student`,
        },
        tx,
      );
      this.events.emit(EVENTS.STUDENT_PROMOTED, {
        tenantId: actor.tenantId,
        studentId: student.id,
        actorId: actor.id,
      });
      return promo;
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  UNDO
  // ═══════════════════════════════════════════════════════════════
  async undoLast(studentId: string, actor: RequestActor) {
    const last = await this.prisma.studentPromotion.findFirst({
      where: {
        tenantId: actor.tenantId,
        studentId,
        status: {
          in: [
            PromotionStatus.PROMOTED,
            PromotionStatus.RETAINED,
            PromotionStatus.GRADUATED,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!last) throw new NotFoundException('No promotion to undo');

    return this.prisma.$transaction(async (tx) => {
      await tx.studentClassHistory.updateMany({
        where: { tenantId: actor.tenantId, studentId, isCurrent: true },
        data: { isCurrent: false, endDate: new Date() },
      });

      const prior = await tx.studentClassHistory.findFirst({
        where: {
          tenantId: actor.tenantId,
          studentId,
          classId: last.fromClassId ?? undefined,
        },
        orderBy: { startDate: 'desc' },
      });
      if (prior) {
        await tx.studentClassHistory.update({
          where: { id: prior.id },
          data: { isCurrent: true, endDate: null },
        });
      }
      if (last.fromClassId) {
        await tx.student.update({
          where: { id: studentId },
          data: {
            classId: last.fromClassId,
            streamId: prior?.streamId ?? null,
            academicStatus: StudentStatus.ACTIVE,
          },
        });
      }
      await tx.studentPromotion.update({
        where: { id: last.id },
        data: { status: PromotionStatus.PENDING, notes: 'Reverted' },
      });
      await this.activityService.log(
        {
          action: ActivityAction.UPDATE,
          entityType: ActivityEntityType.PROMOTION,
          entityId: last.id,
          tenantId: actor.tenantId,
          userId: actor.id,
          message: `${this.actorName(actor)} reverted last promotion`,
        },
        tx,
      );
      this.events.emit(EVENTS.PROMOTION_REVERTED, {
        tenantId: actor.tenantId,
        studentId,
        actorId: actor.id,
      });
      return { reverted: true, promotionId: last.id };
    });
  }

  // ───────────────────── private resolvers ─────────────────────

  private async findRepeatTarget(
    tenantId: string,
    student: {
      class: { gradeId: string };
      stream: { id: string; name: string } | null;
    },
    toAcademicYearId: string,
  ): Promise<{ classId: string; streamId: string | null } | null> {
    const candidates = await this.prisma.class.findMany({
      where: {
        tenantId,
        academicYearId: toAcademicYearId,
        gradeId: student.class.gradeId,
        classType: 'REGULAR',
      },
      include: {
        streams: { select: { id: true, name: true } },
        _count: { select: { students: true } },
      },
    });
    if (!candidates.length) return null;

    const fromStreamKey = student.stream?.name.trim().toLowerCase() ?? null;

    if (fromStreamKey) {
      for (const c of candidates) {
        const match = c.streams.find(
          (s) => s.name.trim().toLowerCase() === fromStreamKey,
        );
        if (match) return { classId: c.id, streamId: match.id };
      }
    }

    const least = [...candidates].sort(
      (a, b) => a._count.students - b._count.students,
    )[0];
    return { classId: least.id, streamId: null };
  }

  private async resolveNextGradeTarget(
    tenantId: string,
    student: {
      class: {
        gradeId: string;
        grade: { id: string; levelOrder: number; curriculumId: string };
      };
      stream: { id: string; name: string } | null;
    },
    toAcademicYearId: string,
  ): Promise<{
    classId: string | null;
    streamId: string | null;
    willGraduate: boolean;
  }> {
    const nextGrade = await this.prisma.grade.findFirst({
      where: {
        tenantId,
        curriculumId: student.class.grade.curriculumId,
        levelOrder: { gt: student.class.grade.levelOrder },
      },
      orderBy: { levelOrder: 'asc' },
    });
    if (!nextGrade) {
      return { classId: null, streamId: null, willGraduate: true };
    }

    const candidates = await this.prisma.class.findMany({
      where: {
        tenantId,
        academicYearId: toAcademicYearId,
        gradeId: nextGrade.id,
      },
      include: {
        streams: { select: { id: true, name: true } },
        _count: { select: { students: true } },
      },
    });
    if (!candidates.length) {
      return { classId: null, streamId: null, willGraduate: false };
    }

    const fromStreamKey = student.stream?.name.trim().toLowerCase() ?? null;
    if (fromStreamKey) {
      for (const c of candidates) {
        const match = c.streams.find(
          (s) => s.name.trim().toLowerCase() === fromStreamKey,
        );
        if (match) {
          return { classId: c.id, streamId: match.id, willGraduate: false };
        }
      }
    }

    const least = [...candidates].sort(
      (a, b) => a._count.students - b._count.students,
    )[0];
    return { classId: least.id, streamId: null, willGraduate: false };
  }
}
