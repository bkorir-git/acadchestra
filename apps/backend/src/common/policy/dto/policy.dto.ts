import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePolicyDto {
  @ApiProperty({ example: 'late-enrolment-cap' })
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'student' })
  @IsString()
  @MaxLength(40)
  category!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Expression tree (JSONLogic-style or custom DSL)',
    example: { '<=': [{ var: 'student.age' }, 18] },
  })
  @IsObject()
  rules!: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;
}

export class UpdatePolicyDto extends PartialType(CreatePolicyDto) {}
