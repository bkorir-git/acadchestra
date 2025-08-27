import { ApiProperty } from '@nestjs/swagger';
import { 
  IsString, 
  IsDateString, 
  IsOptional, 
  IsEnum, 
  IsInt, 
  Min, 
  Max,
  IsArray,
  ValidateNested,
  IsBoolean
} from 'class-validator';
import { Type } from 'class-transformer';
import { TermStructure } from '@prisma/client';

class CreateTermDto {
  @ApiProperty({ example: 'Term 1' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'T1', required: false })
  @IsOptional()
  @IsString()
  shortName?: string;

  @ApiProperty({ example: '2024-09-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2024-12-15' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  hasExams?: boolean;

  @ApiProperty({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  hasFees?: boolean;

  @ApiProperty({ example: 2, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  examWeeks?: number;
}

export class CreateAcademicYearDto {
  @ApiProperty({ example: '2024-2025' })
  @IsString()
  name: string;

  @ApiProperty({ example: '2024-09-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2025-06-30' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ 
    enum: TermStructure, 
    default: TermStructure.THREE_TERMS,
    description: 'Structure of the academic year'
  })
  @IsOptional()
  @IsEnum(TermStructure)
  termStructure?: TermStructure;

  @ApiProperty({ example: 3, default: 3 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(4)
  totalTerms?: number;

  @ApiProperty({ 
    type: [CreateTermDto], 
    required: false,
    description: 'Custom terms (if not provided, default terms will be created)'
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTermDto)
  terms?: CreateTermDto[];
}
