/**
 * @file attendance.service.ts
 * @module attendance
 * @description Attendance domain — v2-aligned.
 *
 *   v2 changes vs legacy:
 *     - Class.gradeLevel:Int        → Class.grade { name, levelOrder }
 *     - Class.stream:String         → Class.streams[] (Stream[]) +
 *                                     Student.streamId (FK to Stream)
 *     - Student.user                → OPTIONAL (User?) — guard everywhere.
 *
 *   Surface unchanged: open → mark → finalize → lock, plus rollups.
 *
 * @commit fix(attendance): align with v2 schema (gradeId, streamId, optional user)
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAction,
  ActivityEntityType,
  AttendanceSessionStatus,
  AttendanceSessionType,
  AttendanceStatus,
  Prisma,
  StudentStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ActivityService } from '../common/activity/activity.service';
import {
  FinalizeSessionDto,
  ListSessionsQueryDto,
  LockSessionDto,
  MarkSessionDto,
  OpenSessionDto,
  StatsQueryDto,
  UpdateRecordDto,
} from './dto/attendance.dto';

export interface RequestActor {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
  teacher?: { id: string } | null;
  userRoles?: Array<{ role?: { name: string } }>;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  // ───────────────────────── helpers ─────────────────────────
  private actorName(a: RequestActor) {
    return [a.firstName, a.lastName].filter(Boolean).join(' ') || 'System user';
  }

  private hasRole(a: RequestActor, ...names: string[]) {
    return !!a.userRoles?.some((r) => names.includes(r?.role?.name ?? ''));
  }

  /** Best-effort full name for a student even when User is missing. */
  private studentDisplayName(s: {
    firstName?: string | null;
    lastName?: string | null;
    user?: { firstName?: string | null; lastName?: string | null } | null;
  }): string {
    const fromStudent = [s.firstName, s.lastName].filter(Boolean).join(' ');
    if (fromStudent) return fromStudent;
    if (s.user) {
      return [s.user.firstName, s.user.lastName].filter(Boolean).join(' ');
    }
    return 'Unknown';
  }

  private toDateOnly(input?: string | Date): Date {
    const d = input ? new Date(input) : new Date();
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  private addDays(base: Date, days: number): Date {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  private async assertCanOperate(classId: string, actor: RequestActor) {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, tenantId: actor.tenantId },
      select: {
        id: true,
        name: true,
        classTeacherId: true,
        academicYearId: true,
        subjects: { select: { teacherId: true } },
      },
    });
    if (!cls) throw new NotFoundException('Class not found');

    if (this.hasRole(actor, 'SuperAdmin', 'Admin', 'Principal')) return cls;

    const teacherId = actor.teacher?.id;
    if (
      teacherId &&
      (cls.classTeacherId === teacherId ||
        cls.subjects.some((s) => s.teacherId === teacherId))
    ) {
      return cls;
    }
    throw new ForbiddenException(
      'You are not assigned to this class and cannot take its attendance',
    );
  }

  private async recomputeAggregates(
    sessionId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const grouped = await client.attendanceRecord.groupBy({
      by: ['status'],
      where: { sessionId },
      _count: { _all: true },
    });

    const counts = {
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
      SICK: 0,
      HOLIDAY: 0,
    } as Record<AttendanceStatus, number>;
    let total = 0;
    for (const g of grouped) {
      counts[g.status] = g._count._all;
      total += g._count._all;
    }

    await client.attendanceSession.update({
      where: { id: sessionId },
      data: {
        totalStudents: total,
        presentCount: counts.PRESENT,
        absentCount: counts.ABSENT,
        lateCount: counts.LATE,
        excusedCount: counts.EXCUSED + counts.SICK,
      },
    });
  }

  // ──────────────────── SESSION LIFECYCLE ─────────────────────

  /**
   * Open (or return existing) session for the given class + date.
   * Also PRE-SEEDS AttendanceRecord rows for the current active student roster,
   * defaulting each to PRESENT. This gives the UI an immediate full register.
   */
  async openSession(dto: OpenSessionDto, actor: RequestActor) {
    const cls = await this.assertCanOperate(dto.classId, actor);
    const date = this.toDateOnly(dto.sessionDate);
    const type = dto.type ?? AttendanceSessionType.DAILY;
    const subjectId = dto.subjectId ?? null;

    // Year/term guard
    if (cls.academicYearId !== dto.academicYearId) {
      throw new BadRequestException(
        'Class does not belong to the specified academic year',
      );
    }

    const existing = await this.prisma.attendanceSession.findFirst({
      where: {
        tenantId: actor.tenantId,
        classId: dto.classId,
        sessionDate: date,
        type,
        subjectId,
      },
    });
    if (existing) return this.findSessionById(existing.id, actor);

    // Fetch active roster once
    const roster = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        classId: dto.classId,
        academicStatus: StudentStatus.ACTIVE,
      },
      select: { id: true },
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const session = await tx.attendanceSession.create({
        data: {
          tenantId: actor.tenantId,
          classId: dto.classId,
          academicYearId: dto.academicYearId,
          academicTermId: dto.academicTermId ?? null,
          sessionDate: date,
          type,
          subjectId,
          notes: dto.notes ?? null,
          takenById: actor.id,
          takenAt: new Date(),
          totalStudents: roster.length,
          presentCount: roster.length,
        },
      });

      if (roster.length) {
        await tx.attendanceRecord.createMany({
          data: roster.map((s) => ({
            sessionId: session.id,
            studentId: s.id,
            status: AttendanceStatus.PRESENT,
            markedById: actor.id,
            tenantId: actor.tenantId,
          })),
          skipDuplicates: true,
        });
      }

      return session;
    });

    await this.activity.log({
      action: ActivityAction.CREATE,
      entityType: ActivityEntityType.ATTENDANCE_SESSION,
      entityId: created.id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} opened attendance for ${cls.name}`,
      metadata: { date: date.toISOString(), classId: dto.classId },
    });

    return this.findSessionById(created.id, actor);
  }

  async findSessionById(id: string, actor: RequestActor) {
    const session = await this.prisma.attendanceSession.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            displayName: true,
            capacity: true,
            academicYearId: true,
            grade: { select: { id: true, name: true, levelOrder: true } },
            streams: { select: { id: true, name: true } },
            classTeacher: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        academicYear: { select: { id: true, name: true, isCurrent: true } },
        academicTerm: { select: { id: true, name: true } },
        records: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatar: true,
                    gender: true,
                  },
                },
                stream: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: [{ student: { rollNumber: 'asc' } }],
        },
      },
    });
    if (!session) throw new NotFoundException('Attendance session not found');
    return session;
  }

  async listSessions(actor: RequestActor, q: ListSessionsQueryDto = {}) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(100, Math.max(1, q.limit ?? 20));

    const where: Prisma.AttendanceSessionWhereInput = {
      tenantId: actor.tenantId,
      ...(q.classId && { classId: q.classId }),
      ...(q.academicYearId && { academicYearId: q.academicYearId }),
      ...(q.academicTermId && { academicTermId: q.academicTermId }),
      ...(q.status && { status: q.status }),
      ...((q.from || q.to) && {
        sessionDate: {
          ...(q.from && { gte: this.toDateOnly(q.from) }),
          ...(q.to && { lte: this.toDateOnly(q.to) }),
        },
      }),
    };

    if (
      !this.hasRole(actor, 'SuperAdmin', 'Admin', 'Principal') &&
      actor.teacher?.id
    ) {
      where.OR = [
        { class: { classTeacherId: actor.teacher.id } },
        { class: { subjects: { some: { teacherId: actor.teacher.id } } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.attendanceSession.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ sessionDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          class: {
            select: {
              id: true,
              name: true,
              grade: { select: { name: true } },
              streams: { select: { name: true } },
            },
          },
          academicTerm: { select: { id: true, name: true } },
        },
      }),
      this.prisma.attendanceSession.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async markSession(id: string, dto: MarkSessionDto, actor: RequestActor) {
    const session = await this.prisma.attendanceSession.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: {
        id: true,
        status: true,
        classId: true,
        sessionDate: true,
        class: { select: { id: true, name: true } },
      },
    });
    if (!session) throw new NotFoundException('Attendance session not found');
    if (session.status === AttendanceSessionStatus.LOCKED) {
      throw new BadRequestException('Session is locked — no edits allowed');
    }
    await this.assertCanOperate(session.classId, actor);

    const defaultPresent = dto.defaultPresent ?? true;

    const studentIds = [...new Set(dto.entries.map((e) => e.studentId))];
    const validCount = await this.prisma.student.count({
      where: {
        id: { in: studentIds },
        classId: session.classId,
        tenantId: actor.tenantId,
      },
    });
    if (validCount !== studentIds.length) {
      throw new BadRequestException(
        'Some students in the payload are not enrolled in this class',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const e of dto.entries) {
        await tx.attendanceRecord.upsert({
          where: {
            sessionId_studentId: { sessionId: id, studentId: e.studentId },
          },
          create: {
            sessionId: id,
            studentId: e.studentId,
            status: e.status,
            remark: e.remark,
            markedById: actor.id,
            tenantId: actor.tenantId,
          },
          update: {
            status: e.status,
            remark: e.remark,
            markedById: actor.id,
            markedAt: new Date(),
          },
        });
      }

      if (defaultPresent) {
        const roster = await tx.student.findMany({
          where: {
            tenantId: actor.tenantId,
            classId: session.classId,
            academicStatus: StudentStatus.ACTIVE,
          },
          select: { id: true },
        });
        const missing = roster
          .map((s) => s.id)
          .filter((sid) => !studentIds.includes(sid));
        if (missing.length) {
          await tx.attendanceRecord.createMany({
            data: missing.map((sid) => ({
              sessionId: id,
              studentId: sid,
              status: AttendanceStatus.PRESENT,
              markedById: actor.id,
              tenantId: actor.tenantId,
            })),
            skipDuplicates: true,
          });
        }
      }

      await this.recomputeAggregates(id, tx);
    });

    await this.activity.log({
      action: ActivityAction.UPDATE,
      entityType: ActivityEntityType.ATTENDANCE_SESSION,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} marked attendance for ${session.class.name}`,
      metadata: { count: dto.entries.length },
    });

    return this.findSessionById(id, actor);
  }

  async updateRecord(
    sessionId: string,
    recordId: string,
    dto: UpdateRecordDto,
    actor: RequestActor,
  ) {
    const record = await this.prisma.attendanceRecord.findFirst({
      where: { id: recordId, sessionId, tenantId: actor.tenantId },
      include: { session: { select: { classId: true, status: true } } },
    });
    if (!record) throw new NotFoundException('Record not found');
    if (record.session.status === AttendanceSessionStatus.LOCKED) {
      throw new BadRequestException('Session is locked');
    }
    await this.assertCanOperate(record.session.classId, actor);

    await this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.remark !== undefined && { remark: dto.remark }),
        markedById: actor.id,
        markedAt: new Date(),
      },
    });
    await this.recomputeAggregates(sessionId);
    return this.findSessionById(sessionId, actor);
  }

  async finalizeSession(
    id: string,
    dto: FinalizeSessionDto,
    actor: RequestActor,
  ) {
    const session = await this.prisma.attendanceSession.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: { id: true, status: true, classId: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status === AttendanceSessionStatus.LOCKED) {
      throw new BadRequestException('Session is locked');
    }
    await this.assertCanOperate(session.classId, actor);

    await this.prisma.attendanceSession.update({
      where: { id },
      data: {
        status: AttendanceSessionStatus.FINALIZED,
        finalizedById: actor.id,
        finalizedAt: new Date(),
        notes: dto.notes,
      },
    });

    await this.activity.log({
      action: ActivityAction.UPDATE,
      entityType: ActivityEntityType.ATTENDANCE_SESSION,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} finalized attendance session`,
    });

    return this.findSessionById(id, actor);
  }

  async lockSession(id: string, dto: LockSessionDto, actor: RequestActor) {
    if (!this.hasRole(actor, 'SuperAdmin', 'Admin', 'Principal')) {
      throw new ForbiddenException('Only admins may lock sessions');
    }
    const session = await this.prisma.attendanceSession.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.attendanceSession.update({
      where: { id },
      data: {
        status: AttendanceSessionStatus.LOCKED,
        lockedById: actor.id,
        lockedAt: new Date(),
        notes: dto.reason ?? session.notes,
      },
    });

    await this.activity.log({
      action: ActivityAction.ACADEMIC_LOCK,
      entityType: ActivityEntityType.ATTENDANCE_SESSION,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} locked attendance session`,
      metadata: { reason: dto.reason },
    });

    return this.findSessionById(id, actor);
  }

  async deleteSession(id: string, actor: RequestActor) {
    if (!this.hasRole(actor, 'SuperAdmin', 'Admin', 'Principal')) {
      throw new ForbiddenException('Only admins may delete sessions');
    }
    const session = await this.prisma.attendanceSession.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.prisma.attendanceSession.delete({ where: { id } });

    await this.activity.log({
      action: ActivityAction.DELETE,
      entityType: ActivityEntityType.ATTENDANCE_SESSION,
      entityId: id,
      tenantId: actor.tenantId,
      userId: actor.id,
      message: `${this.actorName(actor)} deleted attendance session`,
    });
    return { message: 'Session deleted' };
  }

  // ───────────────────── CLASS SPECIFIC ─────────────────────

  /**
   * Today's session for a class — or a prepared (empty) roster ready to open.
   * Never persists; only reads. The FE calls POST /sessions to actually open.
   */
  async getClassToday(
    classId: string,
    academicYearId: string,
    actor: RequestActor,
    dateInput?: string,
  ) {
    await this.assertCanOperate(classId, actor);
    const date = this.toDateOnly(dateInput);

    const session = await this.prisma.attendanceSession.findFirst({
      where: {
        tenantId: actor.tenantId,
        classId,
        sessionDate: date,
        type: AttendanceSessionType.DAILY,
        subjectId: null,
      },
    });

    if (session) {
      return {
        exists: true,
        sessionId: session.id,
        date,
        session: await this.findSessionById(session.id, actor),
      };
    }

    const roster = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        classId,
        academicStatus: StudentStatus.ACTIVE,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            avatar: true,
            gender: true,
          },
        },
        stream: { select: { id: true, name: true } },
      },
      orderBy: [{ rollNumber: 'asc' }],
    });

    return {
      exists: false,
      sessionId: null,
      date,
      prepared: {
        classId,
        academicYearId,
        sessionDate: date,
        students: roster.map((s) => ({
          id: s.id,
          rollNumber: s.rollNumber,
          admissionNumber: s.admissionNumber,
          // Prefer student's own profile, fall back to user link
          firstName: s.firstName ?? s.user?.firstName ?? '',
          lastName: s.lastName ?? s.user?.lastName ?? '',
          avatar: s.user?.avatar ?? s.photoUrl ?? null,
          gender: s.gender ?? s.user?.gender ?? null,
          stream: s.stream,
          status: AttendanceStatus.PRESENT,
        })),
      },
    };
  }

  async getClassStats(
    classId: string,
    actor: RequestActor,
    q: StatsQueryDto = {},
  ) {
    await this.assertCanOperate(classId, actor);
    const to = this.toDateOnly(q.to);
    const from = this.toDateOnly(
      q.from ?? this.addDays(to, -(q.days ?? 30)).toISOString(),
    );

    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        tenantId: actor.tenantId,
        classId,
        sessionDate: { gte: from, lte: to },
      },
      orderBy: [{ sessionDate: 'asc' }],
    });

    const trend = sessions.map((s) => ({
      date: s.sessionDate.toISOString().slice(0, 10),
      present: s.presentCount,
      absent: s.absentCount,
      late: s.lateCount,
      excused: s.excusedCount,
      total: s.totalStudents,
      rate:
        s.totalStudents > 0
          ? Math.round((s.presentCount / s.totalStudents) * 10000) / 100
          : 0,
    }));

    const totalPresent = sessions.reduce((a, b) => a + b.presentCount, 0);
    const totalAbsent = sessions.reduce((a, b) => a + b.absentCount, 0);
    const totalLate = sessions.reduce((a, b) => a + b.lateCount, 0);
    const totalExcused = sessions.reduce((a, b) => a + b.excusedCount, 0);
    const totalMarks = sessions.reduce((a, b) => a + b.totalStudents, 0);

    return {
      classId,
      from,
      to,
      sessions: sessions.length,
      totalMarks,
      totalPresent,
      totalAbsent,
      totalLate,
      totalExcused,
      averageRate:
        totalMarks > 0
          ? Math.round((totalPresent / totalMarks) * 10000) / 100
          : 0,
      trend,
    };
  }

  // ─────────────────── STUDENT SPECIFIC ─────────────────────

  async getStudentSummary(
    studentId: string,
    actor: RequestActor,
    q: StatsQueryDto = {},
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
    });
    if (!student) throw new NotFoundException('Student not found');

    const where: Prisma.AttendanceRecordWhereInput = {
      tenantId: actor.tenantId,
      studentId,
      ...((q.from || q.to) && {
        session: {
          sessionDate: {
            ...(q.from && { gte: this.toDateOnly(q.from) }),
            ...(q.to && { lte: this.toDateOnly(q.to) }),
          },
          ...(q.academicYearId && { academicYearId: q.academicYearId }),
          ...(q.academicTermId && { academicTermId: q.academicTermId }),
        },
      }),
      ...(!q.from &&
        !q.to &&
        (q.academicYearId || q.academicTermId) && {
          session: {
            ...(q.academicYearId && { academicYearId: q.academicYearId }),
            ...(q.academicTermId && { academicTermId: q.academicTermId }),
          },
        }),
    };

    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });

    const map = {
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
      SICK: 0,
      HOLIDAY: 0,
    } as Record<AttendanceStatus, number>;
    for (const g of grouped) map[g.status] = g._count._all;

    const total = Object.values(map).reduce((a, b) => a + b, 0);
    const effectiveTotal = total - map.HOLIDAY;
    const rate =
      effectiveTotal > 0
        ? Math.round((map.PRESENT / effectiveTotal) * 10000) / 100
        : 0;

    const recent = await this.prisma.attendanceRecord.findMany({
      where,
      take: 30,
      orderBy: { session: { sessionDate: 'desc' } },
      include: {
        session: {
          select: {
            id: true,
            sessionDate: true,
            type: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
    });

    return {
      studentId,
      totals: map,
      total,
      effectiveTotal,
      rate,
      recent,
    };
  }

  // ─────────────────── DASHBOARD / TENANT ROLLUPS ───────────────

  async dashboardToday(actor: RequestActor, academicYearId?: string) {
    const today = this.toDateOnly();
    const where: Prisma.AttendanceSessionWhereInput = {
      tenantId: actor.tenantId,
      sessionDate: today,
      ...(academicYearId && { academicYearId }),
    };

    const sessions = await this.prisma.attendanceSession.findMany({
      where,
      select: {
        id: true,
        status: true,
        classId: true,
        totalStudents: true,
        presentCount: true,
        absentCount: true,
        lateCount: true,
        excusedCount: true,
        class: {
          select: {
            id: true,
            name: true,
            grade: { select: { name: true, levelOrder: true } },
          },
        },
      },
    });

    const totalClasses = await this.prisma.class.count({
      where: {
        tenantId: actor.tenantId,
        ...(academicYearId && { academicYearId }),
      },
    });

    const totalPresent = sessions.reduce((a, b) => a + b.presentCount, 0);
    const totalAbsent = sessions.reduce((a, b) => a + b.absentCount, 0);
    const totalLate = sessions.reduce((a, b) => a + b.lateCount, 0);
    const totalMarks = sessions.reduce((a, b) => a + b.totalStudents, 0);

    return {
      date: today,
      totalClasses,
      classesWithSession: sessions.length,
      pendingClasses: totalClasses - sessions.length,
      finalized: sessions.filter((s) => s.status !== 'DRAFT').length,
      draft: sessions.filter((s) => s.status === 'DRAFT').length,
      totalPresent,
      totalAbsent,
      totalLate,
      totalMarks,
      rate:
        totalMarks > 0
          ? Math.round((totalPresent / totalMarks) * 10000) / 100
          : 0,
      sessions,
    };
  }

  async dashboardTrend(actor: RequestActor, q: StatsQueryDto = {}) {
    const days = q.days ?? 14;
    const to = this.toDateOnly(q.to);
    const from = this.addDays(to, -(days - 1));

    const rows = await this.prisma.attendanceSession.groupBy({
      by: ['sessionDate'],
      where: {
        tenantId: actor.tenantId,
        sessionDate: { gte: from, lte: to },
        ...(q.academicYearId && { academicYearId: q.academicYearId }),
        ...(q.academicTermId && { academicTermId: q.academicTermId }),
      },
      _sum: {
        presentCount: true,
        absentCount: true,
        lateCount: true,
        excusedCount: true,
        totalStudents: true,
      },
    });

    const byDate = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      byDate.set(r.sessionDate.toISOString().slice(0, 10), r);
    }

    const out: Array<{
      date: string;
      present: number;
      absent: number;
      late: number;
      excused: number;
      total: number;
      rate: number;
    }> = [];

    for (let i = 0; i < days; i++) {
      const d = this.addDays(from, i);
      const key = d.toISOString().slice(0, 10);
      const row = byDate.get(key);
      const present = row?._sum.presentCount ?? 0;
      const absent = row?._sum.absentCount ?? 0;
      const late = row?._sum.lateCount ?? 0;
      const excused = row?._sum.excusedCount ?? 0;
      const total = row?._sum.totalStudents ?? 0;
      out.push({
        date: key,
        present,
        absent,
        late,
        excused,
        total,
        rate: total > 0 ? Math.round((present / total) * 10000) / 100 : 0,
      });
    }
    return { from, to, days, trend: out };
  }

  // ─────────────────── TEACHER VIEW ─────────────────────────

  /**
   * "My classes today" — for the teacher dashboard.
   * Returns every class the teacher is attached to (as class teacher OR via
   * a class subject), with today's session state.
   */
  async teacherToday(actor: RequestActor) {
    if (!actor.teacher?.id) {
      return { classes: [], date: this.toDateOnly() };
    }
    const teacherId = actor.teacher.id;
    const today = this.toDateOnly();

    const classes = await this.prisma.class.findMany({
      where: {
        tenantId: actor.tenantId,
        OR: [
          { classTeacherId: teacherId },
          { subjects: { some: { teacherId } } },
        ],
      },
      include: {
        academicYear: { select: { id: true, name: true, isCurrent: true } },
        grade: { select: { id: true, name: true, levelOrder: true } },
        streams: { select: { id: true, name: true } },
        _count: { select: { students: true } },
        attendanceSessions: {
          where: {
            sessionDate: today,
            type: AttendanceSessionType.DAILY,
            subjectId: null,
          },
          select: {
            id: true,
            status: true,
            presentCount: true,
            absentCount: true,
            totalStudents: true,
          },
          take: 1,
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    return {
      date: today,
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        displayName: c.displayName,
        gradeName: c.grade.name,
        gradeLevelOrder: c.grade.levelOrder,
        // First stream — for legacy "stream" callers; full list available too
        stream: c.streams[0]?.name ?? null,
        streams: c.streams,
        academicYear: c.academicYear,
        studentCount: c._count.students,
        isClassTeacher: c.classTeacherId === teacherId,
        todaySession: c.attendanceSessions[0] ?? null,
      })),
    };
  }

  // ─────────────────── REPORT / EXPORT ──────────────────────

  async classReport(
    classId: string,
    actor: RequestActor,
    q: StatsQueryDto = {},
  ) {
    await this.assertCanOperate(classId, actor);
    const to = this.toDateOnly(q.to);
    const from = this.toDateOnly(
      q.from ?? this.addDays(to, -(q.days ?? 30)).toISOString(),
    );

    const sessions = await this.prisma.attendanceSession.findMany({
      where: {
        tenantId: actor.tenantId,
        classId,
        sessionDate: { gte: from, lte: to },
      },
      orderBy: { sessionDate: 'asc' },
      include: {
        records: {
          select: {
            studentId: true,
            status: true,
          },
        },
      },
    });

    const students = await this.prisma.student.findMany({
      where: { tenantId: actor.tenantId, classId },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ rollNumber: 'asc' }],
    });

    const matrix = students.map((s) => {
      const name = this.studentDisplayName(s);
      const row: Record<string, string> = {
        studentId: s.id,
        rollNumber: s.rollNumber ?? '',
        admissionNumber: s.admissionNumber,
        name,
      };
      let present = 0;
      let counted = 0;
      for (const sess of sessions) {
        const r = sess.records.find((r) => r.studentId === s.id);
        const key = sess.sessionDate.toISOString().slice(0, 10);
        row[key] = r?.status ?? '-';
        if (r) {
          counted += r.status === AttendanceStatus.HOLIDAY ? 0 : 1;
          if (r.status === AttendanceStatus.PRESENT) present += 1;
        }
      }
      row.rate = counted > 0 ? ((present / counted) * 100).toFixed(2) : '0';
      return row;
    });

    return {
      classId,
      from,
      to,
      columns: sessions.map((s) => s.sessionDate.toISOString().slice(0, 10)),
      rows: matrix,
    };
  }
}
