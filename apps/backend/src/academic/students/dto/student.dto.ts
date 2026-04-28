/**
 * @file student.dto.ts
 * @module students/dto
 * @description Student DTOs. Email and phone are OPTIONAL — config drives the
 *   actual requirement at runtime. Inline guardians let the admission form
 *   create a student + guardians in one round-trip.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Gender, StudentStatus } from '@prisma/client';
import { InlineGuardianDto } from '../../../common/guardians/dto/guardian.dto';

export class CreateStudentDto {
  // ── Personal ──────────────────────────────────────────
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  middleName?: string;

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
  @MaxLength(40)
  nationality?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  bloodGroup?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;

  // ── Contact (config-driven required) ─────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  // ── Admission ─────────────────────────────────────────
  @ApiPropertyOptional({
    description:
      'Admission number is auto-issued by AdmissionCounter. Do NOT pass unless migrating data.',
  })
  @IsOptional()
  @IsString()
  admissionNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rollNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  // ── Class / Stream ────────────────────────────────────
  @ApiProperty()
  @IsString()
  classId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  streamId?: string;

  // ── Notes ─────────────────────────────────────────────
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  // ── Inline guardians (created/linked in same transaction) ─
  @ApiPropertyOptional({ type: [InlineGuardianDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InlineGuardianDto)
  guardians?: InlineGuardianDto[];
}

export class UpdateStudentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() middleName?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateOfBirth?: string;
  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
  @ApiPropertyOptional() @IsOptional() @IsString() nationality?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bloodGroup?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rollNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ enum: StudentStatus })
  @IsOptional()
  @IsEnum(StudentStatus)
  academicStatus?: StudentStatus;
}
