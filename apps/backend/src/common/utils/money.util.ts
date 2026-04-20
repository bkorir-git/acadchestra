/**
 * @description Money math utilities, status derivation, and receipt generation.
 */

import { FeeStatus } from '@prisma/client';

export const MONEY_EPSILON = 0.005;

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function isZero(value: number): boolean {
  return Math.abs(value) < MONEY_EPSILON;
}

export function isNegligible(value: number): boolean {
  return value < MONEY_EPSILON;
}

export function deriveStatus(params: {
  totalAmount: number;
  paidAmount: number;
  dueDate?: Date | null;
  waived?: boolean;
  now?: Date;
}): FeeStatus {
  const { totalAmount, paidAmount, dueDate, waived } = params;
  const now = params.now ?? new Date();

  if (waived) return FeeStatus.WAIVED;
  if (paidAmount + MONEY_EPSILON >= totalAmount) return FeeStatus.PAID;
  if (paidAmount > MONEY_EPSILON) return FeeStatus.PARTIAL;
  if (dueDate && dueDate.getTime() < now.getTime()) return FeeStatus.OVERDUE;
  return FeeStatus.PENDING;
}

export function generateReceiptNumber(
  tenantCode: string,
  sequence: number,
): string {
  const year = new Date().getFullYear();
  return `RCP-${tenantCode.toUpperCase()}-${year}-${sequence
    .toString()
    .padStart(6, '0')}`;
}

export function generateInvoiceNumber(
  prefix: string,
  tenantCode: string,
  sequence: number,
): string {
  const year = new Date().getFullYear();
  return `${prefix.toUpperCase()}-${tenantCode.toUpperCase()}-${year}-${sequence
    .toString()
    .padStart(6, '0')}`;
}

export function percentOf(amount: number, percent: number): number {
  return roundMoney((amount * percent) / 100);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}