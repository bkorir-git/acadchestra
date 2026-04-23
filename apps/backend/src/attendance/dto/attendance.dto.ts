/**
 * @file attendance.dto.ts
 * @description DTOs for the Attendance module. All creation / upsert operations
 *   are idempotent on the unique tuple `(classId, sessionDate, type, subjectId)`.
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AttendanceSessionStatus,
  AttendanceSessionType,
  AttendanceStatus,
} from '@prisma/client';

/* ─── Session creation / upsert ──────────────────────────────────── */

export class OpenSessionDto {
  @ApiProperty() @IsString() classId!: string;
  @ApiProperty() @IsString() academicYearId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() academicTermId?: string;

  @ApiPropertyOptional({ description: 'Defaults to today (tenant tz later).' })
  @IsOptional()
  @IsDateString()
  sessionDate?: string;

  @ApiPropertyOptional({ enum: AttendanceSessionType, default: AttendanceSessionType.DAILY })
  @IsOptional()
  @IsEnum(AttendanceSessionType)
  type?: AttendanceSessionType;

  @ApiPropertyOptional({ description: 'Optional subject id for subject/period attendance.' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/* ─── Per-record mark payloads ───────────────────────────────────── */

export class MarkEntryDto {
  @ApiProperty() @IsString() studentId!: string;
  @ApiProperty({ enum: AttendanceStatus }) @IsEnum(AttendanceStatus) status!: AttendanceStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) remark?: string;
}

export class MarkSessionDto {
  @ApiProperty({ type: [MarkEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarkEntryDto)
  entries!: MarkEntryDto[];

  @ApiPropertyOptional({
    description:
      'If true, any students in the roster not listed in `entries` are marked PRESENT (fast workflow).',
    default: true,
  })
  @IsOptional()
  defaultPresent?: boolean;
}

export class FinalizeSessionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class LockSessionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

/* ─── Filters / queries ──────────────────────────────────────────── */

export class ListSessionsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() classId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() academicYearId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() academicTermId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional({ enum: AttendanceSessionStatus })
  @IsOptional()
  @IsEnum(AttendanceSessionStatus)
  status?: AttendanceSessionStatus;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

export class StatsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() academicYearId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() academicTermId?: string;
  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days?: number;
}

/* ─── Update single record ───────────────────────────────────────── */

export class UpdateRecordDto {
  @ApiPropertyOptional({ enum: AttendanceStatus })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  remark?: string;
}
