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
import { RequestActor } from '../academic-terms/academic-terms.service';

export interface ClassesFilter {
  page?: number;
  limit?: number;
  search?: string;
  gradeLevel?: number;
  classType?: ClassType | string;
  stream?: string;
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
      select: {
        id: true,
        name: true,
        isLocked: true,
        streamsByGrade: true,
      },
    });
    if (!year) throw new NotFoundException('Academic year not found');
    if (year.isLocked) {
      throw new BadRequestException(
        'Cannot create class — academic year is locked',
      );
    }

    // NEW: strict stream validation against year config — NO silent fallback
    const { validateStreamForGrade } = await import(
      '../academic-years/streams-config.helper.js'
    );
    validateStreamForGrade(
      year.streamsByGrade as Record<string, string[]> | null,
      dto.gradeLevel,
      dto.stream?.trim() || null,
    );

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

    const created = await this.prisma.class.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        name: dto.name.trim(),
        displayName: dto.displayName?.trim(),
        gradeLevel: dto.gradeLevel,
        section: dto.section?.trim(),
        capacity: dto.capacity ?? 40,
        classType: dto.classType ?? ClassType.REGULAR,
        stream: dto.stream?.trim() || null,
        language: dto.language?.trim(),
        curriculum: dto.curriculum?.trim(),
        classTeacherId: dto.classTeacherId,
      },
      include: {
        academicYear: { select: { id: true, name: true } },
        classTeacher: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        _count: { select: { students: true, subjects: true } },
      },
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
        gradeLevel: dto.gradeLevel,
        stream: dto.stream,
      },
    });

    return created;
  }

  // ─────────────────────────── READ (paginated)
  async findAll(actor: RequestActor, filters: ClassesFilter = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(200, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ClassWhereInput = {
      tenantId: actor.tenantId,
      ...(filters.academicYearId && { academicYearId: filters.academicYearId }),
      ...(filters.gradeLevel !== undefined && {
        gradeLevel: filters.gradeLevel,
      }),
      ...(filters.classType && { classType: filters.classType as ClassType }),
      ...(filters.stream && { stream: filters.stream }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { displayName: { contains: filters.search, mode: 'insensitive' } },
          { section: { contains: filters.search, mode: 'insensitive' } },
          { stream: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.class.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ gradeLevel: 'asc' }, { name: 'asc' }],
        include: {
          academicYear: { select: { id: true, name: true, isCurrent: true } },
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
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, actor: RequestActor) {
    const cls = await this.prisma.class.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        academicYear: true,
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
                  select: {
                    firstName: true,
                    lastName: true,
                  },
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
      },
      orderBy: [{ rollNumber: 'asc' }],
    });
  }

  /** Lists distinct streams for a given academic year. */
  async listStreams(actor: RequestActor, academicYearId?: string) {
    const rows = await this.prisma.class.findMany({
      where: {
        tenantId: actor.tenantId,
        academicYearId: academicYearId || undefined,
        stream: { not: null },
      },
      select: {
        stream: true,
        gradeLevel: true,
      },
      distinct: ['stream', 'gradeLevel'],
    });
    // Group by stream → grade levels it appears in
    const grouped: Record<string, number[]> = {};
    for (const row of rows) {
      if (!row.stream) continue;
      if (!grouped[row.stream]) grouped[row.stream] = [];
      grouped[row.stream].push(row.gradeLevel);
    }
    return Object.entries(grouped).map(([stream, grades]) => ({
      stream,
      gradeLevels: [...new Set(grades)].sort((a, b) => a - b),
    }));
  }

  /** Classes sharing a stream label (useful for stream landing pages). */
  async findByStream(
    actor: RequestActor,
    stream: string,
    academicYearId?: string,
  ) {
    return this.prisma.class.findMany({
      where: {
        tenantId: actor.tenantId,
        stream,
        academicYearId: academicYearId || undefined,
      },
      include: {
        _count: { select: { students: true } },
      },
      orderBy: [{ gradeLevel: 'asc' }, { name: 'asc' }],
    });
  }

  // ─────────────────────────── UPDATE
  async update(id: string, dto: UpdateClassDto, actor: RequestActor) {
    const current = await this.prisma.class.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        academicYear: {
          select: { id: true, isLocked: true, streamsByGrade: true },
        },
      },
    });
    if (!current) throw new NotFoundException('Class not found');
    if (current.academicYear.isLocked) {
      throw new BadRequestException('Academic year is locked');
    }

    // If gradeLevel or stream is changing, revalidate against config
    if (dto.gradeLevel !== undefined || dto.stream !== undefined) {
      const { validateStreamForGrade } = await import(
        '../academic-years/streams-config.helper.js'
      );

      validateStreamForGrade(
        current.academicYear.streamsByGrade as Record<string, string[]> | null,
        dto.gradeLevel ?? current.gradeLevel,
        dto.stream !== undefined ? dto.stream?.trim() || null : current.stream,
      );
    }

    if (dto.classTeacherId) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: dto.classTeacherId, tenantId: actor.tenantId },
      });
      if (!teacher) throw new NotFoundException('Class teacher not found');
    }

    const updated = await this.prisma.class.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        displayName: dto.displayName?.trim(),
        gradeLevel: dto.gradeLevel,
        section: dto.section?.trim(),
        capacity: dto.capacity,
        classType: dto.classType,
        stream:
          dto.stream !== undefined ? dto.stream?.trim() || null : undefined,
        language: dto.language?.trim(),
        curriculum: dto.curriculum?.trim(),
        classTeacherId: dto.classTeacherId,
      },
      include: {
        academicYear: { select: { id: true, name: true } },
        _count: { select: { students: true } },
      },
    });

    await this.activityService.log({
      action: ActivityAction.UPDATE,
      entityType: ActivityEntityType.CLASS,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} updated class ${updated.name}`,
    });

    return updated;
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

  async getStreamsForGrade(
    tenantId: string,
    academicYearId: string,
    gradeLevel: number,
  ) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      select: { streamsByGrade: true },
    });
    if (!year) throw new NotFoundException('Academic year not found');

    const config =
      (year.streamsByGrade as Record<string, string[]> | null) ?? {};
    const key = String(gradeLevel);
    const entry = config[key];

    if (entry === undefined) {
      return {
        configured: false,
        streamless: false,
        allowedStreams: [],
        message: `Streams not configured for Grade ${gradeLevel}. Classes at this grade will be created without a stream.`,
      };
    }
    if (entry.length === 0) {
      return {
        configured: true,
        streamless: true,
        allowedStreams: [],
        message: `Grade ${gradeLevel} is streamless in this academic year.`,
      };
    }
    return {
      configured: true,
      streamless: false,
      allowedStreams: entry,
      message: `Allowed streams for Grade ${gradeLevel}: ${entry.join(', ')}`,
    };
  }

  /**
   * Resolve the default destination class for promotion:
   *   same stream if present, gradeLevel+1, classType=REGULAR,
   *   restricted to the target academic year.
   */
  async resolvePromotionTarget(
    tenantId: string,
    fromClassId: string,
    targetAcademicYearId: string,
  ) {
    const from = await this.prisma.class.findFirst({
      where: { id: fromClassId, tenantId },
    });
    if (!from) return null;
    const nextGrade = from.gradeLevel + 1;

    const preferred = await this.prisma.class.findFirst({
      where: {
        tenantId,
        academicYearId: targetAcademicYearId,
        gradeLevel: nextGrade,
        classType: ClassType.REGULAR,
        ...(from.stream ? { stream: from.stream } : {}),
      },
    });
    if (preferred) return preferred;

    return this.prisma.class.findFirst({
      where: {
        tenantId,
        academicYearId: targetAcademicYearId,
        gradeLevel: nextGrade,
        classType: ClassType.REGULAR,
      },
    });
  }
}
