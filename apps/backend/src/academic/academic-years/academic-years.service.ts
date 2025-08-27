import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { TermStructure } from '@prisma/client';

@Injectable()
export class AcademicYearsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAcademicYearDto: CreateAcademicYearDto, tenantId: string) {
    const { name, startDate, endDate, termStructure, totalTerms, terms } = createAcademicYearDto;

    // Check if academic year already exists
    const existingYear = await this.prisma.academicYear.findUnique({
      where: {
        name_tenantId: {
          name,
          tenantId,
        },
      },
    });

    if (existingYear) {
      throw new ConflictException('Academic year with this name already exists');
    }

    // Validate dates
    if (new Date(startDate) >= new Date(endDate)) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Create academic year
    const academicYear = await this.prisma.academicYear.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        termStructure: termStructure || TermStructure.THREE_TERMS,
        totalTerms: totalTerms || 3,
        tenantId,
        isCurrent: false, // Will be set separately
      },
    });

    // Create default terms based on structure
    if (terms && terms.length > 0) {
      // Use provided terms
      for (const [index, term] of terms.entries()) {
        await this.prisma.academicTerm.create({
          data: {
            name: term.name,
            shortName: term.shortName || `T${index + 1}`,
            termNumber: index + 1,
            startDate: new Date(term.startDate),
            endDate: new Date(term.endDate),
            hasExams: term.hasExams ?? true,
            hasFees: term.hasFees ?? true,
            examWeeks: term.examWeeks || 2,
            academicYearId: academicYear.id,
            tenantId,
          },
        });
      }
    } else {
      // Create default terms based on structure
      await this.createDefaultTerms(academicYear.id, termStructure || TermStructure.THREE_TERMS, startDate, endDate, tenantId);
    }

    return this.findOne(academicYear.id, tenantId);
  }

  async findAll(tenantId: string, includeTerms = true) {
    return this.prisma.academicYear.findMany({
      where: { tenantId },
      include: {
        terms: includeTerms ? {
          orderBy: { termNumber: 'asc' },
        } : false,
        _count: {
          select: {
            classes: true,
            terms: true,
          },
        },
      },
      orderBy: [
        { isCurrent: 'desc' },
        { startDate: 'desc' },
      ],
    });
  }

  async findOne(id: string, tenantId: string) {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id, tenantId },
      include: {
        terms: {
          orderBy: { termNumber: 'asc' },
        },
        classes: {
          include: {
            _count: {
              select: {
                students: true,
              },
            },
          },
        },
        _count: {
          select: {
            classes: true,
            terms: true,
            feeStructures: true,
          },
        },
      },
    });

    if (!academicYear) {
      throw new NotFoundException('Academic year not found');
    }

    return academicYear;
  }

async update(id: string, updateAcademicYearDto: UpdateAcademicYearDto, tenantId: string) {
  const academicYear = await this.prisma.academicYear.findFirst({
    where: { id, tenantId },
  });

  if (!academicYear) {
    throw new NotFoundException('Academic year not found');
  }

  // Check name conflict if updating name
  if (updateAcademicYearDto.name && updateAcademicYearDto.name !== academicYear.name) {
    const existingYear = await this.prisma.academicYear.findUnique({
      where: {
        name_tenantId: {
          name: updateAcademicYearDto.name,
          tenantId,
        },
      },
    });

    if (existingYear) {
      throw new ConflictException('Academic year with this name already exists');
    }
  }

  // Extract terms from the DTO and exclude it from the update data
  const { terms, ...updateData } = updateAcademicYearDto;

  // Update the academic year (without terms)
  const updatedAcademicYear = await this.prisma.academicYear.update({
    where: { id },
    data: {
      ...updateData,
      startDate: updateData.startDate ? new Date(updateData.startDate) : undefined,
      endDate: updateData.endDate ? new Date(updateData.endDate) : undefined,
    },
    include: {
      terms: {
        orderBy: { termNumber: 'asc' },
      },
      _count: {
        select: {
          classes: true,
          terms: true,
        },
      },
    },
  });

  // Handle terms update separately if provided
  if (terms && terms.length > 0) {
    // Delete existing terms
    await this.prisma.academicTerm.deleteMany({
      where: { academicYearId: id, tenantId },
    });

    // Create new terms
    for (const [index, term] of terms.entries()) {
      await this.prisma.academicTerm.create({
        data: {
          name: term.name,
          shortName: term.shortName || `T${index + 1}`,
          termNumber: index + 1,
          startDate: new Date(term.startDate),
          endDate: new Date(term.endDate),
          hasExams: term.hasExams ?? true,
          hasFees: term.hasFees ?? true,
          examWeeks: term.examWeeks || 2,
          academicYearId: id,
          tenantId,
        },
      });
    }

    // Return the updated academic year with the new terms
    return this.findOne(id, tenantId);
  }

  return updatedAcademicYear;
}

  async setCurrentYear(id: string, tenantId: string) {
    // First, unset current year for all years in this tenant
    await this.prisma.academicYear.updateMany({
      where: { tenantId },
      data: { isCurrent: false },
    });

    // Set the specified year as current
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id, tenantId },
    });

    if (!academicYear) {
      throw new NotFoundException('Academic year not found');
    }

    return this.prisma.academicYear.update({
      where: { id },
      data: { isCurrent: true },
      include: {
        terms: {
          orderBy: { termNumber: 'asc' },
        },
      },
    });
  }

  async remove(id: string, tenantId: string) {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            classes: true,
          },
        },
      },
    });

    if (!academicYear) {
      throw new NotFoundException('Academic year not found');
    }

    if (academicYear._count.classes > 0) {
      throw new BadRequestException('Cannot delete academic year with existing classes');
    }

    if (academicYear.isCurrent) {
      throw new BadRequestException('Cannot delete the current academic year');
    }

    await this.prisma.academicYear.delete({
      where: { id },
    });

    return { message: 'Academic year deleted successfully' };
  }

  async getCurrentYear(tenantId: string) {
    return this.prisma.academicYear.findFirst({
      where: { tenantId, isCurrent: true },
      include: {
        terms: {
          orderBy: { termNumber: 'asc' },
        },
      },
    });
  }

  async getActiveTerms(tenantId: string) {
    return this.prisma.academicTerm.findMany({
      where: { 
        tenantId,
        isActive: true,
      },
      include: {
        academicYear: true,
      },
      orderBy: [
        { academicYear: { isCurrent: 'desc' } },
        { termNumber: 'asc' },
      ],
    });
  }

  private async createDefaultTerms(
    academicYearId: string, 
    termStructure: TermStructure, 
    startDate: string, 
    endDate: string, 
    tenantId: string
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    let terms: Array<{ name: string; shortName: string; startDate: Date; endDate: Date }> = [];

    switch (termStructure) {
      case TermStructure.TWO_SEMESTERS:
        const semesterDays = Math.floor(totalDays / 2);
        terms = [
          {
            name: 'Semester 1',
            shortName: 'S1',
            startDate: start,
            endDate: new Date(start.getTime() + semesterDays * 24 * 60 * 60 * 1000),
          },
          {
            name: 'Semester 2',
            shortName: 'S2',
            startDate: new Date(start.getTime() + (semesterDays + 1) * 24 * 60 * 60 * 1000),
            endDate: end,
          },
        ];
        break;

      case TermStructure.THREE_TERMS:
        const termDays = Math.floor(totalDays / 3);
        terms = [
          {
            name: 'Term 1',
            shortName: 'T1',
            startDate: start,
            endDate: new Date(start.getTime() + termDays * 24 * 60 * 60 * 1000),
          },
          {
            name: 'Term 2',
            shortName: 'T2',
            startDate: new Date(start.getTime() + (termDays + 1) * 24 * 60 * 60 * 1000),
            endDate: new Date(start.getTime() + (termDays * 2 + 1) * 24 * 60 * 60 * 1000),
          },
          {
            name: 'Term 3',
            shortName: 'T3',
            startDate: new Date(start.getTime() + (termDays * 2 + 2) * 24 * 60 * 60 * 1000),
            endDate: end,
          },
        ];
        break;

      case TermStructure.FOUR_QUARTERS:
        const quarterDays = Math.floor(totalDays / 4);
        terms = [
          {
            name: 'Quarter 1',
            shortName: 'Q1',
            startDate: start,
            endDate: new Date(start.getTime() + quarterDays * 24 * 60 * 60 * 1000),
          },
          {
            name: 'Quarter 2',
            shortName: 'Q2',
            startDate: new Date(start.getTime() + (quarterDays + 1) * 24 * 60 * 60 * 1000),
            endDate: new Date(start.getTime() + (quarterDays * 2 + 1) * 24 * 60 * 60 * 1000),
          },
          {
            name: 'Quarter 3',
            shortName: 'Q3',
            startDate: new Date(start.getTime() + (quarterDays * 2 + 2) * 24 * 60 * 60 * 1000),
            endDate: new Date(start.getTime() + (quarterDays * 3 + 2) * 24 * 60 * 60 * 1000),
          },
          {
            name: 'Quarter 4',
            shortName: 'Q4',
            startDate: new Date(start.getTime() + (quarterDays * 3 + 3) * 24 * 60 * 60 * 1000),
            endDate: end,
          },
        ];
        break;
    }

    // Create the terms
    for (const [index, term] of terms.entries()) {
      await this.prisma.academicTerm.create({
        data: {
          name: term.name,
          shortName: term.shortName,
          termNumber: index + 1,
          startDate: term.startDate,
          endDate: term.endDate,
          hasExams: true,
          hasFees: true,
          examWeeks: 2,
          academicYearId,
          tenantId,
        },
      });
    }
  }
}
