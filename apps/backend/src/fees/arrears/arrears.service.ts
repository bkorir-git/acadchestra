/**
 * @file arrears.service.ts
 * @description Arrears = students with outstanding balance. NOT "defaulters".
 *   Provides rich filters (year/term/class/stream/grade/category) and a
 *   roll-forward operation that flags balances and writes a marker
 *   ADJUSTMENT ledger entry tagged with target term metadata.
 *
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAction,
  ActivityEntityType,
  LedgerEntryType,
  Prisma,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { FeeLedgerService } from '../ledger/fee-ledger.service';
import { ArrearsQueryDto, RollForwardDto } from './dto/arrears-query.dto';
import { roundMoney } from '../common/fee-math.util';
import { FEE_EVENTS } from '../common/fee-events.constants';

interface Actor {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class ArrearsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly ledger: FeeLedgerService,
    private readonly events: EventEmitter2,
  ) {}

  private actorName(a: Actor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  async list(query: ArrearsQueryDto, actor: Actor) {
    const {
      page = 1,
      limit = 25,
      search,
      academicYearId,
      academicTermId,
      classId,
      streamId,
      gradeId,
      category,
      minDaysOverdue,
      status,
    } = query;
    const skip = (page - 1) * limit;
    const now = new Date();

    const baseStatuses = status ? [status] : ['PENDING', 'PARTIAL', 'OVERDUE'];

    const where: Prisma.StudentFeeWhereInput = {
      tenantId: actor.tenantId,
      pendingAmount: { gt: 0 },
      status: { in: baseStatuses as any },
      ...(academicYearId || academicTermId
        ? {
            feeStructure: {
              ...(academicYearId && { academicYearId }),
              ...(academicTermId && { academicTermId }),
            },
          }
        : {}),
      ...(classId || streamId || gradeId || search
        ? {
            student: {
              ...(classId && { classId }),
              ...(streamId && { streamId }),
              ...(gradeId && { class: { gradeId } }),
              ...(search && {
                OR: [
                  {
                    admissionNumber: { contains: search, mode: 'insensitive' },
                  },
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                ],
              }),
            },
          }
        : {}),
      ...(category && { components: { some: { feeComponent: { category } } } }),
      ...(minDaysOverdue && {
        dueDate: {
          lte: new Date(now.getTime() - minDaysOverdue * 24 * 3600 * 1000),
        },
      }),
    };

    const [rows, total, agg] = await Promise.all([
      this.prisma.studentFee.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ pendingAmount: 'desc' }, { createdAt: 'desc' }],
        include: {
          student: {
            include: {
              class: {
                select: {
                  name: true,
                  grade: { select: { id: true, name: true } },
                },
              },
              stream: { select: { id: true, name: true } },
            },
          },
          feeStructure: {
            select: {
              name: true,
              academicYear: { select: { name: true } },
              academicTerm: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.studentFee.count({ where }),
      this.prisma.studentFee.aggregate({
        where,
        _sum: { pendingAmount: true },
      }),
    ]);

    return {
      data: rows.map((row) => ({
        studentFeeId: row.id,
        studentId: row.studentId,
        studentName: `${row.student.firstName} ${row.student.lastName}`.trim(),
        admissionNumber: row.student.admissionNumber,
        phone: row.student.phone,
        email: row.student.email,
        className: row.student.class?.name,
        gradeName: row.student.class?.grade?.name,
        streamName: row.student.stream?.name ?? null,
        feeStructure: row.feeStructure.name,
        academicYear: row.feeStructure.academicYear.name,
        academicTerm: row.feeStructure.academicTerm?.name ?? null,
        totalAmount: row.totalAmount,
        paidAmount: row.paidAmount,
        arrearsAmount: row.pendingAmount,
        status: row.status,
        dueDate: row.dueDate,
        daysOverdue: row.dueDate
          ? Math.max(
              0,
              Math.floor(
                (now.getTime() - row.dueDate.getTime()) / (1000 * 60 * 60 * 24),
              ),
            )
          : 0,
      })),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
      summary: {
        totalArrears: roundMoney(agg._sum.pendingAmount ?? 0),
        studentCount: total,
      },
    };
  }

  async rollForward(dto: RollForwardDto, actor: Actor) {
    const tenantId = actor.tenantId;
    if (!dto.fromTermId || !dto.toTermId) {
      throw new BadRequestException('fromTermId and toTermId required');
    }
    if (dto.fromTermId === dto.toTermId) {
      throw new BadRequestException('Source and target terms must differ');
    }

    const [fromTerm, toTerm] = await Promise.all([
      this.prisma.academicTerm.findFirst({
        where: { id: dto.fromTermId, tenantId },
      }),
      this.prisma.academicTerm.findFirst({
        where: { id: dto.toTermId, tenantId },
      }),
    ]);
    if (!fromTerm || !toTerm) {
      throw new NotFoundException('One of the terms was not found');
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const arrears = await tx.studentFee.findMany({
          where: {
            tenantId,
            pendingAmount: { gt: 0 },
            feeStructure: { academicTermId: dto.fromTermId },
          },
        });

        let rolled = 0;
        let totalRolled = 0;

        for (const sf of arrears) {
          await tx.studentFee.update({
            where: { id: sf.id },
            data: { isArrears: true },
          });
          await this.ledger.write(tx, {
            tenantId,
            studentId: sf.studentId,
            entryType: LedgerEntryType.ADJUSTMENT,
            amount: 0,
            description: `Arrears of ${sf.pendingAmount} rolled forward to ${toTerm.name}`,
            reference: `ROLL-${fromTerm.id}->${toTerm.id}`,
            studentFeeId: sf.id,
            recordedById: actor.id,
            metadata: {
              rollForward: true,
              fromTermId: fromTerm.id,
              toTermId: toTerm.id,
              amount: sf.pendingAmount,
              note: dto.note ?? null,
            },
          });
          rolled++;
          totalRolled += sf.pendingAmount;
        }

        await this.activity.log(
          {
            action: ActivityAction.UPDATE,
            entityType: ActivityEntityType.STUDENT_FEE,
            entityId: fromTerm.id,
            tenantId,
            userId: actor.id,
            message: `${this.actorName(actor)} rolled forward arrears from ${fromTerm.name} → ${toTerm.name} (${rolled} students, ${roundMoney(totalRolled)} total)`,
            metadata: {
              fromTermId: fromTerm.id,
              toTermId: toTerm.id,
              rolled,
              totalRolled: roundMoney(totalRolled),
              note: dto.note,
            },
          },
          tx,
        );

        return {
          rolled,
          totalRolled: roundMoney(totalRolled),
          fromTerm: fromTerm.name,
          toTerm: toTerm.name,
        };
      },
      { timeout: 120_000 },
    );

    this.events.emit(FEE_EVENTS.ARREARS_ROLLED, {
      tenantId,
      fromTermId: fromTerm.id,
      toTermId: toTerm.id,
      ...result,
    });

    return result;
  }
}
