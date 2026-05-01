/**
 * @file fee-structure-resolver.service.ts
 * @description Public "resolve fee for student" service. Wraps the pure
 *   resolver with DB loading. Used by `/fees/structures/resolve` endpoint
 *   and by the BillingService internally.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  resolveStructureForStudent,
  ScopeResolution,
  ScopeStructure,
} from '../common/fee-scope.util';

@Injectable()
export class FeeStructureResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async loadStructures(
    tenantId: string,
    academicYearId: string,
    academicTermId?: string | null,
    feeStructureId?: string,
  ): Promise<ScopeStructure[]> {
    const where: Prisma.FeeStructureWhereInput = {
      tenantId,
      academicYearId,
      ...(feeStructureId
        ? { id: feeStructureId }
        : {
            ...(academicTermId
              ? { OR: [{ academicTermId }, { academicTermId: null }] }
              : {}),
          }),
    };
    const rows = await this.prisma.feeStructure.findMany({
      where,
      include: {
        feeComponents: { orderBy: { sortOrder: 'asc' } },
        levels: { include: { components: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      scope: r.scope,
      curriculumId: r.curriculumId,
      gradeId: r.gradeId,
      classId: r.classId,
      streamId: r.streamId,
      academicYearId: r.academicYearId,
      academicTermId: r.academicTermId,
      components: r.feeComponents.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        amount: c.amount,
        category: c.category as any,
        categoryId: (c as any).categoryId ?? null,
        sortOrder: c.sortOrder,
        priority: c.priority,
        dueDate: c.dueDate,
        isCompulsory: c.isCompulsory,
        currency: c.currency,
      })),
      levels: r.levels.map((l) => ({
        id: l.id,
        classId: l.classId,
        gradeId: l.gradeId,
        levelLabel: l.levelLabel,
        totalAmount: l.totalAmount,
        components: l.components.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          amount: c.amount,
          category: c.category as any,
          categoryId: (c as any).categoryId ?? null,
          sortOrder: c.sortOrder,
          priority: c.priority,
          dueDate: c.dueDate,
          isCompulsory: c.isCompulsory,
          currency: c.currency,
        })),
      })),
    }));
  }

  /** Endpoint helper: resolve fee for a specific student. */
  async resolveForStudentId(
    tenantId: string,
    studentId: string,
    academicYearId?: string,
    academicTermId?: string,
  ): Promise<ScopeResolution | null> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: {
        class: { include: { grade: { include: { curriculum: true } } } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const yearId = academicYearId ?? student.class.academicYearId;
    const structures = await this.loadStructures(
      tenantId,
      yearId,
      academicTermId ?? null,
    );
    return resolveStructureForStudent(
      {
        id: student.id,
        classId: student.classId,
        streamId: student.streamId,
        gradeId: student.class.gradeId,
        curriculumId: student.class.grade.curriculumId,
      },
      structures,
    );
  }
}
