/**
 * @file guardian.dto.ts
 * @module common/guardians/dto
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GuardianRelationship } from '@prisma/client';

export class CreateGuardianDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  middleName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Required — primary contact channel' })
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  altPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  occupation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  employer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  nationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowDuplicatePhone?: boolean;
}

export class UpdateGuardianDto {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() middleName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() altPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() occupation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() employer?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nationalId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;
}

export class LinkGuardianDto {
  @ApiProperty()
  @IsString()
  guardianId!: string;

  @ApiProperty({ enum: GuardianRelationship })
  @IsEnum(GuardianRelationship)
  relationship!: GuardianRelationship;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isEmergencyContact?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  canPickup?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  receivesFinancials?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  receivesAcademics?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Inline guardian for student creation — combines profile + link in one step. */
export class InlineGuardianDto {
  @ApiPropertyOptional({
    description:
      'If supplied, link to existing guardian. Otherwise create new from profile fields.',
  })
  @IsOptional()
  @IsString()
  guardianId?: string;

  // Profile (used when guardianId is absent)
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() middleName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() altPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() occupation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;

  // Relationship metadata
  @ApiProperty({ enum: GuardianRelationship })
  @IsEnum(GuardianRelationship)
  relationship!: GuardianRelationship;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrimary?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isEmergencyContact?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() canPickup?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() receivesFinancials?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() receivesAcademics?: boolean;
}
