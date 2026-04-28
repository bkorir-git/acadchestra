/**
 * @enum CalendarPhase
 * @description Central enum describing what operational phase a tenant is
 *   currently in, derived from the active academic year's state + periods.
 *
 *   Drives rule gating across the system:
 *     - SETUP             → class/fee creation allowed, no students yet
 *     - TEACHING          → attendance, assignments, fees billing
 *     - EXAMS             → academic lock (no class edits), grades entry
 *     - BREAK             → read-only for most operations
 *     - PROMOTION_WINDOW  → promotions allowed, billing frozen
 *     - ARCHIVED          → read-only historical
 */
export enum CalendarPhase {
  SETUP = 'SETUP',
  TEACHING = 'TEACHING',
  EXAMS = 'EXAMS',
  BREAK = 'BREAK',
  PROMOTION_WINDOW = 'PROMOTION_WINDOW',
  ARCHIVED = 'ARCHIVED',
}
