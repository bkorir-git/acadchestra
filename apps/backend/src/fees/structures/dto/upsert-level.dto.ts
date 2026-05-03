/**
 * @file upsert-level.dto.ts
 * @description Add/replace a level inside a SCHOOL_WIDE structure.
 *   Either `classId` or `gradeId` must be provided to key the level.
 *
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { FeeComponentDto } from './create-fee-structure.dto';

export class UpsertLevelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gradeId?: string;

  @ApiProperty({ example: 'Grade 4' })
  @IsString()
  @IsNotEmpty()
  levelLabel!: string;

  @ApiProperty({ type: [FeeComponentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeeComponentDto)
  components!: FeeComponentDto[];
}
