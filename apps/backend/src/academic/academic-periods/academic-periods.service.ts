/**
 * @service AcademicPeriodsService
 * @description Manages discrete time-windows within an AcademicYear:
 *   - TERM (auto-mirrored from AcademicTerm)
 *   - HOLIDAY / EXAM_WEEK / MID_TERM_BREAK (manual)
 *   Provides current-period detection for Progress Engine & dashboards.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcademicPeriodType,
  ActivityAction,
  ActivityEntityType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import {
  CreateAcademicPeriodDto,
  UpdateAcademicPeriodDto,
} from './dto/academic-period.dto';
import { RequestActor } from '../academic-terms/academic-terms.service';

@Injectable()
export class AcademicPeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  private startOfDay(v: string | Date) {
    const d = new Date(v);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  private endOfDay(v: string | Date) {
    const d = new Date(v);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private actorName(a: RequestActor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  async create(dto: CreateAcademicPeriodDto, actor: RequestActor) {
    const startDate = this.startOfDay(dto.startDate);
    const endDate = this.endOfDay(dto.endDate);
    if (startDate >= endDate) {
      throw new BadRequestException('startDate must precede endDate');
    }

    const year = await this.prisma.academicYear.findFirst({
      where: { id: dto.academicYearId, tenantId: actor.tenantId },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    if (startDate < year.startDate || endDate > year.endDate) {
      throw new BadRequestException('Period falls outside the academic year');
    }

    const overlap = await this.prisma.academicPeriod.findFirst({
      where: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        type: dto.type,
        OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }],
      },
    });
    if (overlap) {
      throw new BadRequestException(
        `Overlaps with existing ${dto.type} period: ${overlap.name}`,
      );
    }

    const period = await this.prisma.academicPeriod.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        academicTermId: dto.academicTermId,
        name: dto.name.trim(),
        type: dto.type,
        startDate,
        endDate,
        notes: dto.notes,
      },
    });

    await this.activityService.log({
      action: ActivityAction.CREATE,
      entityType: ActivityEntityType.ACADEMIC_PERIOD,
      entityId: period.id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} added ${dto.type} period "${period.name}"`,
    });

    return period;
  }

  async findAll(
    actor: RequestActor,
    academicYearId?: string,
    type?: AcademicPeriodType,
  ) {
    return this.prisma.academicPeriod.findMany({
      where: {
        tenantId: actor.tenantId,
        academicYearId: academicYearId || undefined,
        type: type || undefined,
      },
      include: {
        academicTerm: { select: { id: true, name: true } },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async findOne(id: string, actor: RequestActor) {
    const period = await this.prisma.academicPeriod.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { academicTerm: true, academicYear: true },
    });
    if (!period) throw new NotFoundException('Period not found');
    return period;
  }

  async update(id: string, dto: UpdateAcademicPeriodDto, actor: RequestActor) {
    const current = await this.prisma.academicPeriod.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!current) throw new NotFoundException('Period not found');

    const startDate = dto.startDate
      ? this.startOfDay(dto.startDate)
      : current.startDate;
    const endDate = dto.endDate ? this.endOfDay(dto.endDate) : current.endDate;
    if (startDate >= endDate) {
      throw new BadRequestException('startDate must precede endDate');
    }

    const updated = await this.prisma.academicPeriod.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        type: dto.type,
        startDate,
        endDate,
        notes: dto.notes,
        academicTermId: dto.academicTermId,
      },
    });

    await this.activityService.log({
      action: ActivityAction.UPDATE,
      entityType: ActivityEntityType.ACADEMIC_PERIOD,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} updated period "${updated.name}"`,
    });
    return updated;
  }

  async remove(id: string, actor: RequestActor) {
    const period = await this.prisma.academicPeriod.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!period) throw new NotFoundException('Period not found');

    await this.prisma.academicPeriod.delete({ where: { id } });
    await this.activityService.log({
      action: ActivityAction.DELETE,
      entityType: ActivityEntityType.ACADEMIC_PERIOD,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} deleted period "${period.name}"`,
    });
    return { message: 'Period deleted successfully' };
  }

  /**
   * Returns the period containing `date` — prefers TERM over other types.
   */
  async detectCurrentPeriod(
    tenantId: string,
    academicYearId: string,
    date: Date = new Date(),
  ) {
    const periods = await this.prisma.academicPeriod.findMany({
      where: {
        tenantId,
        academicYearId,
        startDate: { lte: date },
        endDate: { gte: date },
      },
      include: { academicTerm: true },
    });
    if (!periods.length) return null;

    const priority: Record<AcademicPeriodType, number> = {
      TERM: 0,
      EXAM_WEEK: 1,
      MID_TERM_BREAK: 2,
      HOLIDAY: 3,
    };
    periods.sort((a, b) => (priority[a.type] ?? 99) - (priority[b.type] ?? 99));
    return periods[0];
  }

  async isHoliday(
    tenantId: string,
    academicYearId: string,
    date: Date = new Date(),
  ) {
    const hit = await this.prisma.academicPeriod.findFirst({
      where: {
        tenantId,
        academicYearId,
        type: {
          in: [AcademicPeriodType.HOLIDAY, AcademicPeriodType.MID_TERM_BREAK],
        },
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
    return !!hit;
  }
}
