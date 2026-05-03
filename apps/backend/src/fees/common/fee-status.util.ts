/**
 * @file fee-status.util.ts
 * @description Status derivation + invariants. The ledger is the source of
 *   truth for balances; StudentFee.status is derived — never set directly.
 */

import { FeeStatus, InvoiceStatus } from '@prisma/client';
import { MONEY_EPSILON, gte } from './fee-math.util';

export interface StatusInput {
  totalAmount: number;
  paidAmount: number;
  dueDate?: Date | null;
  waived?: boolean;
  now?: Date;
}

/**
 * Derive FeeStatus from balance + dueDate + waiver.
 * Order of precedence: WAIVED > PAID > PARTIAL > OVERDUE > PENDING.
 */
export function deriveStatus(input: StatusInput): FeeStatus {
  const { totalAmount, paidAmount, dueDate, waived } = input;
  const now = input.now ?? new Date();

  if (waived) return FeeStatus.WAIVED;
  if (gte(paidAmount, totalAmount)) return FeeStatus.PAID;
  if (paidAmount > MONEY_EPSILON) return FeeStatus.PARTIAL;
  if (dueDate && dueDate.getTime() < now.getTime()) return FeeStatus.OVERDUE;
  return FeeStatus.PENDING;
}

/**
 * Derive InvoiceStatus mirroring fee status but in invoice vocabulary.
 */
export function deriveInvoiceStatus(input: StatusInput): InvoiceStatus {
  const { totalAmount, paidAmount, dueDate } = input;
  const now = input.now ?? new Date();

  if (gte(paidAmount, totalAmount)) return InvoiceStatus.PAID;
  if (paidAmount > MONEY_EPSILON) return InvoiceStatus.PARTIALLY_PAID;
  if (dueDate && dueDate.getTime() < now.getTime())
    return InvoiceStatus.OVERDUE;
  return InvoiceStatus.ISSUED;
}
