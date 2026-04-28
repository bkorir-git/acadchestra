/**
 * @file config.controller.ts
 * @module common/config
 * @description REST endpoints for tenant configuration. The Settings UI splits
 *   this by category (one tab per category) and writes via the bulk endpoint
 *   to keep the form atomic.
 *
 *   Endpoints:
 *     GET    /config                          → list everything (admin)
 *     GET    /config/categories               → list distinct categories
 *     GET    /config/category/:category       → load one category (merged with defaults)
 *     PATCH  /config/category/:category       → write keys in one category
 *     PATCH  /config/bulk                     → write across categories (onboarding)
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ConfigService } from './config.service';
import {
  SetConfigCategoryDto,
  SetConfigBulkDto,
} from './dto/config.dto';

@ApiTags('Config')
@Controller('config')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ConfigController {
  constructor(private readonly service: ConfigService) {}

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'List every config row for this tenant' })
  list(@CurrentUser() user: any) {
    return this.service.listAll(user.tenantId);
  }

  @Get('categories')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'List distinct config categories' })
  categories(@CurrentUser() user: any) {
    return this.service.listCategories(user.tenantId);
  }

  @Get('category/:category')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({
    summary: 'Get a single category merged with shipped defaults',
  })
  getCategory(
    @Param('category') category: string,
    @CurrentUser() user: any,
  ) {
    return this.service.getCategory(user.tenantId, category);
  }

  @Patch('category/:category')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Update keys inside one category' })
  updateCategory(
    @Param('category') category: string,
    @Body() dto: SetConfigCategoryDto,
    @CurrentUser() user: any,
  ) {
    return this.service.setBulk(user.tenantId, { [category]: dto.values });
  }

  @Patch('bulk')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({
    summary: 'Bulk write configs across multiple categories (onboarding)',
  })
  updateBulk(@Body() dto: SetConfigBulkDto, @CurrentUser() user: any) {
    return this.service.setBulk(user.tenantId, dto.payload);
  }
}
