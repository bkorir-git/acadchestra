/**
 * @controller PromotionPlanController
 * @description Paginated REST endpoints for the promotion plan engine.
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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PromotionPlanStatus, PromotionPlanEntryStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PromotionPlanService } from './promotion-plan.service';
import {
  ApprovePlanDto,
  CreatePromotionPlanDto,
  ExecutePlanDto,
  UpdatePlanEntryDto,
} from './dto/promotion-plan.dto';

@ApiTags('Promotion Plans')
@Controller('academic/promotions/plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PromotionPlanController {
  constructor(private readonly service: PromotionPlanService) {}

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  list(
    @CurrentUser() user: any,
    @Query('status') status?: PromotionPlanStatus,
    @Query('fromAcademicYearId') fromAcademicYearId?: string,
    @Query('toAcademicYearId') toAcademicYearId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(user, {
      status,
      fromAcademicYearId,
      toAcademicYearId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: PromotionPlanEntryStatus,
  ) {
    return this.service.findOne(id, user, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
    });
  }

  @Post()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'STEP 1 — Generate a plan' })
  generate(@Body() dto: CreatePromotionPlanDto, @CurrentUser() user: any) {
    return this.service.generate(dto, user);
  }

  @Patch(':id/entries/:entryId')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'STEP 2 — Override a plan entry' })
  updateEntry(
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdatePlanEntryDto,
    @CurrentUser() user: any,
  ) {
    return this.service.updateEntry(id, entryId, dto, user);
  }

  @Post(':id/approve')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'STEP 3 — Approve plan' })
  approve(
    @Param('id') id: string,
    @Body() dto: ApprovePlanDto,
    @CurrentUser() user: any,
  ) {
    return this.service.approve(id, dto, user);
  }

  @Post(':id/execute')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'STEP 4 — Execute plan' })
  execute(
    @Param('id') id: string,
    @Body() dto: ExecutePlanDto,
    @CurrentUser() user: any,
  ) {
    return this.service.execute(id, dto ?? {}, user);
  }

  @Post(':id/cancel')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.cancel(id, user);
  }
}
