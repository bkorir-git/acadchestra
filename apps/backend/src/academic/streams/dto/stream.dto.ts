/**
 * @file stream.dto.ts
 * @module academic/streams/dto
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateStreamDto {
  @ApiProperty({ description: 'Class FK' })
  @IsString()
  classId!: string;

  @ApiProperty({ example: 'A' })
  @IsString()
  @MaxLength(40)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ example: '#3b82f6' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  color?: string;
}

export class UpdateStreamDto extends PartialType(CreateStreamDto) {}
