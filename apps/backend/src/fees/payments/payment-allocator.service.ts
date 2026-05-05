/**
 * @file payment-allocator.service.ts
 * @description Deterministic allocator across unpaid components of a
 *   StudentFee. Sort order:
 *     1. dueDate ASC NULLS LAST
 *     2. priority DESC (higher first)
 *     3. sortOrder ASC
 *     4. createdAt ASC
 *   Supports reversal for void/refund operations.
 */

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { deriveStatus } from '../common/fee-status.util';
import { roundMoney } from '../common/fee-math.util';

export interface AllocationResult {
  componentId: string;
  amount: number;
}

@Injectable()
export class PaymentAllocatorService {
  async allocate(
    tx: Prisma.TransactionClient,
    studentFeeId: string,
    paymentAmount: number,
  ): Promise<{ allocations: AllocationResult[]; unallocated: number }> {
    const components = await tx.studentFeeComponent.findMany({
      where: { studentFeeId },
      orderBy: [
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { priority: 'desc' },
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    const allocations: AllocationResult[] = [];
    let remaining = roundMoney(paymentAmount);

    for (const c of components) {
      if (remaining <= 0) break;
      const outstanding = roundMoney(c.amount - c.paidAmount);
      if (outstanding <= 0) continue;

      const take = Math.min(outstanding, remaining);
      allocations.push({ componentId: c.id, amount: roundMoney(take) });

      const newPaid = roundMoney(c.paidAmount + take);
      await tx.studentFeeComponent.update({
        where: { id: c.id },
        data: {
          paidAmount: newPaid,
          status: deriveStatus({
            totalAmount: c.amount,
            paidAmount: newPaid,
            dueDate: c.dueDate,
          }),
        },
      });
      remaining = roundMoney(remaining - take);
    }
    return { allocations, unallocated: roundMoney(remaining) };
  }

  async reverse(
    tx: Prisma.TransactionClient,
    allocations: Array<{ studentFeeComponentId: string; amount: number }>,
  ) {
    for (const a of allocations) {
      const c = await tx.studentFeeComponent.findUnique({
        where: { id: a.studentFeeComponentId },
      });
      if (!c) continue;
      const newPaid = roundMoney(Math.max(0, c.paidAmount - a.amount));
      await tx.studentFeeComponent.update({
        where: { id: c.id },
        data: {
          paidAmount: newPaid,
          status: deriveStatus({
            totalAmount: c.amount,
            paidAmount: newPaid,
            dueDate: c.dueDate,
          }),
        },
      });
    }
  }
}
