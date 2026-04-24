/**
 * @service StudentsService
 * @description Student lifecycle aligned to schema (User ⇄ Student ⇄ Class):
 *   - Paginated listing with search, status, classId filters
 *   - Atomic enrollment: create User + Student + open ClassHistory row
 *   - Transfer between classes (closes current history, opens new)
 *   - Fee summary + full profile (history + fees + discounts)
 *   - Activity + events
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  ActivityAction,
  ActivityEntityType,
  Prisma,
  StudentStatus,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { ActivityService } from '../../common/activity/activity.service';
import { EVENTS } from '../../common/events/events.constants';
import { StudentClassHistoryService } from '../student-class-history/student-class-history.service';
import {
  CreateStudentDto,
  TransferStudentDto,
  UpdateStudentDto,
} from './dto/student.dto';
import { RequestActor } from '../academic-terms/academic-terms.service';

export interface StudentListFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: StudentStatus | string;
  classId?: string;
  academicYearId?: string;
}

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
    private readonly history: StudentClassHistoryService,
    private readonly events: EventEmitter2,
  ) {}

  private actorName(a: RequestActor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  private generateTempEmail(firstName: string, lastName: string) {
    const slug = `${firstName}.${lastName}`
      .toLowerCase()
      .replace(/[^a-z.]/g, '');
    const rand = Math.random().toString(36).substring(2, 7);
    return `${slug}.${rand}@student.local`;
  }

  // ─────────────────────── LIST
  async findAll(actor: RequestActor, filters: StudentListFilters = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(200, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.StudentWhereInput = {
      tenantId: actor.tenantId,
      ...(filters.classId && { classId: filters.classId }),
      ...(filters.status && {
        academicStatus: filters.status as StudentStatus,
      }),
      ...(filters.academicYearId && {
        class: { academicYearId: filters.academicYearId },
      }),
      ...(filters.search && {
        OR: [
          { rollNumber: { contains: filters.search, mode: 'insensitive' } },
          {
            admissionNumber: { contains: filters.search, mode: 'insensitive' },
          },
          {
            user: {
              OR: [
                {
                  firstName: { contains: filters.search, mode: 'insensitive' },
                },
                {
                  lastName: { contains: filters.search, mode: 'insensitive' },
                },
                { email: { contains: filters.search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatar: true,
              gender: true,
              dateOfBirth: true,
              isActive: true,
            },
          },
          class: {
            select: {
              id: true,
              name: true,
              gradeLevel: true,
              stream: true,
              academicYear: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ rollNumber: 'asc' }],
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ─────────────────────── DETAIL
  async findOne(id: string, actor: RequestActor) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        user: true,
        class: {
          include: {
            academicYear: { select: { id: true, name: true } },
            classTeacher: {
              include: {
                user: {
                  select: { firstName: true, lastName: true, avatar: true },
                },
              },
            },
          },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  /** Complete profile: student + history ledger + fees + discounts. */
  async fullProfile(id: string, actor: RequestActor) {
    const student = await this.findOne(id, actor);
    const [history, fees, discounts, promotions] = await Promise.all([
      this.history.listForStudent(actor.tenantId, id),
      this.prisma.studentFee.findMany({
        where: { studentId: id, tenantId: actor.tenantId },
        include: {
          feeStructure: {
            select: {
              id: true,
              name: true,
              academicTerm: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.studentDiscount.findMany({
        where: { studentId: id, tenantId: actor.tenantId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.studentPromotion.findMany({
        where: { studentId: id, tenantId: actor.tenantId },
        include: {
          fromClass: { select: { id: true, name: true } },
          toClass: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const summary = {
      totalBilled: fees.reduce((s, f) => s + Number(f.totalAmount), 0),
      totalPaid: fees.reduce((s, f) => s + Number(f.paidAmount), 0),
      totalPending: fees.reduce((s, f) => s + Number(f.pendingAmount), 0),
      feeCount: fees.length,
    };

    return { student, history, fees, discounts, promotions, summary };
  }

  // ─────────────────────── ENROLL (User + Student atomic)
  async enroll(dto: CreateStudentDto, actor: RequestActor) {
    // Class must exist and belong to the target academic year
    const klass = await this.prisma.class.findFirst({
      where: { id: dto.classId, tenantId: actor.tenantId },
    });
    if (!klass) throw new NotFoundException('Class not found');
    if (klass.academicYearId !== dto.academicYearId) {
      throw new BadRequestException(
        'Class does not belong to the specified academic year',
      );
    }

    // Check capacity
    const enrolledCount = await this.prisma.student.count({
      where: { classId: dto.classId, academicStatus: StudentStatus.ACTIVE },
    });
    if (enrolledCount >= klass.capacity) {
      throw new BadRequestException(
        `Class "${klass.name}" is at capacity (${klass.capacity})`,
      );
    }

    // Uniqueness
    const dupRoll = await this.prisma.student.findFirst({
      where: { tenantId: actor.tenantId, rollNumber: dto.rollNumber },
    });
    if (dupRoll) throw new ConflictException('Roll number already exists');
    const dupAdm = await this.prisma.student.findFirst({
      where: { tenantId: actor.tenantId, admissionNumber: dto.admissionNumber },
    });
    if (dupAdm) throw new ConflictException('Admission number already exists');

    const email =
      dto.email || this.generateTempEmail(dto.firstName, dto.lastName);
    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException('Email already in use');
    }

    const tempPassword = await bcrypt.hash(
      `${dto.admissionNumber}@${new Date().getFullYear()}`,
      10,
    );

    const admissionDate = dto.admissionDate
      ? new Date(dto.admissionDate)
      : new Date();

    const student = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: tempPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          gender: dto.gender,
          avatar: dto.avatar,
          tenantId: actor.tenantId,
        },
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          classId: dto.classId,
          tenantId: actor.tenantId,
          rollNumber: dto.rollNumber,
          admissionNumber: dto.admissionNumber,
          admissionDate,
          emergencyContact: dto.emergencyContact,
          emergencyPhone: dto.emergencyPhone,
        },
      });

      // Assign default Student role if it exists
      const studentRole = await tx.role.findFirst({
        where: { tenantId: actor.tenantId, name: 'Student' },
      });
      if (studentRole) {
        await tx.userRole.create({
          data: { userId: user.id, roleId: studentRole.id },
        });
      }

      // Open a class-history entry
      await this.history.createEntry(
        actor.tenantId,
        {
          studentId: student.id,
          classId: dto.classId,
          academicYearId: dto.academicYearId,
          startDate: admissionDate.toISOString(),
          reason: 'INITIAL_ENROLLMENT',
          isCurrent: true,
        },
        actor.id,
        tx,
      );

      return student;
    });

    await this.activityService.log({
      action: ActivityAction.CREATE,
      entityType: ActivityEntityType.STUDENT,
      entityId: student.id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} enrolled student ${dto.firstName} ${dto.lastName}`,
      metadata: {
        classId: dto.classId,
        academicYearId: dto.academicYearId,
        admissionNumber: dto.admissionNumber,
      },
    });

    this.events.emit(EVENTS.STUDENT_ENROLLED, {
      tenantId: actor.tenantId,
      studentId: student.id,
      classId: dto.classId,
      actorId: actor.id,
    });

    return this.findOne(student.id, actor);
  }

  // ─────────────────────── UPDATE
  async update(id: string, dto: UpdateStudentDto, actor: RequestActor) {
    const current = await this.prisma.student.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { user: true },
    });
    if (!current) throw new NotFoundException('Student not found');

    await this.prisma.$transaction(async (tx) => {
      // User updates
      const userUpdate: Prisma.UserUpdateInput = {};
      if (dto.firstName !== undefined) userUpdate.firstName = dto.firstName;
      if (dto.lastName !== undefined) userUpdate.lastName = dto.lastName;
      if (dto.email !== undefined) userUpdate.email = dto.email;
      if (dto.phone !== undefined) userUpdate.phone = dto.phone;
      if (dto.dateOfBirth !== undefined)
        userUpdate.dateOfBirth = new Date(dto.dateOfBirth);
      if (dto.gender !== undefined) userUpdate.gender = dto.gender;
      if (dto.avatar !== undefined) userUpdate.avatar = dto.avatar;

      if (Object.keys(userUpdate).length) {
        await tx.user.update({
          where: { id: current.userId },
          data: userUpdate,
        });
      }

      // Student updates
      const studentUpdate: Prisma.StudentUpdateInput = {};
      if (dto.rollNumber !== undefined)
        studentUpdate.rollNumber = dto.rollNumber;
      if (dto.admissionNumber !== undefined)
        studentUpdate.admissionNumber = dto.admissionNumber;
      if (dto.admissionDate !== undefined)
        studentUpdate.admissionDate = new Date(dto.admissionDate);
      if (dto.emergencyContact !== undefined)
        studentUpdate.emergencyContact = dto.emergencyContact;
      if (dto.emergencyPhone !== undefined)
        studentUpdate.emergencyPhone = dto.emergencyPhone;
      if (dto.academicStatus !== undefined)
        studentUpdate.academicStatus = dto.academicStatus;

      if (Object.keys(studentUpdate).length) {
        await tx.student.update({ where: { id }, data: studentUpdate });
      }
    });

    await this.activityService.log({
      action: ActivityAction.UPDATE,
      entityType: ActivityEntityType.STUDENT,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} updated student`,
    });

    return this.findOne(id, actor);
  }

  // ─────────────────────── TRANSFER
  async transfer(id: string, dto: TransferStudentDto, actor: RequestActor) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const klass = await this.prisma.class.findFirst({
      where: { id: dto.toClassId, tenantId: actor.tenantId },
    });
    if (!klass) throw new NotFoundException('Target class not found');

    const effectiveDate = dto.effectiveDate
      ? new Date(dto.effectiveDate)
      : new Date();

    await this.prisma.$transaction(async (tx) => {
      await this.history.createEntry(
        actor.tenantId,
        {
          studentId: id,
          classId: dto.toClassId,
          academicYearId: dto.academicYearId,
          startDate: effectiveDate.toISOString(),
          reason: dto.reason ?? 'TRANSFER',
          isCurrent: true,
        },
        actor.id,
        tx,
      );

      await tx.student.update({
        where: { id },
        data: { classId: dto.toClassId },
      });
    });

    await this.activityService.log({
      action: ActivityAction.UPDATE,
      entityType: ActivityEntityType.STUDENT,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} transferred student to class ${klass.name}`,
      metadata: { toClassId: dto.toClassId, reason: dto.reason },
    });

    this.events.emit(EVENTS.STUDENT_TRANSFERRED, {
      tenantId: actor.tenantId,
      studentId: id,
      toClassId: dto.toClassId,
      actorId: actor.id,
    });

    return this.findOne(id, actor);
  }

  // ─────────────────────── DELETE (soft via status)
  async remove(id: string, actor: RequestActor) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!student) throw new NotFoundException('Student not found');

    await this.prisma.student.update({
      where: { id },
      data: { academicStatus: StudentStatus.INACTIVE },
    });

    await this.activityService.log({
      action: ActivityAction.DELETE,
      entityType: ActivityEntityType.STUDENT,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} deactivated student`,
    });

    return { message: 'Student deactivated successfully' };
  }
}
