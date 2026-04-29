/**
 * @file upload.dto.ts
 * @description DTOs for upload create / list / download.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { UploadCategory } from '@prisma/client';

export class CreateUploadDto {
  @ApiProperty({ enum: UploadCategory })
  @IsEnum(UploadCategory)
  category!: UploadCategory;

  @ApiPropertyOptional({
    description:
      'For SuperAdmin uploads, the target tenant id (omit for system)',
  })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class ListUploadsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by tenant. Use "__SYSTEM__" for tenant-less uploads.',
  })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ enum: UploadCategory })
  @IsOptional()
  @IsEnum(UploadCategory)
  category?: UploadCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}

export class DownloadUrlQueryDto {
  @ApiPropertyOptional({ default: 900, description: 'TTL seconds (60-3600)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  expiresInSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  downloadAs?: string;
}
