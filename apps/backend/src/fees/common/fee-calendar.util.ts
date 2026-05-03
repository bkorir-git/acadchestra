/**
 * @description Bridge between Academic Year structure and billing cadence.
 *   The year's termStructure drives billing behaviour:
 *     - TWO_SEMESTERS  → 2 billing cycles
 *     - THREE_TERMS    → 3 billing cycles
 *     - FOUR_QUARTERS  → 4 billing cycles
 *     - CUSTOM         → driven entirely by admin-defined AcademicTerm rows
 *     - ANNUAL fees    → single cycle (no term binding)
 *     - MONTHLY fees   → period-based (not term-based)
 */

import { AcademicTerm, AcademicYear, FeeType } from '@prisma/client';

export interface BillingCycle {
  termId: string | null;
  termName: string;
  startDate: Date;
  endDate: Date;
  index: number;
  hasFees: boolean;
}

export interface BillingCalendar {
  yearId: string;
  yearName: string;
  structure: string;
  cycles: BillingCycle[];
}

/**
 * Build a billing calendar from a year + its terms.
 * If fee type is ANNUAL, the calendar collapses to one cycle covering the
 * entire year. If CUSTOM / MONTHLY, the caller drives periods separately.
 */
export function resolveBillingCalendar(
  year: AcademicYear,
  terms: AcademicTerm[],
  feeType: FeeType = 'TERM_WISE',
): BillingCalendar {
  if (feeType === 'ANNUAL') {
    return {
      yearId: year.id,
      yearName: year.name,
      structure: 'ANNUAL',
      cycles: [
        {
          termId: null,
          termName: `${year.name} (Annual)`,
          startDate: year.startDate,
          endDate: year.endDate,
          index: 0,
          hasFees: true,
        },
      ],
    };
  }

  const sorted = [...terms].sort((a, b) => a.termNumber - b.termNumber);
  return {
    yearId: year.id,
    yearName: year.name,
    structure: year.termStructure,
    cycles: sorted.map((t, i) => ({
      termId: t.id,
      termName: t.name,
      startDate: t.startDate,
      endDate: t.endDate,
      index: i,
      hasFees: t.hasFees,
    })),
  };
}

/** Returns the cycle that contains `date`, or null if none matches. */
export function findCycleForDate(
  calendar: BillingCalendar,
  date: Date = new Date(),
): BillingCycle | null {
  return (
    calendar.cycles.find((c) => date >= c.startDate && date <= c.endDate) ??
    null
  );
}

/**
 * Decide a sensible default due date for a billing cycle.
 * Heuristic: 14 days after the term starts, clamped to the term end.
 */
export function defaultDueDateForCycle(cycle: BillingCycle): Date {
  const start = new Date(cycle.startDate);
  const due = new Date(start);
  due.setDate(due.getDate() + 14);
  return due > cycle.endDate ? cycle.endDate : due;
}
