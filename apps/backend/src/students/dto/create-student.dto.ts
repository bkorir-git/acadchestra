import { ApiProperty } from '@nestjs/swagger';
import { 
  IsString, 
  IsEmail, 
  IsOptional, 
  IsUUID, 
  IsEnum, 
  IsDateString,
  MinLength,
  MaxLength,
Matches
} from 'class-validator';
import { Gender } from '@prisma/client';

export class CreateStudentDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiProperty({ example: 'john.doe@student.school.edu', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '2010-01-01', required: false })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ enum: Gender, required: false })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ example: 'STU001' })
  @IsString()
  rollNumber: string;

  @ApiProperty({ example: 'ADM2024001' })
  @IsString()
  admissionNumber: string;

  @ApiProperty({ example: 'class-uuid' })
    @IsString()
    @Matches(/^c[a-z0-9]{24}$/, { message: 'tenantId must be a valid CUID' })
  classId: string;

  @ApiProperty({ example: 'Jane Doe (Mother)', required: false })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiProperty({ example: '+1234567891', required: false })
  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @ApiProperty({ example: '123 Student St, City, State', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 'Jane Doe', required: false })
  @IsOptional()
  @IsString()
  parentName?: string;

  @ApiProperty({ example: 'jane.doe@parent.com', required: false })
  @IsOptional()
  @IsEmail()
  parentEmail?: string;

  @ApiProperty({ example: '+1234567891', required: false })
  @IsOptional()
  @IsString()
  parentPhone?: string;
}
