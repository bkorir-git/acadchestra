/**
 * @file academic-term.dto.ts
 * @description DTOs for academic term CRUD, bulk creation, activation, and locking.
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateAcademicTermDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  academicYearId!: string;

  @ApiProperty({ example: 'Term 1' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'T1' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  shortName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  termNumber?: number;

  @ApiProperty({ example: '2026-01-10' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-04-05' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  hasExams?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  hasFees?: boolean;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  examWeeks?: number;
}

export class UpdateAcademicTermDto extends PartialType(CreateAcademicTermDto) {}

export class BulkCreateAcademicTermsDto {
  @ApiProperty({ type: [CreateAcademicTermDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAcademicTermDto)
  terms!: CreateAcademicTermDto[];
}

export class ActivateTermDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  autoBill?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  carryForwardArrears?: boolean;
}

export class LockTermDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  academicLock?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  financialLock?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}