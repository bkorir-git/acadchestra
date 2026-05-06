/**
 * @description Reports service — overview, by-class, by-term, by-category,
 *   collections-over-time, individual student report. All tenant-scoped.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../database/prisma.service';
import { roundMoney } from '../common/fee-math.util';
import {
  QueryCollectionsDto,
  QueryFeeReportsDto,
} from './dto/query-fee-reports.dto';


export interface ClassGroup {
  classId: string;
  className: string;
  gradeName: string;
  billed: number;
  collected: number;
  outstanding: number;
}

export interface TermGroup {
  termId: string | null;
  termName: string;
  termNumber: number;
  billed: number;
  collected: number;
  outstanding: number;
}

export interface CategoryGroup {
  category: string;
  billed: number;
  collected: number;
  outstanding: number;
}

// ───────────────────────────────────────────────────────────────────────────────

@Injectable()
export class FeeReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private studentFeeWhere(
    tenantId: string,
    filters: QueryFeeReportsDto,
  ): Prisma.StudentFeeWhereInput {
    const where: Prisma.StudentFeeWhereInput = { tenantId };

    if (filters.academicYearId || filters.academicTermId) {
      where.feeStructure = {
        ...(filters.academicYearId && {
          academicYearId: filters.academicYearId,
        }),
        ...(filters.academicTermId && {
          academicTermId: filters.academicTermId,
        }),
      };
    }

    if (
      filters.studentId ||
      filters.classId ||
      filters.gradeId ||
      filters.search
    ) {
      where.student = {
        ...(filters.studentId && { id: filters.studentId }),
        ...(filters.classId && { classId: filters.classId }),
        ...(filters.gradeId && { class: { gradeId: filters.gradeId } }),
        ...(filters.search && {
          OR: [
            {
              admissionNumber: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
            { firstName: { contains: filters.search, mode: 'insensitive' } },
            { lastName: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
      };
    }

    return where;
  }

  private paymentWhere(
    tenantId: string,
    filters: QueryFeeReportsDto,
  ): Prisma.FeePaymentWhereInput {
    const where: Prisma.FeePaymentWhereInput = {
      tenantId,
      status: PaymentStatus.COMPLETED,
    };
    if (
      filters.academicYearId ||
      filters.academicTermId ||
      filters.classId ||
      filters.studentId
    ) {
      where.studentFee = {
        ...(filters.studentId && { studentId: filters.studentId }),
        ...(filters.academicYearId || filters.academicTermId
          ? {
              feeStructure: {
                ...(filters.academicYearId && {
                  academicYearId: filters.academicYearId,
                }),
                ...(filters.academicTermId && {
                  academicTermId: filters.academicTermId,
                }),
              },
            }
          : {}),
        ...(filters.classId ? { student: { classId: filters.classId } } : {}),
      };
    }
    return where;
  }

  private async workbookBuffer(
    sheetName: string,
    rows: Record<string, unknown>[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName.slice(0, 31));

    if (rows.length > 0) {
      const keys = Object.keys(rows[0]);
      worksheet.columns = keys.map((key) => ({ header: key, key, width: 20 }));
      rows.forEach((row) => worksheet.addRow(row));
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async overview(tenantId: string, filters: QueryFeeReportsDto) {
    const studentFeeWhere = this.studentFeeWhere(tenantId, filters);
    const paymentWhere = this.paymentWhere(tenantId, filters);

    const [
      studentFeeAgg,
      invoiceCount,
      uniqueStudents,
      statusBreakdown,
      paymentsByMethod,
    ] = await Promise.all([
      this.prisma.studentFee.aggregate({
        where: studentFeeWhere,
        _sum: { totalAmount: true, paidAmount: true, pendingAmount: true },
      }),
      this.prisma.invoice.count({
        where: {
          tenantId,
          ...(filters.academicYearId && {
            academicYearId: filters.academicYearId,
          }),
          ...(filters.academicTermId && {
            academicTermId: filters.academicTermId,
          }),
        },
      }),
      this.prisma.studentFee.findMany({
        where: studentFeeWhere,
        distinct: ['studentId'],
        select: { studentId: true },
      }),
      this.prisma.studentFee.groupBy({
        by: ['status'],
        where: studentFeeWhere,
        _count: true,
        _sum: { pendingAmount: true },
      }),
      this.prisma.feePayment.groupBy({
        by: ['paymentMethod'],
        where: paymentWhere,
        _count: true,
        _sum: { amount: true },
      }),
    ]);

    const totalBilled = roundMoney(studentFeeAgg._sum.totalAmount ?? 0);
    const totalCollected = roundMoney(studentFeeAgg._sum.paidAmount ?? 0);
    const totalOutstanding = roundMoney(studentFeeAgg._sum.pendingAmount ?? 0);

    return {
      totalBilled,
      totalCollected,
      totalOutstanding,
      invoiceCount,
      uniqueStudents: uniqueStudents.length,
      collectionRate:
        totalBilled > 0 ? roundMoney((totalCollected / totalBilled) * 100) : 0,
      statusBreakdown: statusBreakdown.map((row) => ({
        status: row.status,
        count: row._count,
        outstanding: roundMoney(row._sum.pendingAmount ?? 0),
      })),
      paymentsByMethod: paymentsByMethod.map((row) => ({
        method: row.paymentMethod,
        count: row._count,
        total: roundMoney(row._sum.amount ?? 0),
      })),
    };
  }

  async byClass(tenantId: string, filters: QueryFeeReportsDto) {
    const rows = await this.prisma.studentFee.findMany({
      where: this.studentFeeWhere(tenantId, filters),
      include: {
        student: { include: { class: { include: { grade: true } } } },
      },
    });

    const grouped = new Map<string, ClassGroup>();

    for (const row of rows) {
      const classId = row.student.classId;
      const className = row.student.class?.name ?? 'Unassigned';
      const gradeName = row.student.class?.grade?.name ?? '—';
      const current = grouped.get(classId) ?? {
        classId,
        className,
        gradeName,
        billed: 0,
        collected: 0,
        outstanding: 0,
      };
      current.billed = roundMoney(current.billed + row.totalAmount);
      current.collected = roundMoney(current.collected + row.paidAmount);
      current.outstanding = roundMoney(current.outstanding + row.pendingAmount);
      grouped.set(classId, current);
    }

    return Array.from(grouped.values())
      .map((r) => ({
        ...r,
        collectionRate:
          r.billed > 0 ? roundMoney((r.collected / r.billed) * 100) : 0,
      }))
      .sort(
        (a, b) =>
          a.gradeName.localeCompare(b.gradeName) ||
          a.className.localeCompare(b.className),
      );
  }

  async byTerm(tenantId: string, filters: QueryFeeReportsDto) {
    const rows = await this.prisma.studentFee.findMany({
      where: this.studentFeeWhere(tenantId, filters),
      include: { feeStructure: { include: { academicTerm: true } } },
    });

    const grouped = new Map<string, TermGroup>();

    for (const row of rows) {
      const termId = row.feeStructure.academicTermId ?? null;
      const termName =
        row.feeStructure.academicTerm?.name ?? 'Annual / Unbound';
      const termNumber = row.feeStructure.academicTerm?.termNumber ?? 0;
      const key = termId ?? 'annual';
      const current = grouped.get(key) ?? {
        termId,
        termName,
        termNumber,
        billed: 0,
        collected: 0,
        outstanding: 0,
      };
      current.billed = roundMoney(current.billed + row.totalAmount);
      current.collected = roundMoney(current.collected + row.paidAmount);
      current.outstanding = roundMoney(current.outstanding + row.pendingAmount);
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .map((r) => ({
        ...r,
        collectionRate:
          r.billed > 0 ? roundMoney((r.collected / r.billed) * 100) : 0,
      }))
      .sort(
        (a, b) =>
          a.termNumber - b.termNumber || a.termName.localeCompare(b.termName),
      );
  }

  async byCategory(tenantId: string, filters: QueryFeeReportsDto) {
    const rows = await this.prisma.studentFeeComponent.findMany({
      where: { studentFee: this.studentFeeWhere(tenantId, filters) },
      include: { feeComponent: true, allocations: true },
    });

    const grouped = new Map<string, CategoryGroup>();

    for (const row of rows) {
      const category = row.feeComponent?.category ?? 'OTHER';
      const collected = roundMoney(
        row.allocations.reduce((s, a) => s + a.amount, 0),
      );
      const current = grouped.get(category) ?? {
        category,
        billed: 0,
        collected: 0,
        outstanding: 0,
      };
      current.billed = roundMoney(current.billed + row.amount);
      current.collected = roundMoney(current.collected + collected);
      current.outstanding = roundMoney(
        current.outstanding + Math.max(0, row.amount - collected),
      );
      grouped.set(category, current);
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.category.localeCompare(b.category),
    );
  }

  async collections(tenantId: string, filters: QueryCollectionsDto) {
    const bucket = filters.bucket ?? 'month';
    const payments = await this.prisma.feePayment.findMany({
      where: this.paymentWhere(tenantId, filters),
      orderBy: [{ paidAt: 'asc' }],
      select: { paidAt: true, amount: true },
    });

    const formatter = (date: Date) => {
      const year = date.getUTCFullYear();
      const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
      const day = `${date.getUTCDate()}`.padStart(2, '0');
      if (bucket === 'day') return `${year}-${month}-${day}`;
      if (bucket === 'month') return `${year}-${month}`;
      const start = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      );
      const weekday = start.getUTCDay() || 7;
      start.setUTCDate(start.getUTCDate() - weekday + 1);
      const wy = start.getUTCFullYear();
      const wm = `${start.getUTCMonth() + 1}`.padStart(2, '0');
      const wd = `${start.getUTCDate()}`.padStart(2, '0');
      return `${wy}-${wm}-${wd}`;
    };

    const grouped = new Map<string, number>();
    for (const p of payments) {
      const key = formatter(p.paidAt);
      grouped.set(key, roundMoney((grouped.get(key) ?? 0) + p.amount));
    }

    return Array.from(grouped.entries())
      .map(([period, amount]) => ({ period, amount: roundMoney(amount) }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  async studentReport(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: { class: { include: { grade: true } }, stream: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const fees = await this.prisma.studentFee.findMany({
      where: { tenantId, studentId },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        feeStructure: { include: { academicYear: true, academicTerm: true } },
        components: { orderBy: { sortOrder: 'asc' } },
        payments: {
          orderBy: [{ paidAt: 'desc' }],
          include: { allocations: { include: { studentFeeComponent: true } } },
        },
        invoice: true,
      },
    });

    const summary = fees.reduce(
      (acc, fee) => {
        acc.totalBilled = roundMoney(acc.totalBilled + fee.totalAmount);
        acc.totalPaid = roundMoney(acc.totalPaid + fee.paidAmount);
        acc.totalPending = roundMoney(acc.totalPending + fee.pendingAmount);
        return acc;
      },
      { totalBilled: 0, totalPaid: 0, totalPending: 0 },
    );

    return { student, fees, summary };
  }

  async exportByClassXlsx(tenantId: string, filters: QueryFeeReportsDto) {
    const rows = await this.byClass(tenantId, filters);
    return this.workbookBuffer(
      'By Class',
      rows.map((row) => ({
        Grade: row.gradeName,
        Class: row.className,
        Billed: row.billed,
        Collected: row.collected,
        Outstanding: row.outstanding,
        'Collection Rate %': row.collectionRate,
      })),
    );
  }

  async exportByTermXlsx(tenantId: string, filters: QueryFeeReportsDto) {
    const rows = await this.byTerm(tenantId, filters);
    return this.workbookBuffer(
      'By Term',
      rows.map((row) => ({
        Term: row.termName,
        'Term Number': row.termNumber,
        Billed: row.billed,
        Collected: row.collected,
        Outstanding: row.outstanding,
        'Collection Rate %': row.collectionRate,
      })),
    );
  }

  async exportByCategoryXlsx(tenantId: string, filters: QueryFeeReportsDto) {
    const rows = await this.byCategory(tenantId, filters);
    return this.workbookBuffer(
      'By Category',
      rows.map((row) => ({
        Category: row.category,
        Billed: row.billed,
        Collected: row.collected,
        Outstanding: row.outstanding,
      })),
    );
  }

  async exportArrearsXlsx(tenantId: string, filters: QueryFeeReportsDto) {
    const rows = await this.prisma.studentFee.findMany({
      where: {
        ...this.studentFeeWhere(tenantId, filters),
        pendingAmount: { gt: 0 },
        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      },
      include: {
        student: { include: { class: { include: { grade: true } } } },
        feeStructure: { include: { academicYear: true, academicTerm: true } },
      },
      orderBy: [{ pendingAmount: 'desc' }],
    });

    return this.workbookBuffer(
      'Arrears',
      rows.map((row) => ({
        'Admission Number': row.student.admissionNumber,
        Student: `${row.student.firstName} ${row.student.lastName}`.trim(),
        Class: row.student.class?.name ?? '',
        Grade: row.student.class?.grade?.name ?? '',
        'Fee Structure': row.feeStructure.name,
        Year: row.feeStructure.academicYear.name,
        Term: row.feeStructure.academicTerm?.name ?? '',
        Billed: row.totalAmount,
        Paid: row.paidAmount,
        Arrears: row.pendingAmount,
        Status: row.status,
      })),
    );
  }
}
