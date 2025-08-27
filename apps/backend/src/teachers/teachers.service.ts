import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';

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
      joiningDate
    } = createTeacherDto;

    // Check if employee ID already exists
    const existingTeacher = await this.prisma.teacher.findUnique({
      where: {
        employeeId_tenantId: {
          employeeId,
          tenantId,
        },
      },
    });

    if (existingTeacher) {
      throw new ConflictException('Teacher with this employee ID already exists');
    }

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Generate temporary password
    const tempPassword = this.generateTempPassword();
    const hashedPassword = await require('bcrypt').hash(tempPassword, 12);

    // Create user account for teacher
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

    // Assign Teacher role
    const teacherRole = await this.prisma.role.findFirst({
      where: { name: 'Teacher', tenantId },
    });

    if (teacherRole) {
      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: teacherRole.id,
        },
      });
    }

    // Create teacher record
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

    return teacher;
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

    if (department) {
      where.department = department;
    }

    if (status) {
      where.employmentStatus = status;
    }

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
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
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
            _count: {
              select: {
                students: true,
              },
            },
          },
        },
        subjectsTaught: {
          include: {
            subject: true,
            class: {
              include: {
                academicYear: true,
                _count: {
                  select: {
                    students: true,
                  },
                },
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

  async remove(id: string, tenantId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, tenantId },
      include: { user: true },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    // Delete teacher record
    await this.prisma.teacher.delete({
      where: { id },
    });

    // Delete associated user account
    await this.prisma.user.delete({
      where: { id: teacher.userId },
    });

    return { message: 'Teacher deleted successfully' };
  }

  private generateTempPassword(): string {
    return Math.random().toString(36).slice(-8).toUpperCase();
  }
}
