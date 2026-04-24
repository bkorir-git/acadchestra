/**
 * @file student.dto.ts
 * @description DTOs for student enrollment, update, and transfer.
 *   Student is linked to a User — this DTO creates both User + Student
 *   in one atomic operation.
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Gender, StudentStatus } from '@prisma/client';

export class CreateStudentDto {
  // — User-side —
  @ApiProperty()
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatar?: string;

  // — Student-side —
  @ApiProperty()
  @IsString()
  @MinLength(1)
  rollNumber!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  admissionNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @ApiProperty()
  @IsString()
  classId!: string;

  @ApiProperty({ description: 'Academic year for the initial enrollment' })
  @IsString()
  academicYearId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergencyContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  emergencyPhone?: string;
}

export class UpdateStudentDto extends PartialType(CreateStudentDto) {
  @ApiPropertyOptional({ enum: StudentStatus })
  @IsOptional()
  @IsEnum(StudentStatus)
  academicStatus?: StudentStatus;
}

export class TransferStudentDto {
  @ApiProperty()
  @IsString()
  toClassId!: string;

  @ApiProperty()
  @IsString()
  academicYearId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}