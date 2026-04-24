/**
 * @service PromotionsService
 * @description Single-promotion ops only. Bulk lives in PromotionPlanService.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAction,
  ActivityEntityType,
  PromotionStatus,
  StudentStatus,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { EVENTS } from '../../common/events/events.constants';
import { ClassesService } from '../classes/classes.service';
import { StudentClassHistoryService } from '../student-class-history/student-class-history.service';
import { PromoteStudentDto } from './dto/promotion.dto';
import { RequestActor } from '../academic-terms/academic-terms.service';

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly history: StudentClassHistoryService,
    private readonly activityService: ActivityService,
    private readonly events: EventEmitter2,
  ) {}

  private actorName(a: RequestActor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

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

    const where = {
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
          fromClass: { select: { id: true, name: true, gradeLevel: true } },
          toClass: { select: { id: true, name: true, gradeLevel: true } },
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

  async promote(dto: PromoteStudentDto, actor: RequestActor) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId: actor.tenantId },
      include: { class: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const newYear = await this.prisma.academicYear.findFirst({
      where: { id: dto.newAcademicYearId, tenantId: actor.tenantId },
    });
    if (!newYear) throw new NotFoundException('Target academic year not found');

    let targetClassId = dto.toClassId;
    let willGraduate = false;

    if (!targetClassId) {
      if (!student.classId)
        throw new BadRequestException('Student has no current class');
      if (dto.mode === 'REPETITION') {
        const repeat = await this.prisma.class.findFirst({
          where: {
            tenantId: actor.tenantId,
            academicYearId: dto.newAcademicYearId,
            gradeLevel: student.class.gradeLevel,
            classType: 'REGULAR',
            ...(student.class.stream ? { stream: student.class.stream } : {}),
          },
        });
        if (!repeat)
          throw new BadRequestException('No class for repetition found');
        targetClassId = repeat.id;
      } else {
        const resolved = await this.classes.resolvePromotionTarget(
          actor.tenantId,
          student.classId,
          dto.newAcademicYearId,
        );
        if (!resolved) willGraduate = true;
        else targetClassId = resolved.id;
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
          stream: dto.toStream,
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
          message: `${this.actorName(actor)} ${status === PromotionStatus.RETAINED ? 'retained' : 'promoted'} student`,
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
}
