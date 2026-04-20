/**
 * @description DTO for partial tenant settings updates.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsHexColor,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrencyPosition, TimeFormat } from '@prisma/client';

export class UpdateSettingsDto {
  // Localization
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) currencySymbol?: string;
  @ApiPropertyOptional({ enum: CurrencyPosition }) @IsOptional() @IsEnum(CurrencyPosition) currencyPosition?: CurrencyPosition;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(4) currencyDecimals?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() locale?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateFormat?: string;
  @ApiPropertyOptional({ enum: TimeFormat }) @IsOptional() @IsEnum(TimeFormat) timeFormat?: TimeFormat;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(6) firstDayOfWeek?: number;

  // Branding
  @ApiPropertyOptional() @IsOptional() @IsString() logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() faviconUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsHexColor() primaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsHexColor() secondaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) brandTagline?: string;

  // Academic
  @ApiPropertyOptional() @IsOptional() @IsString() defaultGradingScale?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) passingGrade?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) attendanceThreshold?: number;

  // Fees
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) receiptPrefix?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) invoicePrefix?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableLateFees?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) lateFeePercentage?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) lateFeeGraceDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) enabledPaymentMethods?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowPartialPayments?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() allowOverpayment?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requirePaymentReference?: boolean;

  // Notifications
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableEmailNotifications?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableSmsNotifications?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enablePushNotifications?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsArray() @Type(() => Number) @IsInt({ each: true }) feeReminderDays?: number[];

  // Security
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(1440) sessionTimeoutMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(6) @Max(64) passwordMinLength?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() passwordRequireUppercase?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() passwordRequireNumber?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() passwordRequireSymbol?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requireTwoFactor?: boolean;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(3) @Max(20) maxLoginAttempts?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1440) lockoutDurationMinutes?: number;

  // Comms
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) emailSenderName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() emailSenderAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() smsProvider?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) smsSenderId?: string;

  // Features
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableParentPortal?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableStudentPortal?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableOnlinePayments?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enableBulkImport?: boolean;

  @ApiPropertyOptional() @IsOptional() customFields?: any;
}
