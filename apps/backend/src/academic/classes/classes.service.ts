import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

export interface ClassesFilter {
  page?: number;
  limit?: number;
  search?: string;
  academicYearId?: string;
  gradeLevel?: number;
  classType?: string;
}

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createClassDto: CreateClassDto, tenantId: string) {
    const { 
      name, 
      displayName,
      gradeLevel, 
      section, 
      capacity, 
      classType,
      stream,
      language,
      academicYearId,
      classTeacherId
    } = createClassDto;

    // Verify academic year exists and belongs to tenant
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
    });

    if (!academicYear) {
      throw new NotFoundException('Academic year not found');
    }

    // Check if class name already exists in this academic year
    const existingClass = await this.prisma.class.findUnique({
      where: {
        name_academicYearId_tenantId: {
          name,
          academicYearId,
          tenantId,
        },
      },
    });

    if (existingClass) {
      throw new ConflictException('Class with this name already exists in this academic year');
    }

    // Verify class teacher if provided
    if (classTeacherId) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: classTeacherId, tenantId },
      });

      if (!teacher) {
        throw new NotFoundException('Class teacher not found');
      }
    }

    return this.prisma.class.create({
      data: {
        name,
        gradeLevel,
        section,
        capacity,
        classType,
        stream,
        language,
        academicYearId,
        classTeacherId,
        tenantId,
      },
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
        _count: {
          select: {
            students: true,
            subjects: true,
          },
        },
      },
    });
  }

  async findAll(tenantId: string, filters: ClassesFilter = {}) {
    const { page = 1, limit = 10, search, academicYearId, gradeLevel, classType } = filters;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { section: { contains: search, mode: 'insensitive' } },
        { stream: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    if (gradeLevel) {
      where.gradeLevel = gradeLevel;
    }

    if (classType) {
      where.classType = classType;
    }

    const [classes, total] = await Promise.all([
      this.prisma.class.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { gradeLevel: 'asc' },
          { section: 'asc' },
          { name: 'asc' },
        ],
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
          _count: {
            select: {
              students: true,
              subjects: true,
            },
          },
        },
      }),
      this.prisma.class.count({ where }),
    ]);

    return {
      data: classes,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

async findOne(id: string, tenantId: string) {
  const classEntity = await this.prisma.class.findFirst({
    where: { id, tenantId },
    include: {
      academicYear: true,
      classTeacher: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,            },
          },
        },
      },
      students: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: [
          { rollNumber: 'asc' },
        ],
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
        orderBy: [
          { subject: { name: 'asc' } },
        ],
      },
      _count: {
        select: {
          students: true,
          subjects: true,
        },
      },
    },
  });

  if (!classEntity) {
    throw new NotFoundException('Class not found');
  }

  return classEntity;
}


  async update(id: string, updateClassDto: UpdateClassDto, tenantId: string) {
    const classEntity = await this.prisma.class.findFirst({
      where: { id, tenantId },
    });

    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }

    // Check name conflict if updating name
    if (updateClassDto.name && updateClassDto.name !== classEntity.name) {
      const existingClass = await this.prisma.class.findUnique({
        where: {
          name_academicYearId_tenantId: {
            name: updateClassDto.name,
            academicYearId: classEntity.academicYearId,
            tenantId,
          },
        },
      });

      if (existingClass) {
        throw new ConflictException('Class with this name already exists');
      }
    }

    // Verify class teacher if provided
    if (updateClassDto.classTeacherId) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: updateClassDto.classTeacherId, tenantId },
      });

      if (!teacher) {
        throw new NotFoundException('Class teacher not found');
      }
    }

    return this.prisma.class.update({
      where: { id },
      data: updateClassDto,
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
        _count: {
          select: {
            students: true,
            subjects: true,
          },
        },
      },
    });
  }

  async remove(id: string, tenantId: string) {
    const classEntity = await this.prisma.class.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }

    if (classEntity._count.students > 0) {
      throw new BadRequestException('Cannot delete class with enrolled students');
    }

    await this.prisma.class.delete({
      where: { id },
    });

    return { message: 'Class deleted successfully' };
  }

  async getClassesByAcademicYear(academicYearId: string, tenantId: string) {
    return this.prisma.class.findMany({
      where: { academicYearId, tenantId },
      include: {
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
        _count: {
          select: {
            students: true,
          },
        },
      },
      orderBy: [
        { gradeLevel: 'asc' },
        { section: 'asc' },
      ],
    });
  }

  async getClassStats(tenantId: string) {
    const [
      totalClasses,
      classesByGrade,
      classesByType,
      totalCapacity,
      totalStudents,
    ] = await Promise.all([
      this.prisma.class.count({ where: { tenantId } }),
      this.prisma.class.groupBy({
        by: ['gradeLevel'],
        where: { tenantId },
        _count: true,
        orderBy: { gradeLevel: 'asc' },
      }),
      this.prisma.class.groupBy({
        by: ['classType'],
        where: { tenantId },
        _count: true,
      }),
      this.prisma.class.aggregate({
        where: { tenantId },
        _sum: { capacity: true },
      }),
      this.prisma.student.count({ where: { tenantId, academicStatus: 'ACTIVE' } }),
    ]);

    return {
      totalClasses,
      classesByGrade,
      classesByType,
      totalCapacity: totalCapacity._sum.capacity || 0,
      totalStudents,
      utilizationRate: totalCapacity._sum.capacity ? 
        Math.round((totalStudents / totalCapacity._sum.capacity) * 100) : 0,
    };
  }
}
