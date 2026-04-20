/**
 * @description DTO for safe academic year updates.
 */
import { PartialType } from '@nestjs/swagger';
import { CreateAcademicYearDto } from './create-academic-year.dto';

export class UpdateAcademicYearDto extends PartialType(CreateAcademicYearDto) {}
