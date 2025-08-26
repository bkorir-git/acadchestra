import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

export interface StudentsFilter {
  page?: number;
  limit?: number;
  search?: string;
  classId?: string;
  status?: string;
  gradeLevel?: number;
}

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createStudentDto: CreateStudentDto, tenantId: string) {
    const { 
      firstName, 
      lastName, 
      email, 
      phone,
      dateOfBirth,
      gender,
      rollNumber, 
      admissionNumber, 
      classId,
      emergencyContact,
      emergencyPhone,
      address,
      parentEmail,
      parentPhone,
      parentName,
    } = createStudentDto;

    // Check if roll number or admission number already exists
    const existingStudent = await this.prisma.student.findFirst({
      where: {
        tenantId,
        OR: [
          { rollNumber },
          { admissionNumber },
        ],
      },
    });

    if (existingStudent) {
      throw new ConflictException('Roll number or admission number already exists');
    }

    // Check if email already exists
    if (email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // Verify class exists and belongs to tenant
    const classExists = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
    });

    if (!classExists) {
      throw new NotFoundException('Class not found');
    }

    // Generate temporary password
    const tempPassword = this.generateTempPassword();
    const hashedPassword = await require('bcrypt').hash(tempPassword, 12);

    // Create user account for student
    const user = await this.prisma.user.create({
      data: {
        email: email || `${rollNumber}@student.temp`,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender,
        tenantId,
        isEmailVerified: false,
      },
    });

    // Assign Student role
    const studentRole = await this.prisma.role.findFirst({
      where: { name: 'Student', tenantId },
    });

    if (studentRole) {
      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: studentRole.id,
        },
      });
    }

    // Create student record
    const student = await this.prisma.student.create({
      data: {
        rollNumber,
        admissionNumber,
        admissionDate: new Date(),
        userId: user.id,
        classId,
        tenantId,
        emergencyContact,
        emergencyPhone,
        academicStatus: 'ACTIVE',
      },
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
          },
        },
        class: {
          include: {
            academicYear: true,
          },
        },
      },
    });

    // Create parent account if parent details provided
    if (parentEmail && parentName) {
      try {
        const parentUser = await this.prisma.user.create({
          data: {
            email: parentEmail,
            password: hashedPassword, // Same temp password
            firstName: parentName.split(' ')[0] || parentName,
            lastName: parentName.split(' ')[1] || '',
            phone: parentPhone,
            tenantId,
            isEmailVerified: false,
          },
        });

        // Assign Parent role
        const parentRole = await this.prisma.role.findFirst({
          where: { name: 'Parent', tenantId },
        });

        if (parentRole) {
          await this.prisma.userRole.create({
            data: {
              userId: parentUser.id,
              roleId: parentRole.id,
            },
          });
        }

        // TODO: Link parent to student (you might want to create a parent-student relationship table)
      } catch (error) {
        // Parent creation failed, but student was created successfully
        console.error('Failed to create parent account:', error);
      }
    }

    return student;
  }

  async findAll(tenantId: string, filters: StudentsFilter = {}) {
    const { page = 1, limit = 10, search, classId, status, gradeLevel } = filters;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { rollNumber: { contains: search, mode: 'insensitive' } },
        { admissionNumber: { contains: search, mode: 'insensitive' } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (classId) {
      where.classId = classId;
    }

    if (status) {
      where.academicStatus = status;
    }

    if (gradeLevel) {
      where.class = {
        gradeLevel: gradeLevel,
      };
    }

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { rollNumber: 'asc' },
        ],
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
            },
          },
          class: {
            include: {
              academicYear: true,
              classTeacher: {
                include: {
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data: students,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const student = await this.prisma.student.findFirst({
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
        class: {
          include: {
            academicYear: true,
            classTeacher: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
            subjects: {
              include: {
                subject: true,
                teacher: {
                  include: {
                    user: {
                      select: {
                        firstName: true,
                        lastName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  async update(id: string, updateStudentDto: UpdateStudentDto, tenantId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const { 
      firstName, 
      lastName, 
      email, 
      phone,
      dateOfBirth,
      gender,
      classId,
      emergencyContact,
      emergencyPhone,
      academicStatus,
      ...studentData 
    } = updateStudentDto;

    // Update user data if provided
    const userUpdateData: any = {};
    if (firstName) userUpdateData.firstName = firstName;
    if (lastName) userUpdateData.lastName = lastName;
    if (email && email !== student.user.email) {
      // Check email uniqueness
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingUser && existingUser.id !== student.user.id) {
        throw new ConflictException('Email already exists');
      }
      userUpdateData.email = email;
    }
    if (phone) userUpdateData.phone = phone;
    if (dateOfBirth) userUpdateData.dateOfBirth = new Date(dateOfBirth);
    if (gender) userUpdateData.gender = gender;

    // Update user if there are changes
    if (Object.keys(userUpdateData).length > 0) {
      await this.prisma.user.update({
        where: { id: student.userId },
        data: userUpdateData,
      });
    }

    // Update student data
    const studentUpdateData: any = { ...studentData };
    if (classId) studentUpdateData.classId = classId;
    if (emergencyContact) studentUpdateData.emergencyContact = emergencyContact;
    if (emergencyPhone) studentUpdateData.emergencyPhone = emergencyPhone;
    if (academicStatus) studentUpdateData.academicStatus = academicStatus;

    const updatedStudent = await this.prisma.student.update({
      where: { id },
      data: studentUpdateData,
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
          },
        },
        class: {
          include: {
            academicYear: true,
          },
        },
      },
    });

    return updatedStudent;
  }

  async remove(id: string, tenantId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
      include: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Delete student record (this will cascade to user due to foreign key)
    await this.prisma.student.delete({
      where: { id },
    });

    // Delete associated user account
    await this.prisma.user.delete({
      where: { id: student.userId },
    });

    return { message: 'Student deleted successfully' };
  }

  async getStudentsByClass(classId: string, tenantId: string) {
    const classExists = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
    });

    if (!classExists) {
      throw new NotFoundException('Class not found');
    }

    return this.prisma.student.findMany({
      where: { classId, tenantId },
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
          },
        },
      },
      orderBy: [
        { rollNumber: 'asc' },
      ],
    });
  }

  async getStudentStats(tenantId: string) {
    const [
      totalStudents,
      activeStudents,
      inactiveStudents,
      graduatedStudents,
      maleStudents,
      femaleStudents,
    ] = await Promise.all([
      this.prisma.student.count({ where: { tenantId } }),
      this.prisma.student.count({ 
        where: { tenantId, academicStatus: 'ACTIVE' } 
      }),
      this.prisma.student.count({ 
        where: { tenantId, academicStatus: 'INACTIVE' } 
      }),
      this.prisma.student.count({ 
        where: { tenantId, academicStatus: 'GRADUATED' } 
      }),
      this.prisma.student.count({ 
        where: { 
          tenantId, 
          user: { gender: 'MALE' } 
        } 
      }),
      this.prisma.student.count({ 
        where: { 
          tenantId, 
          user: { gender: 'FEMALE' } 
        } 
      }),
    ]);

    return {
      totalStudents,
      activeStudents,
      inactiveStudents,
      graduatedStudents,
      maleStudents,
      femaleStudents,
      genderDistribution: {
        male: Math.round((maleStudents / Math.max(totalStudents, 1)) * 100),
        female: Math.round((femaleStudents / Math.max(totalStudents, 1)) * 100),
      },
    };
  }

  private generateTempPassword(): string {
    return Math.random().toString(36).slice(-8).toUpperCase();
  }
}
