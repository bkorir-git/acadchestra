/**
 * @file class.dto.ts
 * @description DTOs for class creation / update. Note: `stream` is a plain string
 *   label (e.g. "North", "Science"), NOT a foreign key — keeps fees normalised.
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ClassType } from '@prisma/client';

export class CreateClassDto {
  @ApiProperty({ example: 'Grade 3A' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: '3A - Blue House' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  displayName?: string;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(15)
  gradeLevel!: number;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  section?: string;

  @ApiPropertyOptional({ default: 40 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  capacity?: number;

  @ApiPropertyOptional({ enum: ClassType, default: ClassType.REGULAR })
  @IsOptional()
  @IsEnum(ClassType)
  classType?: ClassType;

  @ApiPropertyOptional({ example: 'Science' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  stream?: string;

  @ApiPropertyOptional({ example: 'English' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  language?: string;

  @ApiPropertyOptional({ example: 'CBC' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  curriculum?: string;

  @ApiProperty()
  @IsString()
  academicYearId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classTeacherId?: string;
}

export class UpdateClassDto extends PartialType(CreateClassDto) {}
