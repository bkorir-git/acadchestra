/**
 * @file invoices.service.ts
 * @description Read + cancel service for invoices. Invoices are auto-issued
 *   by the BillingService at execute time; this service is only responsible
 *   for listing, detail lookup, and lifecycle (cancel/void). Cancellation
 *   refuses if the invoice already has payments — those need to be voided
 *   first.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ActivityAction,
  ActivityEntityType,
  InvoiceStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { FEE_EVENTS } from '../common/fee-events.constants';
import { roundMoney } from '../common/fee-math.util';

interface Actor {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
}

interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
  studentId?: string;
  status?: InvoiceStatus;
  academicYearId?: string;
  academicTermId?: string;
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly events: EventEmitter2,
  ) {}

  private actorName(a: Actor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  async findAll(query: ListQuery, actor: Actor) {
    const {
      page = 1,
      limit = 10,
      search,
      studentId,
      status,
      academicYearId,
      academicTermId,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      tenantId: actor.tenantId,
      ...(studentId && { studentId }),
      ...(status && { status }),
      ...(academicYearId && { academicYearId }),
      ...(academicTermId && { academicTermId }),
      ...(search && {
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          {
            student: {
              OR: [
                { admissionNumber: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      }),
    };

    const [data, total, agg] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issueDate: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              admissionNumber: true,
              firstName: true,
              lastName: true,
              class: { select: { id: true, name: true } },
            },
          },
          feeStructure: {
            select: {
              id: true,
              name: true,
              academicYear: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.aggregate({
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
        totalPaid: roundMoney(agg._sum.paidAmount ?? 0),
        totalOutstanding: roundMoney(agg._sum.pendingAmount ?? 0),
      },
    };
  }

  async findOne(id: string, actor: Actor) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        student: {
          include: {
            class: { include: { grade: true } },
            stream: true,
            guardians: { include: { guardian: true } },
          },
        },
        feeStructure: {
          include: { academicYear: true, academicTerm: true },
        },
        studentFee: {
          include: {
            components: { orderBy: { sortOrder: 'asc' } },
            payments: {
              where: { status: 'COMPLETED' },
              orderBy: { paidAt: 'desc' },
            },
          },
        },
      },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  async cancel(id: string, reason: string, actor: Actor) {
    if (!reason || !reason.trim())
      throw new BadRequestException('Cancellation reason required');
    const inv = await this.prisma.invoice.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status === InvoiceStatus.CANCELLED) return inv;
    if (inv.paidAmount > 0)
      throw new ForbiddenException(
        'Cannot cancel: invoice has payments. Void payments first.',
      );

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.CANCELLED,
        notes: [inv.notes, `Cancelled: ${reason}`].filter(Boolean).join(' · '),
      },
    });

    await this.activity.log({
      action: ActivityAction.UPDATE,
      entityType: ActivityEntityType.INVOICE,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} cancelled invoice ${inv.invoiceNumber} — ${reason}`,
      metadata: { reason },
    });

    this.events.emit(FEE_EVENTS.INVOICE_CANCELLED, {
      tenantId: actor.tenantId,
      invoiceId: id,
    });
    return updated;
  }
}