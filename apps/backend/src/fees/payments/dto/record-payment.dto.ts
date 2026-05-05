/**
 * @file record-payment.dto.ts
 * @description Payload to record a fee payment. The amount is allocated
 *   FIFO across unpaid components (or by priority if config requests).
 *   `transactionId` is the gateway/M-Pesa reference; `referenceNumber`
 *   is a free-form reference (cheque #, slip #).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AllocationStrategy, PaymentMethod } from '@prisma/client';

export class RecordPaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  studentFeeId!: string;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    enum: AllocationStrategy,
    default: AllocationStrategy.FIFO,
  })
  @IsOptional()
  @IsEnum(AllocationStrategy)
  allocationStrategy?: AllocationStrategy;
}

export class VoidPaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;
}