/**
 * @file streams-config.dto.ts
 * @description DTOs for per-year stream configuration.
 *   Shape: { [gradeLevel: string]: string[] }
 *     - Key missing  → streams NOT configured for that grade (no stream allowed)
 *     - Empty array  → grade is STREAMLESS (stream must be null)
 *     - Non-empty    → stream must match one of the listed labels
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsObject, IsOptional } from 'class-validator';

export class SetStreamsConfigDto {
  @ApiProperty({
    description: 'Map of gradeLevel -> list of allowed stream labels',
    example: { '1': ['A', 'B', 'C'], '2': ['Science', 'Arts'], '3': [] },
  })
  @IsObject()
  streamsByGrade!: Record<string, string[]>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  promotionWindowStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  promotionWindowEnd?: string;
}
