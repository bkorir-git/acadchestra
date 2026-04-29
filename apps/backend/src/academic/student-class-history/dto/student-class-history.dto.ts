/**
 * @file student-class-history.dto.ts
 * @module academic/student-class-history/dto
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateStudentClassHistoryDto {
  @ApiProperty()
  @IsString()
  studentId!: string;

  @ApiProperty()
  @IsString()
  classId!: string;

  @ApiProperty()
  @IsString()
  academicYearId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  streamId?: string | null;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @ApiPropertyOptional({ example: 'INITIAL_ENROLLMENT' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;
}

export class UpdateStudentClassHistoryDto extends PartialType(
  CreateStudentClassHistoryDto,
) {}
