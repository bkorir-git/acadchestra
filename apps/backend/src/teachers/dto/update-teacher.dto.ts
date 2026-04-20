/**
 * @description DTO for updating teacher with partial field support.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsNumber,
  IsEnum,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { EmploymentStatus } from '@prisma/client';

export class UpdateTeacherDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Smith' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({ example: 'john.smith@school.edu' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Senior Mathematics Teacher' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  designation?: string;

  @ApiPropertyOptional({ example: 'Mathematics' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  department?: string;

  @ApiPropertyOptional({ example: 'MSc Mathematics, B.Ed' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  qualification?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  experience?: number;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salary?: number;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @ApiPropertyOptional({ enum: EmploymentStatus })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;
}
