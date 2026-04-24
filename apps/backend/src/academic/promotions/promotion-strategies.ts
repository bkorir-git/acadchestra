/**
 * @file promotion-strategies.ts
 * @description Pure functions implementing the three promotion strategies
 *   from Architecture Section 8.3. Each strategy takes a student's current
 *   class + the target year's class catalogue + stream config and returns
 *   a PlannedMapping (suggested class + stream + warnings + conflicts).
 *
 *   Rule (Section 8.4): if target year has NO streams for target grade,
 *   we IGNORE stream logic and promote by grade only — NO fallback guessing.
 */
import { validateStreamForGrade } from '../academic-years/streams-config.helper';

export interface SourceStudent {
  id: string;
  classId: string | null;
  gradeLevel: number | null;
  stream: string | null;
  className: string | null;
}

export interface TargetClass {
  id: string;
  name: string;
  gradeLevel: number;
  stream: string | null;
  capacity: number;
  currentCount: number; // pre-fetched
}

export interface StrategyResult {
  suggestedClassId: string | null;
  suggestedStream: string | null;
  action: 'PROMOTE' | 'RETAIN' | 'GRADUATE' | 'SKIP';
  warnings: string[];
  conflicts: string[];
}

export interface StrategyCtx {
  targetClasses: TargetClass[];
  streamsByGrade: Record<string, string[]> | null;
  terminalGrade: number; // graduate above this
}

/** PRESERVE_STREAM: target grade+1, same stream. */
export function preserveStream(
  s: SourceStudent,
  ctx: StrategyCtx,
): StrategyResult {
  const warnings: string[] = [];
  const conflicts: string[] = [];

  if (s.gradeLevel === null) {
    conflicts.push('Student has no current grade level');
    return emit(null, null, 'SKIP', warnings, conflicts);
  }

  const targetGrade = s.gradeLevel + 1;
  if (targetGrade > ctx.terminalGrade) {
    return emit(null, null, 'GRADUATE', [], []);
  }

  const targetStreams = ctx.streamsByGrade?.[String(targetGrade)];
  const targetIsStreamless =
    targetStreams !== undefined && targetStreams.length === 0;

  // Rule (Section 8.4): target year has no stream config for this grade
  if (targetStreams === undefined) {
    conflicts.push(
      `Streams not configured for Grade ${targetGrade} in target year`,
    );
    return emit(null, null, 'SKIP', warnings, conflicts);
  }

  let desiredStream: string | null;
  if (targetIsStreamless) {
    desiredStream = null;
  } else if (s.stream && targetStreams.includes(s.stream)) {
    desiredStream = s.stream;
  } else {
    conflicts.push(
      `Stream "${s.stream ?? '(none)'}" cannot be preserved — not available in Grade ${targetGrade}. Manual override required.`,
    );
    return emit(null, null, 'SKIP', warnings, conflicts);
  }

  // Find a matching class
  const candidates = ctx.targetClasses.filter(
    (c) =>
      c.gradeLevel === targetGrade &&
      (desiredStream === null
        ? !c.stream
        : c.stream === desiredStream),
  );
  const pick = pickLeastFull(candidates);
  if (!pick) {
    conflicts.push(
      `No target class found for Grade ${targetGrade}${
        desiredStream ? ` · ${desiredStream}` : ''
      }`,
    );
    return emit(null, null, 'SKIP', warnings, conflicts);
  }
  if (pick.currentCount >= pick.capacity) {
    warnings.push(`Class "${pick.name}" is at capacity — will exceed.`);
  }

  return emit(pick.id, desiredStream, 'PROMOTE', warnings, conflicts);
}

/** BALANCED_DISTRIBUTION: target grade+1, spread evenly across streams. */
export function balancedDistribution(
  s: SourceStudent,
  ctx: StrategyCtx,
): StrategyResult {
  const warnings: string[] = [];
  const conflicts: string[] = [];

  if (s.gradeLevel === null) {
    conflicts.push('Student has no current grade level');
    return emit(null, null, 'SKIP', warnings, conflicts);
  }
  const targetGrade = s.gradeLevel + 1;
  if (targetGrade > ctx.terminalGrade) {
    return emit(null, null, 'GRADUATE', [], []);
  }

  const candidates = ctx.targetClasses.filter(
    (c) => c.gradeLevel === targetGrade,
  );
  if (!candidates.length) {
    conflicts.push(`No classes exist for Grade ${targetGrade}`);
    return emit(null, null, 'SKIP', warnings, conflicts);
  }
  const pick = pickLeastFull(candidates);
  if (!pick) {
    conflicts.push(`Could not pick a class for Grade ${targetGrade}`);
    return emit(null, null, 'SKIP', warnings, conflicts);
  }

  // Bump in-memory count so next iteration sees the change
  pick.currentCount += 1;

  if (s.stream && pick.stream && s.stream !== pick.stream) {
    warnings.push(
      `Stream changed: "${s.stream}" → "${pick.stream}" (balanced distribution)`,
    );
  }
  return emit(pick.id, pick.stream, 'PROMOTE', warnings, conflicts);
}

/** CUSTOM_MAPPING: never infer — all mappings must be set by admin. */
export function customMapping(
  s: SourceStudent,
  ctx: StrategyCtx,
): StrategyResult {
  const warnings: string[] = [];
  const conflicts: string[] = [];
  if (s.gradeLevel === null) {
    conflicts.push('No current grade');
    return emit(null, null, 'SKIP', warnings, conflicts);
  }
  if (s.gradeLevel + 1 > ctx.terminalGrade) {
    return emit(null, null, 'GRADUATE', [], []);
  }
  warnings.push('Custom mapping strategy — admin must set the target class.');
  return emit(null, null, 'PROMOTE', warnings, conflicts);
}

/** GRADE_ONLY: target year has no streams — ignore stream logic. */
export function gradeOnly(
  s: SourceStudent,
  ctx: StrategyCtx,
): StrategyResult {
  const warnings: string[] = [];
  const conflicts: string[] = [];
  if (s.gradeLevel === null) {
    conflicts.push('No current grade');
    return emit(null, null, 'SKIP', warnings, conflicts);
  }
  const targetGrade = s.gradeLevel + 1;
  if (targetGrade > ctx.terminalGrade) {
    return emit(null, null, 'GRADUATE', [], []);
  }
  const candidates = ctx.targetClasses.filter(
    (c) => c.gradeLevel === targetGrade && !c.stream,
  );
  if (!candidates.length) {
    conflicts.push(
      `No streamless class for Grade ${targetGrade} — required for GRADE_ONLY`,
    );
    return emit(null, null, 'SKIP', warnings, conflicts);
  }
  const pick = pickLeastFull(candidates);
  if (!pick) {
    conflicts.push(`No capacity available for Grade ${targetGrade}`);
    return emit(null, null, 'SKIP', warnings, conflicts);
  }
  return emit(pick.id, null, 'PROMOTE', warnings, conflicts);
}

// ───────────────────── helpers ─────────────────────
function emit(
  suggestedClassId: string | null,
  suggestedStream: string | null,
  action: StrategyResult['action'],
  warnings: string[],
  conflicts: string[],
): StrategyResult {
  return { suggestedClassId, suggestedStream, action, warnings, conflicts };
}

function pickLeastFull(candidates: TargetClass[]): TargetClass | null {
  if (!candidates.length) return null;
  return candidates.slice().sort((a, b) => {
    const aRoom = a.capacity - a.currentCount;
    const bRoom = b.capacity - b.currentCount;
    return bRoom - aRoom;
  })[0];
}

/** Validate a final mapping against the target year's streams config. */
export function validateFinalMapping(
  targetGrade: number,
  finalStream: string | null,
  streamsByGrade: Record<string, string[]> | null,
): void {
  validateStreamForGrade(streamsByGrade, targetGrade, finalStream);
}
