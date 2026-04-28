/**
 * @file students.service.ts
 * @module students
 * @description Student admission service — the most-touched mutation in the
 *   whole system. Consumes:
 *     - ConfigService            → tenant validation rules
 *     - AdmissionCounterService  → race-safe lifetime ID
 *     - GuardiansService         → inline guardian creation/linking
 *     - ActivityService          → audit trail
 *     - EmailService             → admission-confirmation email
 *
 *   Admission flow (single transaction):
 *     1. Validate against config rules (email/phone optional, age vs guardian)
 *     2. issueNext()  → reserve admission number with row lock
 *     3. Optionally generate roll number (config-driven)
 *     4. Create Student row
 *     5. Create StudentClassHistory row (initial enrollment, isCurrent=true)
 *     6. For each inline guardian:
 *         a. Find or create Guardian
 *         b. Link via StudentGuardian
 *     7. Validate guardian policy holistically (primary, age requirement)
 *     8. Emit STUDENT_ENROLLED event
 *     9. Activity log
 *    10. Send admission confirmation email to primary guardian (post-commit)
 *
 *   What is NOT done here:
 *     - User account creation (lazy, only when student logs in)
 *     - Fee billing (separate module, listens to STUDENT_ENROLLED)
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAction,
  ActivityEntityType,
  Prisma,
  StudentStatus,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '../../common/config/config.service';
import { AdmissionCounterService } from '../../common/admission-counter/admission-counter.service';
import { GuardiansService } from '../../common/guardians/guardians.service';
import { ActivityService } from '../../common/activity/activity.service';
import { EmailService } from '../../common/email/email.service';
import { EVENTS } from '../../common/events/events.constants';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';
import { RequestActor } from '../../common/types/request-actor.type';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly admissionCounter: AdmissionCounterService,
    private readonly guardians: GuardiansService,
    private readonly activity: ActivityService,
    private readonly email: EmailService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─────────────────────────── READ
  async list(
    tenantId: string,
    opts: {
      page?: number;
      limit?: number;
      search?: string;
      classId?: string;
      streamId?: string;
      status?: StudentStatus;
    } = {},
  ) {
    const page = opts.page ?? 1;
    const limit = Math.min(200, opts.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: Prisma.StudentWhereInput = {
      tenantId,
      ...(opts.classId && { classId: opts.classId }),
      ...(opts.streamId && { streamId: opts.streamId }),
      ...(opts.status && { academicStatus: opts.status }),
      ...(opts.search && {
        OR: [
          { firstName: { contains: opts.search, mode: 'insensitive' } },
          { lastName: { contains: opts.search, mode: 'insensitive' } },
          { admissionNumber: { contains: opts.search, mode: 'insensitive' } },
          { rollNumber: { contains: opts.search, mode: 'insensitive' } },
          { email: { contains: opts.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          class: {
            select: { id: true, name: true, grade: { select: { name: true } } },
          },
          stream: { select: { id: true, name: true } },
          _count: { select: { guardians: true } },
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, tenantId: string) {
    const s = await this.prisma.student.findFirst({
      where: { id, tenantId },
      include: {
        class: { include: { grade: true } },
        stream: true,
        user: { select: { id: true, email: true, lastLogin: true } },
        guardians: {
          include: { guardian: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!s) throw new NotFoundException('Student not found');
    return s;
  }

  // ─────────────────────────── CREATE
  async create(actor: RequestActor, dto: CreateStudentDto) {
    const tenantId = actor.tenantId;

    // ── Pre-flight: config-driven validation ───────────────
    const studentCfg = await this.config.getCategory<{
      requireEmail: boolean;
      requirePhone: boolean;
      autoGenerateRollNumber: boolean;
      requireGuardianBelowAge: number;
      allowDuplicatePhone: boolean;
    }>(tenantId, 'student');

    if (studentCfg.requireEmail && !dto.email) {
      throw new BadRequestException('Email is required by school policy');
    }
    if (studentCfg.requirePhone && !dto.phone) {
      throw new BadRequestException('Phone is required by school policy');
    }

    // Resolve class + (optional) stream
    const klass = await this.prisma.class.findFirst({
      where: { id: dto.classId, tenantId },
      include: { academicYear: { select: { id: true, isLocked: true } } },
    });
    if (!klass) throw new NotFoundException('Class not found');
    if (klass.academicYear.isLocked) {
      throw new BadRequestException('Cannot enroll: academic year is locked');
    }

    if (dto.streamId) {
      const stream = await this.prisma.stream.findFirst({
        where: { id: dto.streamId, classId: dto.classId, tenantId },
      });
      if (!stream)
        throw new BadRequestException(
          'Stream does not belong to the chosen class',
        );
    }

    // Validate guardian policy holistically (BEFORE creation)
    await this.guardians.assertStudentMeetsGuardianPolicy(
      tenantId,
      { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null },
      dto.guardians ?? [],
    );

    // ── Atomic creation ────────────────────────────────────
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Allocate admission number (locks the counter row)
      const admissionNumber = await this.admissionCounter.issueNext(tenantId, {
        tx,
      });

      // 2. Optionally allocate roll number (sequential within tenant)
      let rollNumber: string | undefined = dto.rollNumber;
      if (!rollNumber && studentCfg.autoGenerateRollNumber) {
        const count = await tx.student.count({
          where: { tenantId, classId: dto.classId },
        });
        rollNumber = String(count + 1).padStart(3, '0');
      }

      // 3. Student
      const student = await tx.student.create({
        data: {
          tenantId,
          admissionNumber,
          rollNumber,
          admissionDate: dto.admissionDate
            ? new Date(dto.admissionDate)
            : new Date(),
          firstName: dto.firstName.trim(),
          middleName: dto.middleName,
          lastName: dto.lastName.trim(),
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          gender: dto.gender,
          nationality: dto.nationality,
          bloodGroup: dto.bloodGroup,
          photoUrl: dto.photoUrl,
          email: dto.email?.toLowerCase().trim(),
          phone: dto.phone,
          notes: dto.notes,
          classId: dto.classId,
          streamId: dto.streamId,
          academicStatus: StudentStatus.ACTIVE,
        },
      });

      // 4. Class history (initial enrollment)
      await tx.studentClassHistory.create({
        data: {
          tenantId,
          studentId: student.id,
          classId: dto.classId,
          academicYearId: klass.academicYear.id,
          streamId: dto.streamId,
          isCurrent: true,
          reason: 'INITIAL_ENROLLMENT',
        },
      });

      // 5. Guardians (inline)
      const linkedGuardians: Array<{ id: string; isPrimary: boolean }> = [];
      if (dto.guardians?.length) {
        for (const g of dto.guardians) {
          let guardianId = g.guardianId;
          if (!guardianId) {
            // Create new guardian profile
            if (!g.firstName || !g.lastName || !g.phone) {
              throw new BadRequestException(
                'New guardian requires firstName, lastName, phone',
              );
            }
            // Optional: dedupe by phone unless config allows duplicates
            const existing = studentCfg.allowDuplicatePhone
              ? null
              : await tx.guardian.findFirst({
                  where: { tenantId, phone: g.phone },
                });
            if (existing) {
              guardianId = existing.id;
            } else {
              const created = await tx.guardian.create({
                data: {
                  tenantId,
                  firstName: g.firstName.trim(),
                  lastName: g.lastName.trim(),
                  middleName: g.middleName,
                  email: g.email?.toLowerCase().trim(),
                  phone: g.phone,
                  altPhone: g.altPhone,
                  occupation: g.occupation,
                  address: g.address,
                },
              });
              guardianId = created.id;
            }
          }

          await this.guardians.linkToStudent(
            actor,
            student.id,
            {
              guardianId: guardianId!,
              relationship: g.relationship,
              isPrimary: g.isPrimary ?? false,
              isEmergencyContact: g.isEmergencyContact ?? false,
              canPickup: g.canPickup ?? true,
              receivesFinancials: g.receivesFinancials ?? true,
              receivesAcademics: g.receivesAcademics ?? true,
            },
            tx,
          );
          linkedGuardians.push({
            id: guardianId!,
            isPrimary: g.isPrimary ?? false,
          });
        }
      }

      // 6. Activity log
      await this.activity.log(
        {
          action: ActivityAction.ADMISSION_ISSUED,
          entityType: ActivityEntityType.STUDENT,
          entityId: student.id,
          tenantId,
          userId: actor.id,
          message: `Admitted ${student.firstName} ${student.lastName} (${admissionNumber})`,
          metadata: {
            classId: dto.classId,
            streamId: dto.streamId,
            guardiansAttached: linkedGuardians.length,
          },
        },
        tx,
      );

      return { student, linkedGuardians, klass };
    });

    // ── Side-effects (post-commit) ─────────────────────────
    this.eventEmitter.emit(EVENTS.STUDENT_ENROLLED, {
      tenantId,
      studentId: result.student.id,
      classId: dto.classId,
      actorId: actor.id,
    });

    // Email primary guardian
    const primary = result.linkedGuardians.find((g) => g.isPrimary);
    if (primary) {
      const guardian = await this.prisma.guardian.findUnique({
        where: { id: primary.id },
      });
      if (guardian?.email) {
        await this.email
          .send({
            to: guardian.email,
            toName: `${guardian.firstName} ${guardian.lastName}`,
            tenantId,
            templateCode: 'student_admitted',
            variables: {
              tenant: { name: '...' }, // tenant name resolved by caller if needed
              student: {
                firstName: result.student.firstName,
                lastName: result.student.lastName,
                admissionNumber: result.student.admissionNumber,
                admissionDate: result.student.admissionDate.toDateString(),
              },
              class: { name: result.klass.name },
              guardian: {
                firstName: guardian.firstName,
                name: `${guardian.firstName} ${guardian.lastName}`,
              },
            },
          })
          .catch((err) =>
            this.logger.warn(`Admission email failed: ${err?.message}`),
          );
      }
    }

    return this.findOne(result.student.id, tenantId);
  }

  // ─────────────────────────── UPDATE
  async update(id: string, actor: RequestActor, dto: UpdateStudentDto) {
    await this.findOne(id, actor.tenantId);
    return this.prisma.student.update({
      where: { id },
      data: {
        firstName: dto.firstName?.trim(),
        middleName: dto.middleName,
        lastName: dto.lastName?.trim(),
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        nationality: dto.nationality,
        bloodGroup: dto.bloodGroup,
        photoUrl: dto.photoUrl,
        email: dto.email?.toLowerCase().trim(),
        phone: dto.phone,
        rollNumber: dto.rollNumber,
        notes: dto.notes,
        academicStatus: dto.academicStatus,
      },
    });
  }

  async remove(id: string, actor: RequestActor) {
    await this.findOne(id, actor.tenantId);
    await this.prisma.student.delete({ where: { id } });
    return { deleted: true };
  }
}
