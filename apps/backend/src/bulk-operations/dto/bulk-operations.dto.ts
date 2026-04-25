/**
 * @file bulk-operations.dto.ts
 * @description Bulk ops for student status changes only.
 *   Bulk PROMOTIONS moved to the Promotion Plan engine.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { StudentStatus } from '@prisma/client';

export class BulkBillingDto {
  @ApiProperty()
  @IsString()
  termId!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class BulkStatusUpdateDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  studentIds!: string[];

  @ApiProperty({ enum: StudentStatus })
  @IsEnum(StudentStatus)
  status!: StudentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
