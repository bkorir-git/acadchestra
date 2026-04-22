/**
 * @description Application-wide event constants — fired via @nestjs/event-emitter.
 *
 * All listeners subscribe via `@OnEvent(EVENTS.X)`.
 */
export const EVENTS = {
  // ─── Academic ─────────────────────────────────────────────
  ACADEMIC_YEAR_CREATED: 'academic.year.created',
  ACADEMIC_YEAR_ACTIVATED: 'academic.year.activated',
  ACADEMIC_YEAR_ARCHIVED: 'academic.year.archived',
  ACADEMIC_YEAR_FINANCIAL_LOCKED: 'academic.year.financial_locked',

  TERM_CREATED: 'academic.term.created',
  TERM_ACTIVATED: 'academic.term.activated',
  TERM_DEACTIVATED: 'academic.term.deactivated',
  TERM_STARTING_SOON: 'academic.term.starting_soon',
  TERM_OVERDUE: 'academic.term.overdue',
  TERM_COMPLETED: 'academic.term.completed',
  TERM_STATE_MISMATCH: 'academic.term.state_mismatch',
  HOLIDAY_STARTED: 'academic.holiday.started',

  // ─── Students ────────────────────────────────────────────
  STUDENT_ENROLLED: 'student.enrolled',
  STUDENT_PROMOTED: 'student.promoted',
  STUDENT_TRANSFERRED: 'student.transferred',
  STUDENT_GRADUATED: 'student.graduated',
  BULK_PROMOTION_COMPLETED: 'student.bulk_promotion.completed',
  PROMOTION_REVERTED: 'student.promotion.reverted',

  // ─── Fees / Billing ──────────────────────────────────────
  FEE_STRUCTURE_CREATED: 'fee.structure.created',
  FEE_STRUCTURE_VERSIONED: 'fee.structure.versioned',
  BILLING_GENERATED: 'fee.billing.generated',
  BILLING_RUN_COMPLETED: 'fee.billing.run_completed',
  BILLING_VOIDED: 'fee.billing.voided',
  STUDENT_FEE_CREATED: 'fee.student_fee.created',
  FEE_DUE_SOON: 'fee.due_soon',
  FEE_OVERDUE: 'fee.overdue',
  FEE_ARREARS_ALERT: 'fee.arrears.alert',
  ARREARS_ROLLED_OVER: 'fee.arrears.rolled_over',
  ARREARS_ROLLED_FORWARD: 'fee.arrears.rolled_forward',

  // ─── Payments ────────────────────────────────────────────
  PAYMENT_RECORDED: 'payment.recorded',
  PAYMENT_VOIDED: 'payment.voided',
  PAYMENT_REVERSED: 'payment.reversed',
  OVERPAYMENT_DETECTED: 'payment.overpayment',

  // ─── Discounts ───────────────────────────────────────────
  DISCOUNT_APPLIED: 'discount.applied',
  DISCOUNT_REVOKED: 'discount.revoked',

  // ─── Invoices ────────────────────────────────────────────
  INVOICE_ISSUED: 'invoice.issued',
  INVOICE_PAID: 'invoice.paid',
  INVOICES_ISSUED: 'invoice.batch_issued',

  // ─── Financial Lock ──────────────────────────────────────
  FINANCIAL_LOCK_APPLIED: 'finance.lock.applied',
  FINANCIAL_LOCK_RELEASED: 'finance.lock.released',

  // ─── Notifications ───────────────────────────────────────
  NOTIFICATION_CREATED: 'notification.created',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
