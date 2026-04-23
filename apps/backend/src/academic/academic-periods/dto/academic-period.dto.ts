/**
 * @file academic-period.dto.ts
 * @description DTOs for academic period CRUD (HOLIDAY, EXAM_WEEK, MID_TERM_BREAK, TERM).
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AcademicPeriodType } from '@prisma/client';

export class CreateAcademicPeriodDto {
  @ApiProperty()
  @IsString()
  academicYearId!: string;

  @ApiProperty({ example: 'Mid-term Break' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: AcademicPeriodType })
  @IsEnum(AcademicPeriodType)
  type!: AcademicPeriodType;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiProperty()
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  academicTermId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateAcademicPeriodDto extends PartialType(
  CreateAcademicPeriodDto,
) {}
