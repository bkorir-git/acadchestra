/**
 * @description Application-wide event constants — fired via @nestjs/event-emitter.
 */
export const EVENTS = {
  // Academic
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
  HOLIDAY_STARTED: 'academic.holiday.started',

  // Students
  STUDENT_ENROLLED: 'student.enrolled',
  STUDENT_PROMOTED: 'student.promoted',
  STUDENT_TRANSFERRED: 'student.transferred',
  STUDENT_GRADUATED: 'student.graduated',

  // Fees / Billing
  FEE_STRUCTURE_CREATED: 'fee.structure.created',
  FEE_STRUCTURE_VERSIONED: 'fee.structure.versioned',
  BILLING_GENERATED: 'fee.billing.generated',
  STUDENT_FEE_CREATED: 'fee.student_fee.created',
  FEE_DUE_SOON: 'fee.due_soon',
  FEE_OVERDUE: 'fee.overdue',
  ARREARS_ROLLED_OVER: 'fee.arrears.rolled_over',

  // Payments
  PAYMENT_RECORDED: 'payment.recorded',
  PAYMENT_VOIDED: 'payment.voided',
  OVERPAYMENT_DETECTED: 'payment.overpayment',

  // Discounts
  DISCOUNT_APPLIED: 'discount.applied',
  DISCOUNT_REVOKED: 'discount.revoked',

  // Notifications
  NOTIFICATION_CREATED: 'notification.created',

  // Invoice
  INVOICE_ISSUED: 'invoice.issued',
  INVOICE_PAID: 'invoice.paid',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
