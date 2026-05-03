/**
 * @file fee-structure-resolver.service.ts
 * @description Public "resolve fee for student" service. Wraps the pure
 *   resolver with DB loading. Used by `/fees/structures/resolve` endpoint
 *   and by the BillingService internally.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  resolveStructureForStudent,
  ScopeResolution,
  ScopeStructure,
} from '../common/fee-scope.util';

@Injectable()
export class FeeStructureResolverService {
  private readonly logger = new Logger(FeeStructureResolverService.name);

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
        : academicTermId
          ? {
              OR: [{ academicTermId }, { academicTermId: null }],
            }
          : {}),
    };

    const rows = await this.prisma.feeStructure.findMany({
      where,
      include: {
        feeComponents: { orderBy: { sortOrder: 'asc' } },
        levels: {
          include: {
            components: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });

    // Enrich levels with grade names (for the name-based fallback in the
    // pure resolver). One round-trip per tenant per call — cheap.
    const gradeIds = Array.from(
      new Set(
        rows.flatMap((r) =>
          r.levels.map((l) => l.gradeId).filter((g): g is string => !!g),
        ),
      ),
    );
    const gradeNameMap = new Map<string, string>();
    if (gradeIds.length) {
      const grades = await this.prisma.grade.findMany({
        where: { id: { in: gradeIds }, tenantId },
        select: { id: true, name: true },
      });
      for (const g of grades) gradeNameMap.set(g.id, g.name);
    }

    const mapped: ScopeStructure[] = rows.map((r) => ({
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
        gradeName: l.gradeId ? (gradeNameMap.get(l.gradeId) ?? null) : null,
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

    this.logger.debug(
      `loadStructures(year=${academicYearId}, term=${academicTermId ?? 'all'}): ${mapped.length} structure(s)`,
    );

    return mapped;
  }

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
        gradeName: student.class.grade?.name ?? null,
        curriculumId: student.class.grade.curriculumId,
      },
      structures,
    );
  }
}
