/**
 * @file fee-events.constants.ts
 * @description Single source of truth for fee event names. Listeners and
 *   emitters MUST import from here to avoid string-typo divergence.
 */

export const FEE_EVENTS = {
  STRUCTURE_CREATED: 'fees.structure.created',
  STRUCTURE_UPDATED: 'fees.structure.updated',
  STRUCTURE_LOCKED: 'fees.structure.locked',
  STRUCTURE_DELETED: 'fees.structure.deleted',

  CATEGORY_CREATED: 'fees.category.created',
  CATEGORY_UPDATED: 'fees.category.updated',
  CATEGORY_DELETED: 'fees.category.deleted',

  PAYMENT_RULE_CREATED: 'fees.payment-rule.created',
  PAYMENT_RULE_UPDATED: 'fees.payment-rule.updated',
  PAYMENT_RULE_VIOLATED: 'fees.payment-rule.violated',

  BILLING_PREVIEWED: 'fees.billing.previewed',
  BILLING_EXECUTED: 'fees.billing.executed',

  PAYMENT_RECORDED: 'fees.payment.recorded',
  PAYMENT_VOIDED: 'fees.payment.voided',

  INVOICE_ISSUED: 'fees.invoice.issued',
  INVOICE_CANCELLED: 'fees.invoice.cancelled',

  DISCOUNT_APPLIED: 'fees.discount.applied',
  DISCOUNT_REVOKED: 'fees.discount.revoked',

  ARREARS_ROLLED: 'fees.arrears.rolled',

  FINANCIAL_LOCK_APPLIED: 'fees.financial-lock.applied',
  FINANCIAL_LOCK_RELEASED: 'fees.financial-lock.released',

  FEE_DUE_SOON: 'fees.fee.due_soon',
  FEE_OVERDUE: 'fees.fee.overdue',
  FEE_ARREARS_ALERT: 'fees.fee.arrears_alert',
} as const;

export type FeeEventName = (typeof FEE_EVENTS)[keyof typeof FEE_EVENTS];
