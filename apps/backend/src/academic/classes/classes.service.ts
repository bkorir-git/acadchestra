/**
 * @service ClassesService
 * @description Canonical class/grade catalogue with:
 *   - Paginated listing + filters (gradeLevel, classType, stream, academicYearId)
 *   - Promotion target resolution (next gradeLevel, same stream, REGULAR)
 *   - Stream enumeration from Class.stream strings
 *   - Streams-per-grade listing for UI navigation
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAction,
  ActivityEntityType,
  ClassType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';

interface RequestActor {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
}

export interface ClassesFilter {
  page?: number;
  limit?: number;
  search?: string;
  gradeId?: string;
  classType?: ClassType | string;
  streamId?: string;
  academicYearId?: string;
}

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  private actorName(a: RequestActor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  // ─────────────────────────── CREATE
  async create(dto: CreateClassDto, actor: RequestActor) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: dto.academicYearId, tenantId: actor.tenantId },
      select: { id: true, name: true, isLocked: true },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    if (year.isLocked) {
      throw new BadRequestException(
        'Cannot create class — academic year is locked',
      );
    }

    const grade = await this.prisma.grade.findFirst({
      where: { id: dto.gradeId, tenantId: actor.tenantId },
      select: { id: true, name: true, curriculumId: true },
    });
    if (!grade) throw new NotFoundException('Grade not found');

    const dup = await this.prisma.class.findFirst({
      where: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        name: dto.name.trim(),
      },
    });
    if (dup) {
      throw new BadRequestException(
        `Class "${dto.name}" already exists in this academic year`,
      );
    }

    if (dto.classTeacherId) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: dto.classTeacherId, tenantId: actor.tenantId },
      });
      if (!teacher) throw new NotFoundException('Class teacher not found');
    }

    // Validate inline stream names are unique
    if (dto.streams?.length) {
      const seen = new Set<string>();
      for (const s of dto.streams) {
        const key = s.name.trim().toLowerCase();
        if (seen.has(key)) {
          throw new BadRequestException(`Duplicate stream name: ${s.name}`);
        }
        seen.add(key);
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const cls = await tx.class.create({
        data: {
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
          gradeId: dto.gradeId,
          name: dto.name.trim(),
          displayName: dto.displayName?.trim(),
          section: dto.section?.trim(),
          capacity: dto.capacity ?? 40,
          classType: dto.classType ?? ClassType.REGULAR,
          language: dto.language?.trim(),
          classTeacherId: dto.classTeacherId,
        },
      });

      if (dto.streams?.length) {
        await tx.stream.createMany({
          data: dto.streams.map((s) => ({
            tenantId: actor.tenantId,
            classId: cls.id,
            name: s.name.trim(),
            capacity: s.capacity ?? null,
            color: s.color?.trim() ?? null,
          })),
        });
      }

      return cls;
    });

    await this.activityService.log({
      action: ActivityAction.CREATE,
      entityType: ActivityEntityType.CLASS,
      entityId: created.id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} created class ${created.name}`,
      metadata: {
        academicYearId: dto.academicYearId,
        gradeId: dto.gradeId,
        streams: dto.streams?.map((s) => s.name) ?? [],
      },
    });

    return this.findOne(created.id, actor);
  }

  // ─────────────────────────── READ (paginated)
  async findAll(actor: RequestActor, filters: ClassesFilter = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(200, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ClassWhereInput = {
      tenantId: actor.tenantId,
      ...(filters.academicYearId && { academicYearId: filters.academicYearId }),
      ...(filters.gradeId && { gradeId: filters.gradeId }),
      ...(filters.classType && { classType: filters.classType as ClassType }),
      ...(filters.streamId && {
        streams: { some: { id: filters.streamId } },
      }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { displayName: { contains: filters.search, mode: 'insensitive' } },
          { section: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.class.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ grade: { levelOrder: 'asc' } }, { name: 'asc' }],
        include: {
          academicYear: { select: { id: true, name: true, isCurrent: true } },
          grade: {
            select: {
              id: true,
              name: true,
              displayName: true,
              levelOrder: true,
              curriculumId: true,
            },
          },
          streams: {
            select: { id: true, name: true, capacity: true, color: true },
          },
          classTeacher: {
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
          _count: { select: { students: true, subjects: true } },
        },
      }),
      this.prisma.class.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, actor: RequestActor) {
    const cls = await this.prisma.class.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        academicYear: true,
        grade: {
          include: {
            curriculum: { select: { id: true, name: true, code: true } },
          },
        },
        streams: {
          select: {
            id: true,
            name: true,
            capacity: true,
            color: true,
            _count: { select: { students: true } },
          },
        },
        classTeacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                avatar: true,
              },
            },
          },
        },
        subjects: {
          include: {
            subject: true,
            teacher: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
        _count: { select: { students: true, subjects: true } },
      },
    });
    if (!cls) throw new NotFoundException('Class not found');
    return cls;
  }

  /** Students enrolled in a class. */
  async findStudents(id: string, actor: RequestActor) {
    const cls = await this.prisma.class.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!cls) throw new NotFoundException('Class not found');

    return this.prisma.student.findMany({
      where: { classId: id, tenantId: actor.tenantId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            gender: true,
            dateOfBirth: true,
          },
        },
        stream: { select: { id: true, name: true } },
      },
      orderBy: [{ rollNumber: 'asc' }],
    });
  }

  // ─────────────────────────── UPDATE
  async update(id: string, dto: UpdateClassDto, actor: RequestActor) {
    const current = await this.prisma.class.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        academicYear: { select: { id: true, isLocked: true } },
      },
    });
    if (!current) throw new NotFoundException('Class not found');
    if (current.academicYear.isLocked) {
      throw new BadRequestException('Academic year is locked');
    }

    if (dto.gradeId) {
      const grade = await this.prisma.grade.findFirst({
        where: { id: dto.gradeId, tenantId: actor.tenantId },
      });
      if (!grade) throw new NotFoundException('Grade not found');
    }

    if (dto.classTeacherId) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: dto.classTeacherId, tenantId: actor.tenantId },
      });
      if (!teacher) throw new NotFoundException('Class teacher not found');
    }

    await this.prisma.class.update({
      where: { id },
      data: {
        gradeId: dto.gradeId,
        name: dto.name?.trim(),
        displayName: dto.displayName?.trim(),
        section: dto.section?.trim(),
        capacity: dto.capacity,
        classType: dto.classType,
        language: dto.language?.trim(),
        classTeacherId: dto.classTeacherId,
      },
    });

    // Note: stream mutations live in the Streams module — not here.

    await this.activityService.log({
      action: ActivityAction.UPDATE,
      entityType: ActivityEntityType.CLASS,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} updated class ${current.name}`,
    });

    return this.findOne(id, actor);
  }

  // ─────────────────────────── DELETE
  async remove(id: string, actor: RequestActor) {
    const cls = await this.prisma.class.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { _count: { select: { students: true, subjects: true } } },
    });
    if (!cls) throw new NotFoundException('Class not found');

    if (cls._count.students > 0) {
      throw new BadRequestException(
        `Cannot delete class "${cls.name}" — ${cls._count.students} students are enrolled`,
      );
    }

    await this.prisma.class.delete({ where: { id } });

    await this.activityService.log({
      action: ActivityAction.DELETE,
      entityType: ActivityEntityType.CLASS,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} deleted class ${cls.name}`,
    });

    return { message: 'Class deleted successfully' };
  }

  /**
   * Resolve the default destination class for promotion.
   *
   * Strategy:
   *   - Walk up Grade.levelOrder by 1 within the SAME Curriculum
   *   - Find a class in the target year with classType=REGULAR
   *   - Stream preservation is the caller's responsibility (PromotionPlan)
   */
  async resolvePromotionTarget(
    tenantId: string,
    fromClassId: string,
    targetAcademicYearId: string,
  ) {
    const from = await this.prisma.class.findFirst({
      where: { id: fromClassId, tenantId },
      include: {
        grade: {
          select: { id: true, levelOrder: true, curriculumId: true },
        },
      },
    });
    if (!from) return null;

    const nextGrade = await this.prisma.grade.findFirst({
      where: {
        tenantId,
        curriculumId: from.grade.curriculumId,
        levelOrder: from.grade.levelOrder + 1,
      },
    });
    if (!nextGrade) return null;

    return this.prisma.class.findFirst({
      where: {
        tenantId,
        academicYearId: targetAcademicYearId,
        gradeId: nextGrade.id,
        classType: ClassType.REGULAR,
      },
      include: { streams: { select: { id: true, name: true } } },
    });
  }
}
