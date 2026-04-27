/**
 * @file curriculum-templates.controller.ts
 * @module curriculum-templates
 * @description Two surfaces:
 *   - Public read endpoints (any authenticated admin can browse) for the
 *     onboarding wizard.
 *   - Write endpoints restricted to SuperAdmin.
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
import { CurriculumTemplatesService } from './curriculum-templates.service';
import {
  AddGradeTemplateDto,
  CreateCurriculumTemplateDto,
  UpdateCurriculumTemplateDto,
} from './dto/curriculum-template.dto';

@ApiTags('Curriculum Templates')
@Controller('curriculum-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CurriculumTemplatesController {
  constructor(private readonly service: CurriculumTemplatesService) {}

  // ─── Public read (Admin onboarding wizard) ───────────────────
  @Get()
  @Roles('SuperAdmin', 'Admin', 'Principal')
  @ApiOperation({ summary: 'List published curriculum templates' })
  list() {
    return this.service.listPublished();
  }

  @Get(':id')
  @Roles('SuperAdmin', 'Admin', 'Principal')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // ─── SuperAdmin write ────────────────────────────────────────
  @Get('admin/all')
  @Roles('SuperAdmin')
  @ApiOperation({ summary: 'SuperAdmin: list ALL templates (incl. drafts)' })
  listAll() {
    return this.service.listAll();
  }

  @Post()
  @Roles('SuperAdmin')
  create(@Body() dto: CreateCurriculumTemplateDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('SuperAdmin')
  update(@Param('id') id: string, @Body() dto: UpdateCurriculumTemplateDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/publish')
  @Roles('SuperAdmin')
  publish(@Param('id') id: string, @Body() body: { isPublished: boolean }) {
    return this.service.publish(id, body.isPublished);
  }

  @Post(':id/grades')
  @Roles('SuperAdmin')
  addGrade(@Param('id') id: string, @Body() dto: AddGradeTemplateDto) {
    return this.service.addGrade(id, dto);
  }

  @Delete(':id/grades/:gradeId')
  @Roles('SuperAdmin')
  removeGrade(@Param('id') id: string, @Param('gradeId') gradeId: string) {
    return this.service.removeGrade(id, gradeId);
  }

  @Delete(':id')
  @Roles('SuperAdmin')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
