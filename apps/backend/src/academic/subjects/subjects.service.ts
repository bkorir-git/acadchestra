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
  gradeLevel?: number;
  category?: SubjectCategory | string;
  department?: string;
}

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: RequestActor, filters: SubjectFilters = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Prisma.SubjectWhereInput = {
      tenantId: actor.tenantId,
      ...(filters.gradeLevel !== undefined && {
        gradeLevel: filters.gradeLevel,
      }),
      ...(filters.category && {
        category: filters.category as SubjectCategory,
      }),
      ...(filters.department && { department: filters.department }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { code: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.subject.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ gradeLevel: 'asc' }, { name: 'asc' }],
        include: {
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
        classes: {
          include: {
            class: {
              select: { id: true, name: true, gradeLevel: true, stream: true },
            },
            teacher: {
              include: {
                user: {
                  select: { firstName: true, lastName: true, avatar: true },
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
    const dup = await this.prisma.subject.findFirst({
      where: {
        tenantId: actor.tenantId,
        code: dto.code.trim(),
      },
    });
    if (dup) throw new ConflictException('Subject code already exists');

    return this.prisma.subject.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name.trim(),
        code: dto.code.trim(),
        description: dto.description?.trim(),
        gradeLevel: dto.gradeLevel,
        isCompulsory: dto.isCompulsory ?? true,
        credits: dto.credits ?? 1,
        category: dto.category ?? SubjectCategory.CORE,
        department: dto.department?.trim(),
      },
    });
  }

  async update(id: string, dto: UpdateSubjectDto, actor: RequestActor) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    if (dto.code && dto.code !== subject.code) {
      const dup = await this.prisma.subject.findFirst({
        where: {
          tenantId: actor.tenantId,
          code: dto.code.trim(),
          id: { not: id },
        },
      });
      if (dup) throw new ConflictException('Subject code already in use');
    }

    return this.prisma.subject.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code: dto.code?.trim(),
        description: dto.description?.trim(),
        gradeLevel: dto.gradeLevel,
        isCompulsory: dto.isCompulsory,
        credits: dto.credits,
        category: dto.category,
        department: dto.department?.trim(),
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
    });
    if (!klass) throw new NotFoundException('Class not found');
    const subject = await this.prisma.subject.findFirst({
      where: { id: dto.subjectId, tenantId: actor.tenantId },
    });
    if (!subject) throw new NotFoundException('Subject not found');

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
        teacherId: dto.teacherId,
        periodsPerWeek: dto.periodsPerWeek ?? 5,
      },
      create: {
        classId: dto.classId,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
        periodsPerWeek: dto.periodsPerWeek ?? 5,
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
