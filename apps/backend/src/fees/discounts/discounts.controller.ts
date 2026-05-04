/**
 * @file discounts.controller.ts
 * @description REST endpoints for student discounts/scholarships.
 */

import {
  Body,
  Controller,
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
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto } from './dto/create-discount.dto';

@ApiTags('Fee Discounts')
@Controller('fees/discounts')
@UseGuards(JwtAuthGuard, FeeRoleGuard)
@ApiBearerAuth()
export class DiscountsController {
  constructor(private readonly service: DiscountsService) {}

  @Post()
  @FeeAccess('MANAGE')
  create(@Body() dto: CreateDiscountDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Get()
  @FeeAccess('READ_ONLY')
  list(
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('studentId') studentId: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.service.list(user, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      studentId,
    });
  }

  @Patch(':id/revoke')
  @FeeAccess('MANAGE')
  revoke(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.revoke(id, user);
  }
}
