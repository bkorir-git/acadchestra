/**
 * @service SubjectsService
 * @description Subject catalogue + class↔subject assignments with teacher mapping.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SubjectCategory } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  AssignSubjectToClassDto,
  CreateSubjectDto,
  UpdateSubjectDto,
} from './dto/subject.dto';
import { RequestActor } from '../academic-terms/academic-terms.service';

export interface SubjectFilters {
  page?: number;
  limit?: number;
  search?: string;
  gradeId?: string;
  gradeLevel?: number; // backward-friendly filter; resolves via Grade.levelOrder
  category?: SubjectCategory | string;
  department?: string;
}

type CreateSubjectLike = CreateSubjectDto & {
  gradeId?: string | null;
  gradeLevel?: number | null;
};

type UpdateSubjectLike = UpdateSubjectDto & {
  gradeId?: string | null;
  gradeLevel?: number | null;
};

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveGradeId(
    actor: RequestActor,
    input: { gradeId?: string | null; gradeLevel?: number | null },
  ): Promise<string | null | undefined> {
    if (input.gradeId !== undefined) {
      if (input.gradeId === null || input.gradeId === '') return null;

      const grade = await this.prisma.grade.findFirst({
        where: { id: input.gradeId, tenantId: actor.tenantId },
      });
      if (!grade) throw new NotFoundException('Grade not found');
      return grade.id;
    }

    if (input.gradeLevel !== undefined && input.gradeLevel !== null) {
      const grades = await this.prisma.grade.findMany({
        where: {
          tenantId: actor.tenantId,
          levelOrder: input.gradeLevel,
        },
        take: 2,
        orderBy: { createdAt: 'asc' },
      });

      if (!grades.length) {
        throw new NotFoundException(
          `No grade found for level order ${input.gradeLevel}`,
        );
      }

      if (grades.length > 1) {
        throw new BadRequestException(
          `Grade level ${input.gradeLevel} is ambiguous across multiple curriculums. Use gradeId instead.`,
        );
      }

      return grades[0].id;
    }

    return undefined;
  }

  async findAll(actor: RequestActor, filters: SubjectFilters = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Prisma.SubjectWhereInput = {
      tenantId: actor.tenantId,
      ...(filters.gradeId && { gradeId: filters.gradeId }),
      ...(filters.gradeLevel !== undefined && {
        grade: {
          is: {
            levelOrder: filters.gradeLevel,
          },
        },
      }),
      ...(filters.category && {
        category: filters.category as SubjectCategory,
      }),
      ...(filters.department && {
        department: {
          contains: filters.department,
          mode: 'insensitive',
        },
      }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { code: { contains: filters.search, mode: 'insensitive' } },
          { department: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.subject.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ name: 'asc' }],
        include: {
          grade: {
            select: {
              id: true,
              name: true,
              displayName: true,
              levelOrder: true,
              curriculumId: true,
            },
          },
          _count: { select: { classes: true } },
        },
      }),
      this.prisma.subject.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, actor: RequestActor) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        grade: {
          select: {
            id: true,
            name: true,
            displayName: true,
            levelOrder: true,
            curriculumId: true,
          },
        },
        classes: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                displayName: true,
                section: true,
                capacity: true,
                classType: true,
                language: true,
                academicYearId: true,
                gradeId: true,
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
                  select: {
                    id: true,
                    name: true,
                    color: true,
                    capacity: true,
                  },
                  orderBy: { name: 'asc' },
                },
              },
            },
            teacher: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }

  async create(dto: CreateSubjectDto, actor: RequestActor) {
    const payload = dto as CreateSubjectLike;
    const code = dto.code.trim();

    const dup = await this.prisma.subject.findFirst({
      where: {
        tenantId: actor.tenantId,
        code,
      },
    });
    if (dup) throw new ConflictException('Subject code already exists');

    const gradeId = await this.resolveGradeId(actor, {
      gradeId: payload.gradeId,
      gradeLevel: payload.gradeLevel,
    });

    return this.prisma.subject.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name.trim(),
        code,
        description: dto.description?.trim(),
        gradeId: gradeId === undefined ? null : gradeId,
        isCompulsory: dto.isCompulsory ?? true,
        credits: dto.credits ?? 1,
        category: dto.category ?? SubjectCategory.CORE,
        department: dto.department?.trim(),
      },
      include: {
        grade: {
          select: {
            id: true,
            name: true,
            displayName: true,
            levelOrder: true,
            curriculumId: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateSubjectDto, actor: RequestActor) {
    const payload = dto as UpdateSubjectLike;

    const subject = await this.prisma.subject.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    if (dto.code && dto.code.trim() !== subject.code) {
      const dup = await this.prisma.subject.findFirst({
        where: {
          tenantId: actor.tenantId,
          code: dto.code.trim(),
          id: { not: id },
        },
      });
      if (dup) throw new ConflictException('Subject code already in use');
    }

    const shouldResolveGrade =
      payload.gradeId !== undefined || payload.gradeLevel !== undefined;

    const resolvedGradeId = shouldResolveGrade
      ? await this.resolveGradeId(actor, {
          gradeId: payload.gradeId,
          gradeLevel: payload.gradeLevel,
        })
      : undefined;

    return this.prisma.subject.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code: dto.code?.trim(),
        description: dto.description?.trim(),
        ...(shouldResolveGrade
          ? { gradeId: resolvedGradeId === undefined ? null : resolvedGradeId }
          : {}),
        isCompulsory: dto.isCompulsory,
        credits: dto.credits,
        category: dto.category,
        department: dto.department?.trim(),
      },
      include: {
        grade: {
          select: {
            id: true,
            name: true,
            displayName: true,
            levelOrder: true,
            curriculumId: true,
          },
        },
      },
    });
  }

  async remove(id: string, actor: RequestActor) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { _count: { select: { classes: true } } },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    if (subject._count.classes > 0) {
      throw new BadRequestException(
        `Cannot delete — subject is assigned to ${subject._count.classes} class(es)`,
      );
    }

    await this.prisma.subject.delete({ where: { id } });
    return { message: 'Subject deleted successfully' };
  }

  // ─────────────────── CLASS ↔ SUBJECT
  async assignToClass(dto: AssignSubjectToClassDto, actor: RequestActor) {
    const klass = await this.prisma.class.findFirst({
      where: { id: dto.classId, tenantId: actor.tenantId },
      select: {
        id: true,
        tenantId: true,
        gradeId: true,
      },
    });
    if (!klass) throw new NotFoundException('Class not found');

    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, tenantId: actor.tenantId },
      select: {
        id: true,
        tenantId: true,
        gradeId: true,
      },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    if (subject.gradeId && subject.gradeId !== klass.gradeId) {
      throw new BadRequestException(
        'Subject grade does not match the selected class grade',
      );
    }

    if (dto.teacherId) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: dto.teacherId, tenantId: actor.tenantId },
      });
      if (!teacher) throw new NotFoundException('Teacher not found');
    }

    return this.prisma.classSubject.upsert({
      where: {
        classId_subjectId: { classId: dto.classId, subjectId: dto.subjectId },
      },
      update: {
        teacherId: dto.teacherId ?? null,
        periodsPerWeek: dto.periodsPerWeek ?? 5,
      },
      create: {
        classId: dto.classId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId ?? null,
        periodsPerWeek: dto.periodsPerWeek ?? 5,
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            grade: {
              select: {
                id: true,
                name: true,
                displayName: true,
                levelOrder: true,
              },
            },
            streams: {
              select: {
                id: true,
                name: true,
                color: true,
                capacity: true,
              },
            },
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
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
        teacher: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
  }

  async unassignFromClass(classId: string, subjectId: string) {
    await this.prisma.classSubject.delete({
      where: { classId_subjectId: { classId, subjectId } },
    });
    return { message: 'Subject removed from class' };
  }
}
