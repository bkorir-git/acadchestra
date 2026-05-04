/**
 * @file fee-categories.controller.ts
 * @description REST endpoints for managing custom fee categories. Mounted
 *   under `/fees/categories`. List/get are READ_ONLY; mutations require
 *   MANAGE. A `seed` endpoint creates the default catalogue.
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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { FeeRoleGuard, FeeAccess } from '../common/fee-roles.guard';
import { FeeCategoriesService } from './fee-categories.service';
import { CreateFeeCategoryDto } from './dto/create-category.dto';
import { UpdateFeeCategoryDto } from './dto/update-category.dto';

@ApiTags('Fee Categories')
@Controller('fees/categories')
@UseGuards(JwtAuthGuard, FeeRoleGuard)
@ApiBearerAuth()
export class FeeCategoriesController {
  constructor(private readonly service: FeeCategoriesService) {}

  @Get()
  @FeeAccess('READ_ONLY')
  @ApiOperation({ summary: 'List fee categories for the tenant' })
  list(
    @Query('search') search: string | undefined,
    @Query('isActive') isActive: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.service.list(user, { search, isActive });
  }

  @Get(':id')
  @FeeAccess('READ_ONLY')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user);
  }

  @Post()
  @FeeAccess('MANAGE')
  create(@Body() dto: CreateFeeCategoryDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Post('seed-defaults')
  @FeeAccess('MANAGE')
  @ApiOperation({ summary: 'Seed the default category catalogue' })
  seed(@CurrentUser() user: any) {
    return this.service.seedDefaults(user);
  }

  @Patch(':id')
  @FeeAccess('MANAGE')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFeeCategoryDto,
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
