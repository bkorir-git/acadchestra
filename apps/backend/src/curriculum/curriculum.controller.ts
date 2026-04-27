/**
 * @file curriculum.controller.ts
 * @module curriculum
 * @description Tenant curriculum management. Three creation paths exposed:
 *   POST /curriculum/adopt      → from a CurriculumTemplate (onboarding)
 *   POST /curriculum/custom     → from scratch
 *   POST /curriculum            → adopt+custom unified (decides by templateId)
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurriculumService } from './curriculum.service';
import {
  AdoptCurriculumTemplateDto,
  CreateCurriculumDto,
  CreateGradeDto,
  UpdateCurriculumDto,
  UpdateGradeDto,
} from './dto/curriculum.dto';

@ApiTags('Curriculum')
@Controller('curriculum')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CurriculumController {
  constructor(private readonly service: CurriculumService) {}

  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  list(@CurrentUser() user: any) {
    return this.service.list(user.tenantId);
  }

  @Get('default')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher', 'Student')
  @ApiOperation({ summary: 'Get the tenant default curriculum (if any)' })
  getDefault(@CurrentUser() user: any) {
    return this.service.getDefault(user.tenantId);
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal', 'Teacher')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.findOne(id, user.tenantId);
  }

  @Post('adopt')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'Adopt a system CurriculumTemplate' })
  adopt(@Body() dto: AdoptCurriculumTemplateDto, @CurrentUser() user: any) {
    return this.service.adoptTemplate(user, dto);
  }

  @Post('custom')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({
    summary: 'Create a curriculum from scratch with custom grades',
  })
  createCustom(@Body() dto: CreateCurriculumDto, @CurrentUser() user: any) {
    return this.service.createCustom(user, dto);
  }

  @Patch(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCurriculumDto,
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, user, dto);
  }

  @Delete(':id')
  @Roles('SuperAdmin', 'Admin')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }

  // ─── Grade endpoints (nested under curriculum) ──────────────
  @Post(':id/grades')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  addGrade(
    @Param('id') id: string,
    @Body() dto: CreateGradeDto,
    @CurrentUser() user: any,
  ) {
    return this.service.addGrade(id, user, dto);
  }

  @Patch(':id/grades/:gradeId')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  updateGrade(
    @Param('id') id: string,
    @Param('gradeId') gradeId: string,
    @Body() dto: UpdateGradeDto,
    @CurrentUser() user: any,
  ) {
    return this.service.updateGrade(id, gradeId, user, dto);
  }

  @Delete(':id/grades/:gradeId')
  @Roles('SuperAdmin', 'Admin')
  removeGrade(
    @Param('id') id: string,
    @Param('gradeId') gradeId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.removeGrade(id, gradeId, user);
  }
}
