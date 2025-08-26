import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateStudentDto } from './create-student.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { StudentStatus } from '@prisma/client';

export class UpdateStudentDto extends PartialType(CreateStudentDto) {
  @ApiProperty({ enum: StudentStatus, required: false })
  @IsOptional()
  @IsEnum(StudentStatus)
  academicStatus?: StudentStatus;
}
