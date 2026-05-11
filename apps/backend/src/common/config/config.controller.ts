/**
 * @file config.controller.ts
 * @module common/config
 * @description REST endpoints for tenant configuration. Endpoints accept an
 *   optional `?tenantId=` query — used exclusively by SuperAdmin to operate
 *   on a specific school. Admin / Principal / Teacher always work against
 *   their own tenant; the query string is ignored for them and rejected if
 *   it points elsewhere.
 *
 *   Endpoints:
 *     GET    /config[?tenantId=]                          → list everything
 *     GET    /config/categories[?tenantId=]               → list categories
 *     GET    /config/category/:category[?tenantId=]       → load one category
 *     PATCH  /config/category/:category[?tenantId=]       → write keys
 *     PATCH  /config/bulk[?tenantId=]                     → cross-category write
 */

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ConfigService } from './config.service';
import { SetConfigCategoryDto, SetConfigBulkDto } from './dto/config.dto';

@ApiTags('Config')
@Controller('config')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ConfigController {
  constructor(private readonly service: ConfigService) {}

  /**
   * Resolve the effective tenantId for this request.
   *  - SuperAdmin: must pass `?tenantId=...` (or fall back to own tenant).
   *  - Anyone else: query param is ignored unless it matches their own tenant
   *    — in which case it is harmless. Mismatch → 403.
   */
  private resolveTenantId(user: any, requested?: string): string {
    const isSuper =
      Array.isArray(user?.roles) &&
      user.roles.some((r: string) => r === 'SuperAdmin');

    if (isSuper) {
      return requested && requested.length > 0 ? requested : user.tenantId;
    }

    if (requested && requested !== user.tenantId) {
      throw new ForbiddenException(
        'You can only manage configuration for your own tenant',
      );
    }
    return user.tenantId;
  }

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'List every config row for the resolved tenant' })
  list(@CurrentUser() user: any, @Query('tenantId') tenantId?: string) {
    return this.service.listAll(this.resolveTenantId(user, tenantId));
  }

  @Get('categories')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'List distinct config categories' })
  categories(@CurrentUser() user: any, @Query('tenantId') tenantId?: string) {
    return this.service.listCategories(this.resolveTenantId(user, tenantId));
  }

  @Get('category/:category')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  @ApiOperation({
    summary: 'Get a single category merged with shipped defaults',
  })
  getCategory(
    @Param('category') category: string,
    @CurrentUser() user: any,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.service.getCategory(
      this.resolveTenantId(user, tenantId),
      category,
    );
  }

  @Patch('category/:category')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Update keys inside one category' })
  updateCategory(
    @Param('category') category: string,
    @Body() dto: SetConfigCategoryDto,
    @CurrentUser() user: any,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.service.setBulk(this.resolveTenantId(user, tenantId), {
      [category]: dto.values,
    });
  }

  @Patch('bulk')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({
    summary: 'Bulk write configs across multiple categories (onboarding)',
  })
  updateBulk(
    @Body() dto: SetConfigBulkDto,
    @CurrentUser() user: any,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.service.setBulk(
      this.resolveTenantId(user, tenantId),
      dto.payload,
    );
  }
}
