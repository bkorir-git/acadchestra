/**
 * @file student-fees.service.ts
 * @description Read service for StudentFee. Powers the listing page,
 *   detail page, and the search-for-payment dropdown in the record-payment
 *   modal. Tenant-scoped at every query.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { QueryStudentFeesDto } from './dto/query-student-fees.dto';
import { roundMoney } from '../common/fee-math.util';

interface RequestActor {
  id: string;
  tenantId: string;
}

@Injectable()
export class StudentFeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryStudentFeesDto, actor: RequestActor) {
    const {
      page = 1,
      limit = 10,
      search,
      studentId,
      classId,
      streamId,
      gradeId,
      feeStructureId,
      academicYearId,
      academicTermId,
      status,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StudentFeeWhereInput = {
      tenantId: actor.tenantId,
      ...(status && { status }),
      ...(studentId && { studentId }),
      ...(feeStructureId && { feeStructureId }),
      ...(academicYearId && { feeStructure: { academicYearId } }),
      ...(academicTermId && { feeStructure: { academicTermId } }),
      ...(classId && { student: { classId } }),
      ...(streamId && { student: { streamId } }),
      ...(gradeId && { student: { class: { gradeId } } }),
      ...(search && {
        student: {
          OR: [
            { admissionNumber: { contains: search, mode: 'insensitive' } },
            { rollNumber: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        },
      }),
    };

    const [data, total, agg] = await Promise.all([
      this.prisma.studentFee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                  grade: { select: { id: true, name: true } },
                },
              },
              stream: { select: { id: true, name: true } },
            },
          },
          feeStructure: {
            select: {
              id: true,
              name: true,
              academicYear: { select: { id: true, name: true } },
              academicTerm: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.studentFee.count({ where }),
      this.prisma.studentFee.aggregate({
        where,
        _sum: {
          totalAmount: true,
          paidAmount: true,
          pendingAmount: true,
        },
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
      summary: {
        totalBilled: roundMoney(agg._sum.totalAmount ?? 0),
        totalCollected: roundMoney(agg._sum.paidAmount ?? 0),
        totalOutstanding: roundMoney(agg._sum.pendingAmount ?? 0),
      },
    };
  }

  async findOne(id: string, actor: RequestActor) {
    const sf = await this.prisma.studentFee.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        student: {
          include: {
            class: { include: { grade: true } },
            stream: true,
            guardians: { include: { guardian: true } },
          },
        },
        feeStructure: { include: { academicYear: true, academicTerm: true } },
        components: { orderBy: { sortOrder: 'asc' } },
        payments: {
          orderBy: { paidAt: 'desc' },
          include: { allocations: { include: { studentFeeComponent: true } } },
        },
        invoice: true,
      },
    });
    if (!sf) throw new NotFoundException('Student fee not found');
    return sf;
  }

  async searchForPayment(
    search: string | undefined,
    actor: RequestActor,
    limit = 20,
  ) {
    const where: Prisma.StudentFeeWhereInput = {
      tenantId: actor.tenantId,
      pendingAmount: { gt: 0 },
      status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      ...(search &&
        search.trim() && {
          student: {
            OR: [
              {
                admissionNumber: {
                  contains: search.trim(),
                  mode: 'insensitive',
                },
              },
              { rollNumber: { contains: search.trim(), mode: 'insensitive' } },
              { firstName: { contains: search.trim(), mode: 'insensitive' } },
              { lastName: { contains: search.trim(), mode: 'insensitive' } },
            ],
          },
        }),
    };
    const items = await this.prisma.studentFee.findMany({
      where,
      take: limit,
      orderBy: [{ pendingAmount: 'desc' }, { createdAt: 'desc' }],
      include: {
        student: {
          include: {
            class: { select: { id: true, name: true } },
          },
        },
        feeStructure: { select: { id: true, name: true } },
      },
    });
    return items.map((f) => ({
      id: f.id,
      studentId: f.studentId,
      studentName: `${f.student.firstName} ${f.student.lastName}`,
      admissionNumber: f.student.admissionNumber,
      className: f.student.class?.name,
      avatar: f.student.photoUrl ?? null,
      feeStructureName: f.feeStructure.name,
      totalAmount: f.totalAmount,
      paidAmount: f.paidAmount,
      pendingAmount: f.pendingAmount,
      status: f.status,
    }));
  }
}
