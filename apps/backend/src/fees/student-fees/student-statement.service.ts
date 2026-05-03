/**
 * @file student-statement.service.ts
 * @description "As-at-date" statement showing every ledger movement up to a
 *   chosen date plus the derived balance. Produces JSON for UI; PDF rendering
 *   lives in the downloads module (statement.template.ts + Puppeteer).
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { roundMoney } from '../common/fee-math.util';
import { parseOptionalDateInput } from '../common/date-input.util';

export interface StatementLine {
  date: Date;
  description: string;
  reference: string | null;
  debit: number;
  credit: number;
  balance: number;
}

export interface StatementData {
  asOfDate: Date;
  generatedAt: Date;
  student: {
    id: string;
    fullName: string;
    admissionNumber: string;
    className?: string;
    gradeName?: string;
    streamName?: string | null;
    email: string | null;
    phone: string | null;
  };
  tenant: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email: string;
    logo?: string | null;
  };
  currency: string;
  currencySymbol: string;
  lines: StatementLine[];
  summary: {
    totalBilled: number;
    totalPaid: number;
    totalDiscounts: number;
    totalReversals: number;
    balanceAsOf: number;
  };
  activeFees: Array<{
    feeStructureName: string;
    academicYearName: string;
    academicTermName?: string | null;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    status: string;
  }>;
}

@Injectable()
export class StudentStatementService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeAsOf(asOfDate?: string | Date): Date {
    const parsed = parseOptionalDateInput(asOfDate, {
      label: 'asOf',
      endOfDay: true,
      defaultValue: new Date(),
    });
    if (!parsed) {
      throw new BadRequestException('asOf is invalid');
    }
    return parsed;
  }

  private referenceForEntry(entry: {
    reference?: string | null;
    feePayment?: { receiptNumber?: string | null } | null;
    description: string;
  }): string | null {
    if (entry.reference) return entry.reference;
    if (entry.feePayment?.receiptNumber) return entry.feePayment.receiptNumber;
    const match = entry.description.match(/RCP-[A-Z0-9-]+/i);
    return match?.[0] ?? null;
  }

  async getStatement(
    tenantId: string,
    studentId: string,
    asOfDate?: string | Date,
  ): Promise<StatementData> {
    const asOf = this.normalizeAsOf(asOfDate);

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: {
        class: { include: { grade: true } },
        stream: true,
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const entries = await this.prisma.feeLedger.findMany({
      where: { tenantId, studentId, occurredAt: { lte: asOf } },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
      include: { feePayment: { select: { receiptNumber: true } } },
    });

    let running = 0;
    let totalBilled = 0;
    let totalPaid = 0;
    let totalDiscounts = 0;
    let totalReversals = 0;

    const lines: StatementLine[] = entries.map((entry) => {
      const amount = roundMoney(entry.amount);
      let debit = 0;
      let credit = 0;

      switch (entry.entryType) {
        case 'DEBIT':
        case 'REVERSAL':
        case 'ADJUSTMENT':
          debit = amount;
          running = roundMoney(running + amount);
          if (entry.entryType === 'DEBIT')
            totalBilled = roundMoney(totalBilled + amount);
          if (entry.entryType === 'REVERSAL')
            totalReversals = roundMoney(totalReversals + amount);
          break;
        case 'CREDIT':
        case 'WAIVER':
        case 'DISCOUNT':
          credit = amount;
          running = roundMoney(running - amount);
          if (entry.entryType === 'CREDIT')
            totalPaid = roundMoney(totalPaid + amount);
          if (entry.entryType === 'WAIVER' || entry.entryType === 'DISCOUNT') {
            totalDiscounts = roundMoney(totalDiscounts + amount);
          }
          break;
      }

      return {
        date: entry.occurredAt,
        description: entry.description,
        reference: this.referenceForEntry(entry),
        debit: roundMoney(debit),
        credit: roundMoney(credit),
        balance: roundMoney(running),
      };
    });

    const fees = await this.prisma.studentFee.findMany({
      where: { tenantId, studentId },
      include: {
        feeStructure: {
          select: {
            name: true,
            academicYear: { select: { name: true } },
            academicTerm: { select: { name: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return {
      asOfDate: asOf,
      generatedAt: new Date(),
      student: {
        id: student.id,
        fullName: `${student.firstName} ${student.lastName}`.trim(),
        admissionNumber: student.admissionNumber,
        className: student.class?.name,
        gradeName: student.class?.grade?.name,
        streamName: student.stream?.name ?? null,
        email: student.email,
        phone: student.phone,
      },
      tenant: {
        name: tenant.name,
        address: tenant.address,
        phone: tenant.phone,
        email: tenant.email,
        logo: tenant.logo ?? tenant.settings?.logoUrl ?? null,
      },
      currency: tenant.settings?.currency ?? 'KES',
      currencySymbol: tenant.settings?.currencySymbol ?? 'KSh',
      lines,
      summary: {
        totalBilled: roundMoney(totalBilled),
        totalPaid: roundMoney(totalPaid),
        totalDiscounts: roundMoney(totalDiscounts),
        totalReversals: roundMoney(totalReversals),
        balanceAsOf: roundMoney(running),
      },
      activeFees: fees.map((fee) => ({
        feeStructureName: fee.feeStructure.name,
        academicYearName: fee.feeStructure.academicYear.name,
        academicTermName: fee.feeStructure.academicTerm?.name ?? null,
        totalAmount: roundMoney(fee.totalAmount),
        paidAmount: roundMoney(fee.paidAmount),
        pendingAmount: roundMoney(fee.pendingAmount),
        status: fee.status,
      })),
    };
  }
}
