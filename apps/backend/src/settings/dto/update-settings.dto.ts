/**
 * @file update-settings.dto.ts
 * @description Settings DTO REDUCED to STABLE fields only.
 *   Dynamic business rules (late fees, password policy, feature flags) live
 *   in the Config table — see /config endpoints.
 *
 * Allowed sections:
 *   - Localization (currency, timezone, locale, date/time formats)
 *   - Branding (logo, favicon, colors, tagline)
 *   - Communications identity (email sender name/address)
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsHexColor,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CurrencyPosition, TimeFormat } from '@prisma/client';

export class UpdateSettingsDto {
  // ── Localization ──
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currencySymbol?: string;

  @ApiPropertyOptional({ enum: CurrencyPosition })
  @IsOptional()
  @IsEnum(CurrencyPosition)
  currencyPosition?: CurrencyPosition;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  currencyDecimals?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFormat?: string;

  @ApiPropertyOptional({ enum: TimeFormat })
  @IsOptional()
  @IsEnum(TimeFormat)
  timeFormat?: TimeFormat;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  firstDayOfWeek?: number;

  // ── Branding ──
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  brandTagline?: string;

  // ── Communications IDENTITY (NOT toggles — those are config) ──
  // Stable values — sender display name / address for branded emails.
  // Actual on/off toggles live in Config.comms.*.
}

export class SectionPatchDto {

  @ApiProperty({ enum: ['localization', 'branding', 'communications'] })
  @IsNotEmpty()
  @IsString()
  @IsIn(['localization', 'branding', 'communications'])
  section!: 'localization' | 'branding' | 'communications';

  @ApiProperty({ type: () => UpdateSettingsDto })
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateSettingsDto)
  values!: Partial<UpdateSettingsDto>;
}
