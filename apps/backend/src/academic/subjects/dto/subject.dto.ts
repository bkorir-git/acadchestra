/**
 * @file subject.dto.ts
 * @description DTOs for subject CRUD and class↔subject assignment.
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SubjectCategory } from '@prisma/client';

export class CreateSubjectDto {
  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'MATH-01' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(15)
  gradeLevel!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isCompulsory?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  credits?: number;

  @ApiPropertyOptional({ enum: SubjectCategory, default: SubjectCategory.CORE })
  @IsOptional()
  @IsEnum(SubjectCategory)
  category?: SubjectCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;
}

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}

export class AssignSubjectToClassDto {
  @ApiProperty()
  @IsString()
  classId!: string;

  @ApiProperty()
  @IsString()
  subjectId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teacherId?: string;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  periodsPerWeek?: number;
}
