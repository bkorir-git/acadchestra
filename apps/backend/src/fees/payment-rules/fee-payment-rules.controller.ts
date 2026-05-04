/**
 * @file fee-payment-rules.controller.ts
 * @description REST endpoints for fee payment rules. Mounted at
 *   `/fees/payment-rules`. List/get are READ_ONLY; mutations need MANAGE.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { FeeRoleGuard, FeeAccess } from '../common/fee-roles.guard';
import { FeePaymentRulesService } from './fee-payment-rules.service';
import { CreatePaymentRuleDto } from './dto/create-payment-rule.dto';
import { UpdatePaymentRuleDto } from './dto/update-payment-rule.dto';

@ApiTags('Fee Payment Rules')
@Controller('fees/payment-rules')
@UseGuards(JwtAuthGuard, FeeRoleGuard)
@ApiBearerAuth()
export class FeePaymentRulesController {
  constructor(private readonly service: FeePaymentRulesService) {}

  @Get()
  @FeeAccess('READ_ONLY')
  list(
    @Query('termId') termId: string | undefined,
    @Query('isActive') isActive: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.service.list(user, termId, isActive);
  }

  @Get(':id')
  @FeeAccess('READ_ONLY')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Post()
  @FeeAccess('MANAGE')
  create(@Body() dto: CreatePaymentRuleDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @FeeAccess('MANAGE')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentRuleDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @FeeAccess('MANAGE')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }
}
