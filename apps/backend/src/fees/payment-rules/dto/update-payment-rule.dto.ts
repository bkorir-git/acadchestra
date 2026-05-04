/**
 * @file update-payment-rule.dto.ts
 * @description Partial update for a fee payment rule.
 */

import { PartialType } from '@nestjs/swagger';
import { CreatePaymentRuleDto } from './create-payment-rule.dto';

export class UpdatePaymentRuleDto extends PartialType(CreatePaymentRuleDto) {}