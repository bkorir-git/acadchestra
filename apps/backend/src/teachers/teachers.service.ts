/**
 * @description Tenant-safe teachers service with full CRUD, status toggling, and stats.
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

export interface TeachersFilter {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  status?: string;
}

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTeacherDto: CreateTeacherDto, tenantId: string) {
    const {
      firstName,
      lastName,
      email,
      phone,
      employeeId,
      designation,
      department,
      qualification,
      experience,
      salary,
      joiningDate,
    } = createTeacherDto;

    const existingTeacher = await this.prisma.teacher.findUnique({
      where: { employeeId_tenantId: { employeeId, tenantId } },
    });
    if (existingTeacher) {
      throw new ConflictException(
        'Teacher with this employee ID already exists',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const tempPassword = this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        tenantId,
        isEmailVerified: false,
      },
    });

    const teacherRole = await this.prisma.role.findFirst({
      where: { name: 'Teacher', tenantId },
    });
    if (teacherRole) {
      await this.prisma.userRole.create({
        data: { userId: user.id, roleId: teacherRole.id },
      });
    }

    const teacher = await this.prisma.teacher.create({
      data: {
        employeeId,
        joiningDate: new Date(joiningDate),
        designation,
        department,
        qualification,
        experience,
        salary,
        userId: user.id,
        tenantId,
        employmentStatus: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            isActive: true,
          },
        },
      },
    });

    return { ...teacher, tempPassword };
  }

  async findAll(tenantId: string, filters: TeachersFilter = {}) {
    const { page = 1, limit = 10, search, department, status } = filters;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { employeeId: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (department) where.department = department;
    if (status) where.employmentStatus = status;

    const [teachers, total] = await Promise.all([
      this.prisma.teacher.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { user: { firstName: 'asc' } },
          { user: { lastName: 'asc' } },
        ],
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatar: true,
              isActive: true,
            },
          },
          _count: {
            select: {
              classesAsTeacher: true,
              subjectsTaught: true,
            },
          },
        },
      }),
      this.prisma.teacher.count({ where }),
    ]);

    return {
      data: teachers,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async getTeacherStats(tenantId: string) {
    const [
      totalTeachers,
      activeTeachers,
      totalClasses,
      totalSubjects,
      byDepartment,
    ] = await Promise.all([
      this.prisma.teacher.count({ where: { tenantId } }),
      this.prisma.teacher.count({
        where: {
          tenantId,
          employmentStatus: 'ACTIVE',
          user: { isActive: true },
        },
      }),
      this.prisma.class.count({
        where: { tenantId, classTeacherId: { not: null } },
      }),
      this.prisma.classSubject.count({
        where: { teacher: { tenantId } },
      }),
      this.prisma.teacher.groupBy({
        by: ['department'],
        where: { tenantId },
        _count: true,
      }),
    ]);

    return {
      totalTeachers,
      activeTeachers,
      totalClasses,
      totalSubjects,
      byDepartment,
    };
  }

  async findOne(id: string, tenantId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, tenantId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            dateOfBirth: true,
            gender: true,
            avatar: true,
            isActive: true,
            lastLogin: true,
            createdAt: true,
          },
        },
        classesAsTeacher: {
          include: {
            academicYear: true,
            _count: { select: { students: true } },
          },
        },
        subjectsTaught: {
          include: {
            subject: true,
            class: {
              include: {
                academicYear: true,
                _count: { select: { students: true } },
              },
            },
          },
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    return teacher;
  }

  async update(id: string, dto: UpdateTeacherDto, tenantId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, tenantId },
      include: { user: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    const {
      firstName,
      lastName,
      email,
      phone,
      designation,
      department,
      qualification,
      experience,
      salary,
      joiningDate,
      employmentStatus,
    } = dto;

    // Email uniqueness
    if (email && email !== teacher.user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) throw new ConflictException('Email already in use');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: teacher.userId },
        data: {
          ...(firstName !== undefined && { firstName }),
          ...(lastName !== undefined && { lastName }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
        },
      }),
      this.prisma.teacher.update({
        where: { id },
        data: {
          ...(designation !== undefined && { designation }),
          ...(department !== undefined && { department }),
          ...(qualification !== undefined && { qualification }),
          ...(experience !== undefined && { experience }),
          ...(salary !== undefined && { salary }),
          ...(joiningDate !== undefined && {
            joiningDate: new Date(joiningDate),
          }),
          ...(employmentStatus !== undefined && { employmentStatus }),
        },
      }),
    ]);

    return this.findOne(id, tenantId);
  }

  async toggleStatus(id: string, tenantId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, tenantId },
      include: { user: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    const nextActive = !teacher.user.isActive;
    await this.prisma.user.update({
      where: { id: teacher.userId },
      data: { isActive: nextActive },
    });

    return this.findOne(id, tenantId);
  }

  async remove(id: string, tenantId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, tenantId },
      include: { user: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    await this.prisma.teacher.delete({ where: { id } });
    await this.prisma.user.delete({ where: { id: teacher.userId } });

    return { message: 'Teacher deleted successfully' };
  }

  private generateTempPassword(): string {
    return Math.random().toString(36).slice(-8).toUpperCase();
  }
}
