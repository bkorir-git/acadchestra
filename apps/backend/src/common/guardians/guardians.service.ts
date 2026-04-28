/**
 * @file guardians.service.ts
 * @module common/guardians
 * @description Guardian profile + Student-Guardian relationship management.
 *
 *   Key behaviours:
 *     - Phone is REQUIRED (it's the primary contact channel for most schools).
 *     - Email is optional.
 *     - One guardian can be linked to many students (siblings).
 *     - One student can have many guardians (mom + dad + uncle).
 *     - Exactly one guardian per student should be `isPrimary` (enforced by
 *       service when config.guardian.requirePrimaryContact is true).
 *
 *   Idempotent attach:
 *     - linkToStudent() is upsert-style — calling twice with the same
 *       (studentId, guardianId) updates the relationship row instead of
 *       creating a duplicate.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAction,
  ActivityEntityType,
  GuardianRelationship,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '../config/config.service';
import { ActivityService } from '../activity/activity.service';
import {
  CreateGuardianDto,
  LinkGuardianDto,
  UpdateGuardianDto,
} from './dto/guardian.dto';
import { RequestActor } from '../types/request-actor.type';

@Injectable()
export class GuardiansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
  ) {}

  // ─────────────────────────── READ
  async list(
    tenantId: string,
    opts: { search?: string; page?: number; limit?: number } = {},
  ) {
    const page = opts.page ?? 1;
    const limit = Math.min(100, opts.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: Prisma.GuardianWhereInput = {
      tenantId,
      ...(opts.search && {
        OR: [
          { firstName: { contains: opts.search, mode: 'insensitive' } },
          { lastName: { contains: opts.search, mode: 'insensitive' } },
          { email: { contains: opts.search, mode: 'insensitive' } },
          { phone: { contains: opts.search, mode: 'insensitive' } },
          { nationalId: { contains: opts.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.guardian.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          _count: { select: { students: true } },
        },
      }),
      this.prisma.guardian.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, tenantId: string) {
    const g = await this.prisma.guardian.findFirst({
      where: { id, tenantId },
      include: {
        students: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                admissionNumber: true,
                photoUrl: true,
                class: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!g) throw new NotFoundException('Guardian not found');
    return g;
  }

  async listByStudent(studentId: string, tenantId: string) {
    return this.prisma.studentGuardian.findMany({
      where: { studentId, tenantId },
      include: { guardian: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async listStudentsForGuardian(guardianId: string, tenantId: string) {
    return this.prisma.studentGuardian.findMany({
      where: { guardianId, tenantId },
      include: {
        student: {
          include: {
            class: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  // ─────────────────────────── CREATE
  async create(actor: RequestActor, dto: CreateGuardianDto) {
    // Optional duplicate check by (phone + tenantId) for sanity
    if (dto.phone) {
      const existing = await this.prisma.guardian.findFirst({
        where: { tenantId: actor.tenantId, phone: dto.phone },
      });
      if (existing && !dto.allowDuplicatePhone) {
        throw new BadRequestException(
          `A guardian with phone ${dto.phone} already exists. ` +
            `Use the existing guardian (${existing.firstName} ${existing.lastName}) ` +
            `or set allowDuplicatePhone=true to override.`,
        );
      }
    }

    const guardian = await this.prisma.guardian.create({
      data: {
        tenantId: actor.tenantId,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        middleName: dto.middleName,
        email: dto.email?.toLowerCase().trim(),
        phone: dto.phone.trim(),
        altPhone: dto.altPhone,
        occupation: dto.occupation,
        employer: dto.employer,
        address: dto.address,
        nationalId: dto.nationalId,
        photoUrl: dto.photoUrl,
      },
    });

    await this.activity.log({
      action: ActivityAction.CREATE,
      entityType: ActivityEntityType.GUARDIAN,
      entityId: guardian.id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `Guardian "${guardian.firstName} ${guardian.lastName}" created`,
    });

    return guardian;
  }

  // ─────────────────────────── UPDATE / DELETE
  async update(id: string, actor: RequestActor, dto: UpdateGuardianDto) {
    await this.findOne(id, actor.tenantId);
    return this.prisma.guardian.update({
      where: { id },
      data: {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        middleName: dto.middleName,
        email: dto.email?.toLowerCase().trim(),
        phone: dto.phone?.trim(),
        altPhone: dto.altPhone,
        occupation: dto.occupation,
        employer: dto.employer,
        address: dto.address,
        nationalId: dto.nationalId,
        photoUrl: dto.photoUrl,
      },
    });
  }

  async remove(id: string, actor: RequestActor) {
    const g = await this.findOne(id, actor.tenantId);
    if (g.students.length > 0) {
      throw new BadRequestException(
        `Cannot delete: guardian is linked to ${g.students.length} student(s). Unlink them first.`,
      );
    }
    await this.prisma.guardian.delete({ where: { id } });
    return { deleted: true };
  }

  // ─────────────────────────── STUDENT LINKING
  /**
   * Link an existing guardian to a student (or update relationship metadata
   * if already linked). Enforces:
   *   - max guardians per student (config)
   *   - exactly one primary (config)
   *   - allowed relationships (config)
   */
  async linkToStudent(
    actor: RequestActor,
    studentId: string,
    dto: LinkGuardianDto,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const tenantId = actor.tenantId;

    const guardianConfig = await this.config.getCategory<{
      allowedRelationships: GuardianRelationship[];
      maxGuardiansPerStudent: number;
      requirePrimaryContact: boolean;
    }>(tenantId, 'guardian');

    if (
      guardianConfig.allowedRelationships?.length &&
      !guardianConfig.allowedRelationships.includes(dto.relationship)
    ) {
      throw new BadRequestException(
        `Relationship "${dto.relationship}" is not allowed by school policy`,
      );
    }

    // Check max guardians
    const existingCount = await client.studentGuardian.count({
      where: { studentId, tenantId },
    });
    const alreadyLinked = await client.studentGuardian.findUnique({
      where: { studentId_guardianId: { studentId, guardianId: dto.guardianId } },
    });
    if (
      !alreadyLinked &&
      guardianConfig.maxGuardiansPerStudent &&
      existingCount >= guardianConfig.maxGuardiansPerStudent
    ) {
      throw new BadRequestException(
        `Student already has ${existingCount} guardians (max ${guardianConfig.maxGuardiansPerStudent})`,
      );
    }

    // If setting primary, demote others
    if (dto.isPrimary) {
      await client.studentGuardian.updateMany({
        where: { studentId, tenantId, NOT: { guardianId: dto.guardianId } },
        data: { isPrimary: false },
      });
    }

    const link = await client.studentGuardian.upsert({
      where: { studentId_guardianId: { studentId, guardianId: dto.guardianId } },
      create: {
        tenantId,
        studentId,
        guardianId: dto.guardianId,
        relationship: dto.relationship,
        isPrimary: dto.isPrimary ?? false,
        isEmergencyContact: dto.isEmergencyContact ?? false,
        canPickup: dto.canPickup ?? true,
        receivesFinancials: dto.receivesFinancials ?? true,
        receivesAcademics: dto.receivesAcademics ?? true,
        notes: dto.notes,
      },
      update: {
        relationship: dto.relationship,
        isPrimary: dto.isPrimary ?? undefined,
        isEmergencyContact: dto.isEmergencyContact ?? undefined,
        canPickup: dto.canPickup ?? undefined,
        receivesFinancials: dto.receivesFinancials ?? undefined,
        receivesAcademics: dto.receivesAcademics ?? undefined,
        notes: dto.notes,
      },
    });

    await this.activity.log(
      {
        action: ActivityAction.GUARDIAN_LINKED,
        entityType: ActivityEntityType.STUDENT_GUARDIAN,
        entityId: link.id,
        tenantId,
        userId: actor.id,
        message: `Guardian linked to student (${dto.relationship})`,
        metadata: { studentId, guardianId: dto.guardianId },
      },
      tx,
    );

    return link;
  }

  async unlinkFromStudent(
    actor: RequestActor,
    studentId: string,
    guardianId: string,
  ) {
    const link = await this.prisma.studentGuardian.findUnique({
      where: { studentId_guardianId: { studentId, guardianId } },
    });
    if (!link) throw new NotFoundException('Guardian is not linked to this student');
    if (link.tenantId !== actor.tenantId)
      throw new NotFoundException('Guardian link not found');
    await this.prisma.studentGuardian.delete({
      where: { studentId_guardianId: { studentId, guardianId } },
    });
    return { unlinked: true };
  }

  /**
   * Validate guardian requirements for a student creation/update against config.
   * Used by StudentsService — keeps the logic centralized.
   */
  async assertStudentMeetsGuardianPolicy(
    tenantId: string,
    student: { dateOfBirth?: Date | null },
    guardianLinks: Array<{ isPrimary?: boolean }>,
  ) {
    const cfg = await this.config.getCategory<{
      requireGuardianBelowAge: number;
      requirePrimaryContact: boolean;
      maxGuardiansPerStudent: number;
    }>(tenantId, 'guardian');

    const studentCfg = await this.config.getCategory<{
      requireGuardianBelowAge: number;
    }>(tenantId, 'student');

    const minAge =
      cfg.requireGuardianBelowAge ?? studentCfg.requireGuardianBelowAge ?? 18;

    if (student.dateOfBirth) {
      const age = computeAge(student.dateOfBirth);
      if (age < minAge && guardianLinks.length === 0) {
        throw new BadRequestException(
          `Students under ${minAge} require at least one guardian`,
        );
      }
    }

    if (cfg.requirePrimaryContact && guardianLinks.length > 0) {
      const primaries = guardianLinks.filter((g) => g.isPrimary).length;
      if (primaries !== 1) {
        throw new BadRequestException(
          'Exactly one primary guardian is required',
        );
      }
    }
  }
}

function computeAge(dob: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}
