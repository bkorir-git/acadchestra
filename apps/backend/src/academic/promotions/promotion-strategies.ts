/**
 * @file promotion-strategies.ts
 * @description Pure functions implementing the four promotion strategies.
 *   Fully refactored for the normalized v2 schema: works in `gradeId` /
 *   `streamId` space, not stringly-typed grade levels or stream names.
 *
 *   "Next grade" is resolved within the SAME curriculum, ordered by
 *   `Grade.levelOrder`. Streams are matched ACROSS YEARS by NAME, but the
 *   value we emit is always a concrete `streamId` belonging to the chosen
 *   target class — never a free-text name.
 *
 *   Rule: if the chosen target class has NO streams configured, stream
 *   logic is bypassed (streamId = null). No fallback guessing.
 */

export interface GradeRef {
  id: string;
  levelOrder: number;
  curriculumId: string;
}

export interface StreamRef {
  id: string;
  name: string;
  capacity: number | null;
  /** rolling count maintained by the planner for balanced distribution */
  currentCount: number;
}

export interface SourceStudent {
  id: string;
  classId: string | null;
  gradeId: string | null;
  /** Source grade's curriculum + level — used to compute the next grade. */
  curriculumId: string | null;
  gradeLevelOrder: number | null;
  /** The student's current stream (may be null). Matched by NAME across years. */
  streamName: string | null;
  className: string | null;
}

export interface TargetClass {
  id: string;
  name: string;
  capacity: number;
  /** total students in this class so far (across all streams) */
  currentCount: number;
  grade: GradeRef;
  streams: StreamRef[];
}

export interface StrategyResult {
  suggestedClassId: string | null;
  suggestedStreamId: string | null;
  action: 'PROMOTE' | 'RETAIN' | 'GRADUATE' | 'SKIP';
  warnings: string[];
  conflicts: string[];
}

export interface StrategyCtx {
  /** All target year classes, with their grade + streams pre-loaded. */
  targetClasses: TargetClass[];
  /**
   * Map of `curriculumId` → ordered list of grades in that curriculum
   * (lowest levelOrder first). Used to compute "next grade".
   */
  gradesByCurriculum: Record<string, GradeRef[]>;
}

// ───────────────────── helpers ─────────────────────

function emit(
  suggestedClassId: string | null,
  suggestedStreamId: string | null,
  action: StrategyResult['action'],
  warnings: string[],
  conflicts: string[],
): StrategyResult {
  return {
    suggestedClassId,
    suggestedStreamId,
    action,
    warnings,
    conflicts,
  };
}

function findNextGrade(s: SourceStudent, ctx: StrategyCtx): GradeRef | null {
  if (!s.curriculumId || s.gradeLevelOrder === null) return null;
  const ladder = ctx.gradesByCurriculum[s.curriculumId];
  if (!ladder?.length) return null;
  return (
    ladder.find((g) => g.levelOrder > (s.gradeLevelOrder as number)) ?? null
  );
}

function classesForGrade(ctx: StrategyCtx, gradeId: string): TargetClass[] {
  return ctx.targetClasses.filter((c) => c.grade.id === gradeId);
}

function pickLeastFullClass(candidates: TargetClass[]): TargetClass | null {
  if (!candidates.length) return null;
  return candidates
    .slice()
    .sort((a, b) => {
      const aRoom = a.capacity - a.currentCount;
      const bRoom = b.capacity - b.currentCount;
      return bRoom - aRoom;
    })[0];
}

function pickLeastFullStream(streams: StreamRef[]): StreamRef | null {
  if (!streams.length) return null;
  return streams
    .slice()
    .sort((a, b) => {
      const aRoom = (a.capacity ?? Number.POSITIVE_INFINITY) - a.currentCount;
      const bRoom = (b.capacity ?? Number.POSITIVE_INFINITY) - b.currentCount;
      return bRoom - aRoom;
    })[0];
}

function findStreamByName(
  streams: StreamRef[],
  name: string,
): StreamRef | null {
  const key = name.trim().toLowerCase();
  return streams.find((s) => s.name.trim().toLowerCase() === key) ?? null;
}

// ───────────────────── strategies ─────────────────────

/** PRESERVE_STREAM: next grade in same curriculum, same stream by NAME. */
export function preserveStream(
  s: SourceStudent,
  ctx: StrategyCtx,
): StrategyResult {
  const warnings: string[] = [];
  const conflicts: string[] = [];

  if (!s.gradeId || s.gradeLevelOrder === null || !s.curriculumId) {
    conflicts.push('Student has no resolvable current grade / curriculum');
    return emit(null, null, 'SKIP', warnings, conflicts);
  }

  const nextGrade = findNextGrade(s, ctx);
  if (!nextGrade) {
    return emit(null, null, 'GRADUATE', [], []);
  }

  const candidates = classesForGrade(ctx, nextGrade.id);
  if (!candidates.length) {
    conflicts.push(
      `No classes exist for the next grade in target year (${nextGrade.id})`,
    );
    return emit(null, null, 'SKIP', warnings, conflicts);
  }

  // 1) If the source has a stream name, prefer a class that has the same
  //    stream name available.
  if (s.streamName) {
    const streamMatchClasses = candidates
      .map((c) => ({ c, s: findStreamByName(c.streams, s.streamName!) }))
      .filter((x) => x.s !== null) as Array<{
      c: TargetClass;
      s: StreamRef;
    }>;

    if (streamMatchClasses.length) {
      // pick the class whose matched stream has most room
      const pick = streamMatchClasses
        .slice()
        .sort((a, b) => {
          const aRoom =
            (a.s.capacity ?? Number.POSITIVE_INFINITY) - a.s.currentCount;
          const bRoom =
            (b.s.capacity ?? Number.POSITIVE_INFINITY) - b.s.currentCount;
          return bRoom - aRoom;
        })[0];

      // bump rolling counts so subsequent students see the change
      pick.c.currentCount += 1;
      pick.s.currentCount += 1;

      if (
        pick.s.capacity !== null &&
        pick.s.currentCount > pick.s.capacity
      ) {
        warnings.push(
          `Stream "${pick.s.name}" in "${pick.c.name}" exceeds capacity.`,
        );
      }
      return emit(pick.c.id, pick.s.id, 'PROMOTE', warnings, conflicts);
    }

    // No class with that stream name → conflict; admin must override.
    conflicts.push(
      `Stream "${s.streamName}" cannot be preserved — not available in target grade. Manual override required.`,
    );
    return emit(null, null, 'SKIP', warnings, conflicts);
  }

  // 2) Source had no stream → pick a streamless class first, else any class.
  const streamlessCandidates = candidates.filter((c) => c.streams.length === 0);
  const pool = streamlessCandidates.length ? streamlessCandidates : candidates;
  const pick = pickLeastFullClass(pool);
  if (!pick) {
    conflicts.push('Could not pick a target class');
    return emit(null, null, 'SKIP', warnings, conflicts);
  }
  pick.currentCount += 1;

  // If the chosen class still has streams, we must pick one — pick least-full.
  let streamId: string | null = null;
  if (pick.streams.length) {
    const stream = pickLeastFullStream(pick.streams);
    if (stream) {
      stream.currentCount += 1;
      streamId = stream.id;
      warnings.push(
        `Source had no stream — assigned to "${stream.name}" in "${pick.name}".`,
      );
    }
  }

  if (pick.currentCount > pick.capacity) {
    warnings.push(`Class "${pick.name}" exceeds capacity.`);
  }

  return emit(pick.id, streamId, 'PROMOTE', warnings, conflicts);
}

/** BALANCED_DISTRIBUTION: next grade, evenly spread across classes & streams. */
export function balancedDistribution(
  s: SourceStudent,
  ctx: StrategyCtx,
): StrategyResult {
  const warnings: string[] = [];
  const conflicts: string[] = [];

  if (!s.gradeId || s.gradeLevelOrder === null || !s.curriculumId) {
    conflicts.push('Student has no resolvable current grade / curriculum');
    return emit(null, null, 'SKIP', warnings, conflicts);
  }
  const nextGrade = findNextGrade(s, ctx);
  if (!nextGrade) {
    return emit(null, null, 'GRADUATE', [], []);
  }

  const candidates = classesForGrade(ctx, nextGrade.id);
  if (!candidates.length) {
    conflicts.push(`No classes exist for the next grade`);
    return emit(null, null, 'SKIP', warnings, conflicts);
  }

  const pickClass = pickLeastFullClass(candidates);
  if (!pickClass) {
    conflicts.push('Could not pick a class');
    return emit(null, null, 'SKIP', warnings, conflicts);
  }
  pickClass.currentCount += 1;

  let streamId: string | null = null;
  if (pickClass.streams.length) {
    const stream = pickLeastFullStream(pickClass.streams);
    if (stream) {
      stream.currentCount += 1;
      streamId = stream.id;
      if (
        s.streamName &&
        s.streamName.trim().toLowerCase() !== stream.name.trim().toLowerCase()
      ) {
        warnings.push(
          `Stream changed: "${s.streamName}" → "${stream.name}" (balanced distribution).`,
        );
      }
    }
  }

  return emit(pickClass.id, streamId, 'PROMOTE', warnings, conflicts);
}

/** CUSTOM_MAPPING: never auto-infer — admin must set every target. */
export function customMapping(
  s: SourceStudent,
  ctx: StrategyCtx,
): StrategyResult {
  const warnings: string[] = [];
  const conflicts: string[] = [];

  if (!s.gradeId || s.gradeLevelOrder === null || !s.curriculumId) {
    conflicts.push('Student has no resolvable current grade / curriculum');
    return emit(null, null, 'SKIP', warnings, conflicts);
  }
  const nextGrade = findNextGrade(s, ctx);
  if (!nextGrade) {
    return emit(null, null, 'GRADUATE', [], []);
  }

  warnings.push('Custom mapping strategy — admin must set the target class.');
  return emit(null, null, 'PROMOTE', warnings, conflicts);
}

/** GRADE_ONLY: pick a streamless class in the next grade, ignore stream logic. */
export function gradeOnly(
  s: SourceStudent,
  ctx: StrategyCtx,
): StrategyResult {
  const warnings: string[] = [];
  const conflicts: string[] = [];

  if (!s.gradeId || s.gradeLevelOrder === null || !s.curriculumId) {
    conflicts.push('Student has no resolvable current grade / curriculum');
    return emit(null, null, 'SKIP', warnings, conflicts);
  }
  const nextGrade = findNextGrade(s, ctx);
  if (!nextGrade) {
    return emit(null, null, 'GRADUATE', [], []);
  }

  const candidates = classesForGrade(ctx, nextGrade.id).filter(
    (c) => c.streams.length === 0,
  );
  if (!candidates.length) {
    conflicts.push(
      `No streamless class for the next grade — required for GRADE_ONLY`,
    );
    return emit(null, null, 'SKIP', warnings, conflicts);
  }
  const pick = pickLeastFullClass(candidates);
  if (!pick) {
    conflicts.push('No capacity available');
    return emit(null, null, 'SKIP', warnings, conflicts);
  }
  pick.currentCount += 1;
  return emit(pick.id, null, 'PROMOTE', warnings, conflicts);
}

/**
 * Validate that a (classId, streamId) pair is internally consistent against
 * the loaded target class catalogue. Throws nothing — just returns problems.
 */
export function validateFinalMapping(
  targetClasses: TargetClass[],
  classId: string,
  streamId: string | null,
): { ok: boolean; reason?: string } {
  const cls = targetClasses.find((c) => c.id === classId);
  if (!cls) return { ok: false, reason: 'Class not found in target year' };

  if (cls.streams.length === 0) {
    if (streamId) {
      return {
        ok: false,
        reason: 'Class has no streams but a stream was provided',
      };
    }
    return { ok: true };
  }

  if (!streamId) {
    return {
      ok: false,
      reason: 'Class has streams — a stream must be selected',
    };
  }

  const owns = cls.streams.some((s) => s.id === streamId);
  if (!owns) {
    return { ok: false, reason: 'Stream does not belong to the chosen class' };
  }
  return { ok: true };
}
