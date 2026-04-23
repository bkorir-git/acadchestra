/**
 * @file streams-config.helper.ts
 * @description Pure validators for per-year stream configuration.
 *   Used by both AcademicYearsService (on write) and ClassesService (on validate).
 */
import { BadRequestException } from '@nestjs/common';

export type StreamsByGrade = Record<string, string[]>;

/**
 * Enforce rule (Section 7.5):
 *   - grade key missing   → stream MUST be null
 *   - grade key []        → stream MUST be null (streamless)
 *   - grade key [A,B,C]   → stream MUST be one of A/B/C
 *   NO silent fallback.
 */
export function validateStreamForGrade(
  config: StreamsByGrade | null | undefined,
  gradeLevel: number,
  stream: string | null | undefined,
): void {
  const key = String(gradeLevel);
  const configured = config?.[key];

  if (configured === undefined) {
    if (stream) {
      throw new BadRequestException(
        `Streams are not configured for Grade ${gradeLevel} in this academic year. Configure streamsByGrade first or omit stream.`,
      );
    }
    return;
  }

  if (configured.length === 0) {
    if (stream) {
      throw new BadRequestException(
        `Grade ${gradeLevel} is streamless in this academic year — stream must be null.`,
      );
    }
    return;
  }

  if (!stream) {
    throw new BadRequestException(
      `Grade ${gradeLevel} requires a stream — allowed: ${configured.join(', ')}`,
    );
  }

  if (!configured.includes(stream)) {
    throw new BadRequestException(
      `Invalid stream "${stream}" for Grade ${gradeLevel}. Allowed: ${configured.join(', ')}`,
    );
  }
}

/** Normalises the config: trims labels, removes empties, uppercases keys. */
export function normalizeStreamsConfig(
  raw: Record<string, unknown>,
): StreamsByGrade {
  const out: StreamsByGrade = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!/^\d+$/.test(key)) {
      throw new BadRequestException(
        `Invalid grade level key "${key}" — must be a numeric string`,
      );
    }
    if (!Array.isArray(val)) {
      throw new BadRequestException(
        `Streams for Grade ${key} must be an array of strings`,
      );
    }
    const labels = val
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter((s) => s.length > 0);
    const unique = Array.from(new Set(labels));
    if (unique.length !== labels.length) {
      throw new BadRequestException(
        `Duplicate stream labels for Grade ${key}`,
      );
    }
    out[key] = unique;
  }
  return out;
}
