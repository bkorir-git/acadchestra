/**
 * @file fee-ledger.service.ts
 * @description Fee Ledger — the single source of truth for every money
 *   movement. All aggregate updates on StudentFee/Invoice are derived from
 *   ledger rows. Supports DEBIT / CREDIT / REVERSAL / ADJUSTMENT / WAIVER /
 *   DISCOUNT entries with computed running balance per student.
 *
 *   Balance formula:
 *     balance = Σ DEBIT + Σ REVERSAL + Σ ADJUSTMENT
 *             − Σ CREDIT − Σ WAIVER − Σ DISCOUNT
 */
import { Injectable } from '@nestjs/common';
import { LedgerEntryType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { roundMoney } from '../common/fee-math.util';
import { parseOptionalDateInput } from '../common/date-input.util';

export interface LedgerEntryInput {
  tenantId: string;
  studentId: string;
  entryType: LedgerEntryType;
  amount: number;
  description: string;
  reference?: string;
  studentFeeId?: string;
  feePaymentId?: string;
  recordedById?: string;
  occurredAt?: Date;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class FeeLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async getStudentBalance(
    tx: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    studentId: string,
  ): Promise<number> {
    const agg = await tx.feeLedger.groupBy({
      by: ['entryType'],
      where: { tenantId, studentId },
      _sum: { amount: true },
    });
    let debit = 0,
      credit = 0,
      reversal = 0,
      adjustment = 0,
      waiver = 0,
      discount = 0;
    for (const row of agg) {
      const sum = row._sum.amount ?? 0;
      switch (row.entryType) {
        case 'DEBIT':
          debit = sum;
          break;
        case 'CREDIT':
          credit = sum;
          break;
        case 'REVERSAL':
          reversal = sum;
          break;
        case 'ADJUSTMENT':
          adjustment = sum;
          break;
        case 'WAIVER':
          waiver = sum;
          break;
        case 'DISCOUNT':
          discount = sum;
          break;
      }
    }
    return roundMoney(
      debit + reversal + adjustment - credit - waiver - discount,
    );
  }

  private deltaFor(type: LedgerEntryType, amount: number): number {
    switch (type) {
      case 'DEBIT':
      case 'REVERSAL':
      case 'ADJUSTMENT':
        return amount;
      case 'CREDIT':
      case 'WAIVER':
      case 'DISCOUNT':
        return -amount;
    }
  }

  async write(tx: Prisma.TransactionClient, input: LedgerEntryInput) {
    const prev = await this.getStudentBalance(
      tx,
      input.tenantId,
      input.studentId,
    );
    const delta = this.deltaFor(input.entryType, input.amount);
    const balanceAfter = roundMoney(prev + delta);

    return tx.feeLedger.create({
      data: {
        tenantId: input.tenantId,
        studentId: input.studentId,
        entryType: input.entryType,
        amount: roundMoney(input.amount),
        balanceAfter,
        description: input.description,
        reference: input.reference,
        studentFeeId: input.studentFeeId,
        feePaymentId: input.feePaymentId,
        recordedById: input.recordedById,
        occurredAt: input.occurredAt ?? new Date(),
        metadata: input.metadata,
      },
    });
  }

  async writeBulk(tx: Prisma.TransactionClient, entries: LedgerEntryInput[]) {
    for (const e of entries) await this.write(tx, e);
  }

  async getStudentLedger(
    tenantId: string,
    studentId: string,
    options?: {
      page?: number;
      limit?: number;
      from?: Date | string;
      to?: Date | string;
    },
  ) {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    const from = parseOptionalDateInput(options?.from as any, {
      label: 'from',
    });
    const to = parseOptionalDateInput(options?.to as any, {
      label: 'to',
      endOfDay: true,
    });

    const where: Prisma.FeeLedgerWhereInput = {
      tenantId,
      studentId,
      ...((from || to) && {
        occurredAt: {
          ...(from && { gte: from }),
          ...(to && { lte: to }),
        },
      }),
    };
    const [entries, total, currentBalance] = await Promise.all([
      this.prisma.feeLedger.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          student: {
            select: {
              firstName: true,
              lastName: true,
              admissionNumber: true,
              class: { select: { name: true } },
            },
          },
          studentFee: { include: { feeStructure: { select: { name: true } } } },
          feePayment: {
            select: { receiptNumber: true, paymentMethod: true },
          },
        },
      }),
      this.prisma.feeLedger.count({ where }),
      this.getStudentBalance(this.prisma, tenantId, studentId),
    ]);
    return {
      entries,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
      currentBalance,
    };
  }

  async getTenantLedger(
    tenantId: string,
    options?: {
      page?: number;
      limit?: number;
      from?: Date | string;
      to?: Date | string;
      entryType?: LedgerEntryType;
      studentId?: string;
    },
  ) {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    const from = parseOptionalDateInput(options?.from as any, {
      label: 'from',
    });
    const to = parseOptionalDateInput(options?.to as any, {
      label: 'to',
      endOfDay: true,
    });

    const where: Prisma.FeeLedgerWhereInput = {
      tenantId,
      ...(options?.studentId && { studentId: options.studentId }),
      ...(options?.entryType && { entryType: options.entryType }),
      ...((from || to) && {
        occurredAt: {
          ...(from && { gte: from }),
          ...(to && { lte: to }),
        },
      }),
    };
    const [entries, total, summary] = await Promise.all([
      this.prisma.feeLedger.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          student: {
            select: {
              firstName: true,
              lastName: true,
              admissionNumber: true,
              class: { select: { name: true } },
            },
          },
          feePayment: {
            select: { receiptNumber: true, paymentMethod: true },
          },
        },
      }),
      this.prisma.feeLedger.count({ where }),
      this.prisma.feeLedger.groupBy({
        by: ['entryType'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    return {
      entries,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
      summary: summary.map((s) => ({
        entryType: s.entryType,
        total: roundMoney(s._sum.amount ?? 0),
        count: s._count,
      })),
    };
  }
}
