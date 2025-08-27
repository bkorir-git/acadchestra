import { ApiProperty } from '@nestjs/swagger';
import { 
  IsString, 
  IsEmail, 
  IsOptional, 
  IsDateString,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateTeacherDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiProperty({ example: 'john.smith@school.edu' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'TCH001' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  employeeId: string;

  @ApiProperty({ example: 'Mathematics Teacher' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  designation: string;

  @ApiProperty({ example: 'Mathematics', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  department?: string;

  @ApiProperty({ example: 'MSc Mathematics', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  qualification?: string;

  @ApiProperty({ example: 5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  experience?: number;

  @ApiProperty({ example: 50000, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salary?: number;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  joiningDate: string;
}
