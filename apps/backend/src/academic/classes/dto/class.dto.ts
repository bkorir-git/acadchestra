/**
 * @file class.dto.ts
 * @module academic/classes/dto
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ClassType } from '@prisma/client';

export class CreateClassStreamDto {
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

export class CreateClassDto {
  @ApiProperty({ example: 'Grade 1 East' })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiProperty({ description: 'Grade FK' })
  @IsString()
  gradeId!: string;

  @ApiProperty({ description: 'Academic year FK' })
  @IsString()
  academicYearId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  section?: string;

  @ApiPropertyOptional({ default: 40 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ enum: ClassType, default: ClassType.REGULAR })
  @IsOptional()
  @IsEnum(ClassType)
  classType?: ClassType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classTeacherId?: string;

  @ApiPropertyOptional({
    type: [CreateClassStreamDto],
    description:
      'Optional inline streams. If empty, the class is created streamless.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateClassStreamDto)
  streams?: CreateClassStreamDto[];
}

export class UpdateClassDto extends PartialType(CreateClassDto) {}
