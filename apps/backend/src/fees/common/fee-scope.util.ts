/**
 * @file fee-scope.util.ts
 * @description Pure resolver — given a student and candidate structures,
 *   pick the most specific match using the v2 scope cascade.
 *
 *   Precedence (most specific wins):
 *     1. STREAM_SPECIFIC matching student.streamId
 *     2. CLASS_SPECIFIC  matching student.classId
 *     3. GRADE_SPECIFIC  matching student.gradeId
 *     4. CURRICULUM_WIDE matching student.class.grade.curriculumId
 *     5. SCHOOL_WIDE     with a level keyed by classId or gradeId
 */
import { FeeStructureScope } from '@prisma/client';

export interface ScopeStudent {
  id: string;
  classId: string;
  streamId: string | null;
  gradeId: string;
  gradeName?: string | null;
  curriculumId: string;
}

export interface ScopeComponent {
  id: string;
  name: string;
  description?: string | null;
  amount: number;
  category: string;
  categoryId?: string | null;
  sortOrder: number;
  priority: number;
  dueDate?: Date | null;
  isCompulsory: boolean;
  currency?: string;
}

export interface ScopeLevel {
  id: string;
  classId: string | null;
  gradeId: string | null;
  gradeName?: string | null;
  levelLabel: string;
  totalAmount: number;
  components: ScopeComponent[];
}

export interface ScopeStructure {
  id: string;
  name: string;
  scope: FeeStructureScope;
  curriculumId: string | null;
  gradeId: string | null;
  classId: string | null;
  streamId: string | null;
  academicYearId: string;
  academicTermId: string | null;
  components: ScopeComponent[];
  levels: ScopeLevel[];
}

export type ResolutionReason =
  | 'STREAM_SPECIFIC'
  | 'CLASS_SPECIFIC'
  | 'GRADE_SPECIFIC'
  | 'CURRICULUM_WIDE'
  | 'SCHOOL_WIDE_LEVEL_CLASS'
  | 'SCHOOL_WIDE_LEVEL_GRADE'
  | 'SCHOOL_WIDE_LEVEL_GRADE_NAME'
  | 'SCHOOL_WIDE_FLAT';

export interface ScopeResolution {
  structureId: string;
  structureName: string;
  levelId: string | null;
  levelLabel: string | null;
  components: ScopeComponent[];
  totalAmount: number;
  reason: ResolutionReason;
}

function totalOf(components: ScopeComponent[]): number {
  return components.reduce((s, c) => s + c.amount, 0);
}

/** Returns true when the structure's curriculum scope (if any) is
 *  compatible with the student's curriculum. Structures with no
 *  curriculumId are considered universally applicable. */
function curriculumCompatible(s: ScopeStructure, student: ScopeStudent) {
  if (!s.curriculumId) return true;
  return s.curriculumId === student.curriculumId;
}

export function resolveStructureForStudent(
  student: ScopeStudent,
  structures: ScopeStructure[],
): ScopeResolution | null {
  // 1. STREAM_SPECIFIC
  if (student.streamId) {
    const m = structures.find(
      (s) =>
        s.scope === FeeStructureScope.STREAM_SPECIFIC &&
        s.streamId === student.streamId,
    );
    if (m) {
      return {
        structureId: m.id,
        structureName: m.name,
        levelId: null,
        levelLabel: null,
        components: m.components,
        totalAmount: totalOf(m.components),
        reason: 'STREAM_SPECIFIC',
      };
    }
  }

  // 2. CLASS_SPECIFIC
  const classSpec = structures.find(
    (s) =>
      s.scope === FeeStructureScope.CLASS_SPECIFIC &&
      s.classId === student.classId,
  );
  if (classSpec) {
    return {
      structureId: classSpec.id,
      structureName: classSpec.name,
      levelId: null,
      levelLabel: null,
      components: classSpec.components,
      totalAmount: totalOf(classSpec.components),
      reason: 'CLASS_SPECIFIC',
    };
  }

  // 3. GRADE_SPECIFIC
  const gradeSpec = structures.find(
    (s) =>
      s.scope === FeeStructureScope.GRADE_SPECIFIC &&
      s.gradeId === student.gradeId,
  );
  if (gradeSpec) {
    return {
      structureId: gradeSpec.id,
      structureName: gradeSpec.name,
      levelId: null,
      levelLabel: null,
      components: gradeSpec.components,
      totalAmount: totalOf(gradeSpec.components),
      reason: 'GRADE_SPECIFIC',
    };
  }

  // 4. CURRICULUM_WIDE
  const curr = structures.find(
    (s) =>
      s.scope === FeeStructureScope.CURRICULUM_WIDE &&
      s.curriculumId === student.curriculumId,
  );
  if (curr) {
    return {
      structureId: curr.id,
      structureName: curr.name,
      levelId: null,
      levelLabel: null,
      components: curr.components,
      totalAmount: totalOf(curr.components),
      reason: 'CURRICULUM_WIDE',
    };
  }

  // 5. SCHOOL_WIDE — only consider structures whose curriculum scope is
  //    compatible with this student. Three matching strategies, in order:
  //    (a) level.classId === student.classId
  //    (b) level.gradeId === student.gradeId
  //    (c) level.gradeName === student.gradeName  (last-resort fallback)
  const schoolWide = structures.filter(
    (s) =>
      s.scope === FeeStructureScope.SCHOOL_WIDE &&
      curriculumCompatible(s, student),
  );

  for (const s of schoolWide) {
    const byClass = s.levels.find((l) => l.classId === student.classId);
    if (byClass) {
      return {
        structureId: s.id,
        structureName: s.name,
        levelId: byClass.id,
        levelLabel: byClass.levelLabel,
        components: byClass.components,
        totalAmount: byClass.totalAmount,
        reason: 'SCHOOL_WIDE_LEVEL_CLASS',
      };
    }
  }

  for (const s of schoolWide) {
    const byGrade = s.levels.find((l) => l.gradeId === student.gradeId);
    if (byGrade) {
      return {
        structureId: s.id,
        structureName: s.name,
        levelId: byGrade.id,
        levelLabel: byGrade.levelLabel,
        components: byGrade.components,
        totalAmount: byGrade.totalAmount,
        reason: 'SCHOOL_WIDE_LEVEL_GRADE',
      };
    }
  }

  if (student.gradeName) {
    const needle = student.gradeName.trim().toLowerCase();
    for (const s of schoolWide) {
      const byName = s.levels.find(
        (l) => (l.gradeName ?? l.levelLabel)?.trim().toLowerCase() === needle,
      );
      if (byName) {
        return {
          structureId: s.id,
          structureName: s.name,
          levelId: byName.id,
          levelLabel: byName.levelLabel,
          components: byName.components,
          totalAmount: byName.totalAmount,
          reason: 'SCHOOL_WIDE_LEVEL_GRADE_NAME',
        };
      }
    }
  }

  for (const s of schoolWide) {
    if (s.components.length && s.levels.length === 0) {
      return {
        structureId: s.id,
        structureName: s.name,
        levelId: null,
        levelLabel: null,
        components: s.components,
        totalAmount: totalOf(s.components),
        reason: 'SCHOOL_WIDE_FLAT',
      };
    }
  }

  return null;
}
