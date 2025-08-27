import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsUUID,
  IsEnum,
  MinLength,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ClassType } from '@prisma/client';

export class CreateClassDto {
  @ApiProperty({ example: 'Grade 10 A' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'Grade 10 Section A - Science Stream',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @ApiProperty({ example: 10, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(20) // Allow for more flexible grade systems
  gradeLevel: number;

  @ApiProperty({ example: 'A', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  section?: string;

  @ApiProperty({ example: 40, default: 40 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  capacity?: number;

  @ApiProperty({ enum: ClassType, default: ClassType.REGULAR })
  @IsOptional()
  @IsEnum(ClassType)
  classType?: ClassType;

  @ApiProperty({ example: 'Science', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  stream?: string;

  @ApiProperty({ example: 'English', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;

  @ApiProperty({
    example: 'CBC',
    required: false,
    description: 'Curriculum type (CBC, Cambridge, IB, etc.)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  curriculum?: string;

  @ApiProperty({ example: 'clp8k7q9x0000abc123def456' })
  @IsString()
  @IsNotEmpty()
  academicYearId: string;

  @ApiProperty({ example: 'teacher-uuid', required: false })
  @IsOptional()
  @IsUUID()
  classTeacherId?: string;
}
