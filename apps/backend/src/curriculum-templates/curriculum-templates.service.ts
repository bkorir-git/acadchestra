/**
 * @file curriculum-templates.service.ts
 * @module curriculum-templates
 * @description SuperAdmin-managed master curriculum catalog. Tenants don't
 *   write here — they READ to pick a starting point and FORK into their own
 *   `Curriculum` row (handled by `CurriculumService.adoptTemplate`).
 *
 *   Surface:
 *     - listPublished()       → tenants pick from this during onboarding
 *     - listAll()             → SuperAdmin sees drafts too
 *     - findOne(id)
 *     - create(dto)           → SuperAdmin
 *     - update(id, dto)       → SuperAdmin
 *     - addGrade / removeGrade — SuperAdmin
 *     - publish / unpublish   → SuperAdmin toggle
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreateCurriculumTemplateDto,
  UpdateCurriculumTemplateDto,
  AddGradeTemplateDto,
} from './dto/curriculum-template.dto';

@Injectable()
export class CurriculumTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────── READ
  async listPublished() {
    return this.prisma.curriculumTemplate.findMany({
      where: { isPublished: true },
      include: {
        grades: { orderBy: { levelOrder: 'asc' } },
        _count: { select: { grades: true, curriculums: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async listAll() {
    return this.prisma.curriculumTemplate.findMany({
      include: {
        grades: { orderBy: { levelOrder: 'asc' } },
        _count: { select: { curriculums: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const tpl = await this.prisma.curriculumTemplate.findUnique({
      where: { id },
      include: { grades: { orderBy: { levelOrder: 'asc' } } },
    });
    if (!tpl) throw new NotFoundException('Curriculum template not found');
    return tpl;
  }

  async findByCode(code: string) {
    return this.prisma.curriculumTemplate.findUnique({
      where: { code },
      include: { grades: { orderBy: { levelOrder: 'asc' } } },
    });
  }

  // ─────────────────────────── WRITE
  async create(dto: CreateCurriculumTemplateDto) {
    const existing = await this.prisma.curriculumTemplate.findFirst({
      where: { OR: [{ code: dto.code }, { name: dto.name }] },
    });
    if (existing) {
      throw new BadRequestException(
        `Template with code "${dto.code}" or name "${dto.name}" already exists`,
      );
    }

    return this.prisma.curriculumTemplate.create({
      data: {
        code: dto.code.trim().toLowerCase(),
        name: dto.name.trim(),
        country: dto.country,
        description: dto.description,
        defaultTermStructure: dto.defaultTermStructure,
        isPublished: dto.isPublished ?? false,
        grades: dto.grades?.length
          ? {
              create: dto.grades.map((g) => ({
                name: g.name.trim(),
                displayName: g.displayName,
                levelOrder: g.levelOrder,
              })),
            }
          : undefined,
      },
      include: { grades: { orderBy: { levelOrder: 'asc' } } },
    });
  }

  async update(id: string, dto: UpdateCurriculumTemplateDto) {
    await this.findOne(id);
    return this.prisma.curriculumTemplate.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        country: dto.country,
        description: dto.description,
        defaultTermStructure: dto.defaultTermStructure,
        isPublished: dto.isPublished,
      },
      include: { grades: { orderBy: { levelOrder: 'asc' } } },
    });
  }

  async addGrade(templateId: string, dto: AddGradeTemplateDto) {
    await this.findOne(templateId);
    const dup = await this.prisma.gradeTemplate.findFirst({
      where: {
        curriculumTemplateId: templateId,
        OR: [{ name: dto.name }, { levelOrder: dto.levelOrder }],
      },
    });
    if (dup) {
      throw new BadRequestException(
        'Grade with same name or levelOrder already exists in this template',
      );
    }
    return this.prisma.gradeTemplate.create({
      data: {
        curriculumTemplateId: templateId,
        name: dto.name.trim(),
        displayName: dto.displayName,
        levelOrder: dto.levelOrder,
      },
    });
  }

  async removeGrade(templateId: string, gradeId: string) {
    const grade = await this.prisma.gradeTemplate.findFirst({
      where: { id: gradeId, curriculumTemplateId: templateId },
    });
    if (!grade) throw new NotFoundException('Grade template not found');
    await this.prisma.gradeTemplate.delete({ where: { id: gradeId } });
    return { deleted: true };
  }

  async publish(id: string, isPublished: boolean) {
    return this.prisma.curriculumTemplate.update({
      where: { id },
      data: { isPublished },
    });
  }

  async remove(id: string) {
    const tpl = await this.findOne(id);
    const usage = await this.prisma.curriculum.count({
      where: { templateId: id },
    });
    if (usage > 0) {
      throw new BadRequestException(
        `Cannot delete: ${usage} tenant(s) have adopted this template`,
      );
    }
    await this.prisma.curriculumTemplate.delete({ where: { id } });
    return { deleted: true, name: tpl.name };
  }
}
